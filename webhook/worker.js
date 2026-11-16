/**
 * Ponte entre o Strava e o GitHub, para rodar num Cloudflare Worker (plano grátis).
 *
 * O Strava avisa este endereço sempre que uma atividade sua é criada, editada
 * (título, tipo ou privacidade) ou apagada. O Worker responde na hora e pede ao
 * GitHub Actions para rodar a atualização do site, que fica no ar em 2 a 3 minutos.
 *
 * Variáveis do Worker (Settings > Variables and Secrets):
 *   CAMINHO_SECRETO      texto aleatório; o endereço do aviso fica /strava/<CAMINHO_SECRETO>
 *   STRAVA_VERIFY_TOKEN  a senha da inscrição no Strava
 *   STRAVA_ATHLETE_ID    o número do seu perfil no Strava
 *   GITHUB_REPO          "usuario/repositorio"
 *   GITHUB_TOKEN         token do GitHub com "Contents: Read and write" só nesse repositório (tipo Secret)
 * O comando `python scripts/strava_webhook.py preparar` mostra os três primeiros.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!env.CAMINHO_SECRETO || url.pathname !== `/strava/${env.CAMINHO_SECRETO}`) {
      return new Response("Não encontrado", { status: 404 });
    }

    // o Strava confirma o endereço uma vez, quando a inscrição é criada
    if (request.method === "GET") {
      const p = url.searchParams;
      if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === env.STRAVA_VERIFY_TOKEN) {
        return Response.json({ "hub.challenge": p.get("hub.challenge") });
      }
      return new Response("Senha errada", { status: 403 });
    }

    if (request.method === "POST") {
      let evento = null;
      try {
        evento = await request.json();
      } catch {
        return new Response("Aviso inválido", { status: 400 });
      }
      const doDono = String(evento?.owner_id) === String(env.STRAVA_ATHLETE_ID);
      if (evento?.object_type === "activity" && doDono) {
        // o Strava espera a resposta em até 2 segundos; o pedido ao GitHub segue depois dela
        ctx.waitUntil(avisarGitHub(env, evento));
      }
      return new Response("ok");
    }

    return new Response("Método não aceito", { status: 405 });
  },
};

async function avisarGitHub(env, evento) {
  const resposta = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "strava-site-webhook",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: "strava",
      client_payload: { acao: evento.aspect_type, atividade: evento.object_id },
    }),
  });
  // aparece em Workers > o seu Worker > Logs
  if (!resposta.ok) console.log("O GitHub recusou o pedido:", resposta.status, await resposta.text());
  else console.log("Atualização pedida:", evento.aspect_type, evento.object_id);
}
