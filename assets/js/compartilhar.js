// O botão "Compartilhar" da página do treino: abre uma janela com as figuras do treino (figuras.js) em PNG
// de fundo transparente, para baixar, copiar (e colar no story do Instagram) ou mandar pela folha de
// compartilhar do celular. A prévia pode ficar sobre uma foto da pessoa, que não sai do navegador.
import { $, $$, buscarJSON, esc, t } from "./comum.js";
import { carregarFonte, CORES, dadosDoTreino, edicaoAnterior, FIGURAS, limparNome, NOMES_CORES, pngDe } from "./figuras.js";

const CHAVE = "strava-site:figuras";
const op = { cor: "neon", grade: false, sombra: true };
try {
  Object.assign(op, JSON.parse(localStorage.getItem(CHAVE) || "{}"));
  if (!CORES[op.cor]) op.cor = "neon";
} catch {}
const guardar = () => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(op));
  } catch {}
};
// as figuras marcadas como `nova` (figuras.js) só aparecem com ?figuras=novas no endereço, até serem aprovadas
const verNovas = new URLSearchParams(location.search).get("figuras") === "novas";

let dialogo;
let galeria;
let D = null;
let fotoUrl = null;
let rodada = 0;
const urls = [];

// dá para compartilhar arquivo? (no celular, sim; no computador, quase nunca)
const podeCompartilhar = (() => {
  try {
    return !!navigator.canShare?.({ files: [new File([new Blob()], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
})();

function criar() {
  dialogo = document.createElement("dialog");
  dialogo.className = "compartilhar";
  dialogo.setAttribute("aria-labelledby", "comp-titulo");
  const nomes = NOMES_CORES();
  dialogo.innerHTML = `
    <div class="comp-cabeca">
      <h2 id="comp-titulo">${esc(t("Compartilhar"))}</h2>
      <button type="button" class="comp-fechar" aria-label="${esc(t("Fechar"))}">×</button>
    </div>
    <div class="comp-corpo">
      <div class="fig-controles">
        <div class="fig-cores" role="group" aria-label="${esc(t("Cor de destaque"))}">${Object.entries(CORES)
          .map(([k, v]) => `<button type="button" data-cor="${k}" style="background:${v}" aria-label="${esc(nomes[k])}" title="${esc(nomes[k])}" aria-pressed="${k === op.cor}"></button>`)
          .join("")}</div>
        <label><input type="checkbox" id="fig-grade"${op.grade ? " checked" : ""}> ${esc(t("Grade técnica"))}</label>
        <label><input type="checkbox" id="fig-sombra"${op.sombra ? " checked" : ""}> ${esc(t("Sombra"))}</label>
        <div class="abas fig-fundo" role="group" aria-label="${esc(t("Fundo da prévia"))}">
          <button type="button" data-fundo="xadrez" aria-pressed="true">${esc(t("Transparente"))}</button>
          <button type="button" data-fundo="escuro" aria-pressed="false">${esc(t("Escuro"))}</button>
          <button type="button" data-fundo="claro" aria-pressed="false">${esc(t("Claro"))}</button>
          <label class="fig-foto"><input type="file" accept="image/*"><span>${esc(t("Sua foto"))}</span></label>
        </div>
      </div>
      <p class="fig-nota">${esc(t("O PNG sai sempre com o fundo transparente; o fundo aqui é só para ver como fica. A sua foto não sai do navegador."))}</p>
      <div class="fig-galeria fundo-xadrez"></div>
    </div>`;
  document.body.append(dialogo);
  galeria = $(".fig-galeria", dialogo);

  $(".comp-fechar", dialogo).onclick = () => dialogo.close();
  // clicar fora da janela (no fundo escurecido) também fecha
  dialogo.addEventListener("click", (ev) => {
    if (ev.target === dialogo) dialogo.close();
  });
  dialogo.addEventListener("click", (ev) => {
    const cor = ev.target.closest("[data-cor]");
    if (cor) {
      op.cor = cor.dataset.cor;
      guardar();
      $$(".fig-cores button", dialogo).forEach((x) => x.setAttribute("aria-pressed", String(x === cor)));
      desenhar();
    }
    const f = ev.target.closest("[data-fundo]");
    if (f) {
      fotoUrl = null;
      $$(".fig-fundo button", dialogo).forEach((x) => x.setAttribute("aria-pressed", String(x === f)));
      galeria.className = `fig-galeria fundo-${f.dataset.fundo}`;
      $$(".fig-previa", galeria).forEach((x) => (x.style.backgroundImage = ""));
    }
  });
  $("#fig-grade", dialogo).onchange = (ev) => {
    op.grade = ev.target.checked;
    guardar();
    desenhar();
  };
  $("#fig-sombra", dialogo).onchange = (ev) => {
    op.sombra = ev.target.checked;
    guardar();
    desenhar();
  };
  $(".fig-foto input", dialogo).onchange = (ev) => {
    const arq = ev.target.files?.[0];
    if (!arq) return;
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    fotoUrl = URL.createObjectURL(arq);
    $$(".fig-fundo button", dialogo).forEach((x) => x.setAttribute("aria-pressed", "false"));
    galeria.className = "fig-galeria fundo-foto";
    $$(".fig-previa", galeria).forEach((x) => (x.style.backgroundImage = `url(${fotoUrl})`));
  };
  galeria.addEventListener("click", agir);
}

// as figuras que o treino permite (as novas só com ?figuras=novas)
function prontas() {
  return FIGURAS.filter((f) => {
    if (f.nova && !verNovas) return false;
    try {
      return f.pronta(D);
    } catch {
      return false;
    }
  });
}

// Desenha uma figura por vez, cedendo a vez ao navegador entre elas: a janela abre na hora e vai
// enchendo. Cada figura vira um PNG guardado (o canvas é descartado), para não pesar no celular.
async function desenhar() {
  const minha = ++rodada;
  urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  const lista = prontas();
  galeria.innerHTML = lista
    .map((f) => `<article class="fig-cartao" data-fig="${f.id}">
      <div class="fig-previa"${fotoUrl ? ` style="background-image:url(${fotoUrl})"` : ""}><span class="fig-carregando">${esc(t("Desenhando..."))}</span></div>
      <div class="fig-rodape"><h3>${esc(f.nome())}</h3><div class="fig-acoes">
        <button type="button" data-acao="baixar" disabled>${esc(t("Baixar"))}</button>
        <button type="button" data-acao="copiar" disabled>${esc(t("Copiar"))}</button>
        ${podeCompartilhar ? `<button type="button" data-acao="compartilhar" disabled>${esc(t("Compartilhar"))}</button>` : ""}
      </div></div>
    </article>`)
    .join("");
  for (const f of lista) {
    await new Promise((r) => setTimeout(r, 0));
    if (minha !== rodada) return;
    const cartao = $(`[data-fig="${f.id}"]`, galeria);
    try {
      const blob = await pngDe(f.desenhar(D, op));
      if (minha !== rodada) return;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      cartao.blob = blob;
      $(".fig-previa", cartao).innerHTML = `<img src="${url}" alt="${esc(t("Figura {nome} do treino {treino}", { nome: f.nome(), treino: limparNome(D.a.n) }))}">`;
      $$("[data-acao]", cartao).forEach((b) => (b.disabled = false));
    } catch (erro) {
      $(".fig-previa", cartao).innerHTML = `<p class="vazio">${esc(t("Não deu certo"))}</p>`;
      console.error(f.id, erro);
    }
  }
}

async function agir(ev) {
  const b = ev.target.closest("[data-acao]");
  if (!b?.closest(".fig-cartao")?.blob) return;
  const cartao = b.closest(".fig-cartao");
  const nomeArq = `oceanthief-${D.a.id}-${cartao.dataset.fig}.png`;
  const marcar = (texto) => {
    const antes = b.textContent;
    b.textContent = texto;
    b.classList.add("feito");
    setTimeout(() => {
      b.textContent = antes;
      b.classList.remove("feito");
    }, 1800);
  };
  try {
    if (b.dataset.acao === "baixar") {
      const url = URL.createObjectURL(cartao.blob);
      Object.assign(document.createElement("a"), { href: url, download: nomeArq }).click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      marcar(t("Baixado"));
    } else if (b.dataset.acao === "copiar") {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": cartao.blob })]);
      marcar(t("Copiado"));
    } else {
      await navigator.share({ files: [new File([cartao.blob], nomeArq, { type: "image/png" })] });
    }
  } catch (erro) {
    if (erro?.name !== "AbortError") marcar(t("Não dá neste navegador"));
  }
}

// `T`: o treino (já com .data); `S`, `P`: site.json e perfil.json; `atividades`: a lista do site, preparada
export async function abrirCompartilhar({ T, S, P, atividades }) {
  if (!dialogo) criar();
  dialogo.showModal();
  if (!D) {
    galeria.innerHTML = `<p class="vazio">${esc(t("Desenhando..."))}</p>`;
    const [evolucao] = await Promise.all([buscarJSON("data/evolucao.json", true), carregarFonte()]);
    const ant = edicaoAnterior(T, T.data, atividades.filter((a) => a.grupo === "corrida"));
    const arqAnt = ant ? await buscarJSON(`data/atividades/${ant.id}.json`, true) : null;
    D = dadosDoTreino({ T, S, P, atividades, evolucao, anterior: ant ? { ...ant, cad: arqAnt?.cad } : null });
  }
  desenhar();
}
