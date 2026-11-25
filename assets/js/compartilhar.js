// A janela de compartilhar (um <dialog>), com dois usos:
// - na página do treino, o botão "Compartilhar" mostra as figuras do treino (figuras.js) em PNG de fundo
//   transparente; a prévia pode ficar sobre uma foto da pessoa, que não sai do navegador;
// - na página inicial, os resumos do mês e do ano (resumos.js), calculados na hora com os dados do site:
//   o período escolhido, o esporte, o fundo café ou transparente e a foto do modelo "Retrato".
// Nas duas, cada imagem pode ser baixada, copiada (para colar no story do Instagram) ou mandada pela
// folha de compartilhar do celular.
import { $, $$, buscarJSON, esc, GRUPOS, t } from "./comum.js";
import { carregarFonte, CORES, dadosDoTreino, edicaoAnterior, FIGURAS, limparNome, NOMES_CORES, pngDe } from "./figuras.js";
import { dadosDoPeriodo, MODELOS, periodosDisponiveis } from "./resumos.js";

const CHAVE = "strava-site:figuras";
const op = { cor: "neon", grade: false, sombra: true, fundo: "cafe", esporte: null };
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
let modo = null; // "treino" ou "periodo"
let D = null; // os dados do treino
let P = null; // o que veio para os resumos: { S, P, atividades, rotas, ano, mes }
let R = null; // os dados do período escolhido
let fotoUrl = null; // a foto da prévia (treino)
let fotoRetrato = null; // a imagem do modelo "Retrato" (período)
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
  dialogo.innerHTML = `
    <div class="comp-cabeca">
      <h2 id="comp-titulo"></h2>
      <button type="button" class="comp-fechar" aria-label="${esc(t("Fechar"))}">×</button>
    </div>
    <div class="comp-corpo">
      <div class="fig-opcoes"></div>
      <div class="fig-galeria fundo-xadrez"></div>
    </div>`;
  document.body.append(dialogo);
  galeria = $(".fig-galeria", dialogo);

  $(".comp-fechar", dialogo).onclick = () => dialogo.close();
  dialogo.addEventListener("click", (ev) => {
    // clicar fora da janela (no fundo escurecido) também fecha
    if (ev.target === dialogo) return dialogo.close();
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
      marcar(".fig-fundo", f);
      galeria.className = `fig-galeria fundo-${f.dataset.fundo}`;
      $$(".fig-previa", galeria).forEach((x) => (x.style.backgroundImage = ""));
    }
    const png = ev.target.closest("[data-png]");
    if (png) {
      op.fundo = png.dataset.png;
      guardar();
      marcar(".fig-fundo-png", png);
      ajustarPeriodo();
      desenhar();
    }
    const esp = ev.target.closest("[data-esporte]");
    if (esp) {
      op.esporte = esp.dataset.esporte;
      guardar();
      marcar(".fig-esporte", esp);
      calcular();
      desenhar();
    }
  });
  dialogo.addEventListener("change", async (ev) => {
    const alvo = ev.target;
    if (alvo.id === "fig-grade" || alvo.id === "fig-sombra") {
      op[alvo.id === "fig-grade" ? "grade" : "sombra"] = alvo.checked;
      guardar();
      desenhar();
    } else if (alvo.id === "fig-periodo") {
      const [ano, mes] = alvo.value.split("-").map(Number);
      Object.assign(P, { ano, mes: Number.isFinite(mes) ? mes : null });
      calcular();
      desenhar();
    } else if (alvo.matches(".fig-foto input")) {
      const arq = alvo.files?.[0];
      if (!arq) return;
      if (modo === "treino") {
        if (fotoUrl) URL.revokeObjectURL(fotoUrl);
        fotoUrl = URL.createObjectURL(arq);
        $$(".fig-fundo button", dialogo).forEach((x) => x.setAttribute("aria-pressed", "false"));
        galeria.className = "fig-galeria fundo-foto";
        $$(".fig-previa", galeria).forEach((x) => (x.style.backgroundImage = `url(${fotoUrl})`));
      } else {
        const url = URL.createObjectURL(arq);
        fotoRetrato = await carregarImagem(url).catch(() => fotoRetrato);
        calcular();
        desenhar();
      }
    }
  });
  galeria.addEventListener("click", agir);
}

const marcar = (grupo, b) => $$(`${grupo} button`, dialogo).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));

const carregarImagem = (src) =>
  new Promise((ok, falha) => {
    if (!src) return falha(new Error("sem foto"));
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = falha;
    img.src = src;
  });

// os controles comuns aos dois usos: a cor de destaque e a grade técnica
function controlesComuns() {
  const nomes = NOMES_CORES();
  return `<div class="fig-cores" role="group" aria-label="${esc(t("Cor de destaque"))}">${Object.entries(CORES)
    .map(([k, v]) => `<button type="button" data-cor="${k}" style="background:${v}" aria-label="${esc(nomes[k])}" title="${esc(nomes[k])}" aria-pressed="${k === op.cor}"></button>`)
    .join("")}</div>
    <label><input type="checkbox" id="fig-grade"${op.grade ? " checked" : ""}> ${esc(t("Grade técnica"))}</label>`;
}

function montarOpcoes() {
  const caixa = $(".fig-opcoes", dialogo);
  if (modo === "treino") {
    $("#comp-titulo", dialogo).textContent = t("Compartilhar");
    caixa.innerHTML = `
      <div class="fig-controles">
        ${controlesComuns()}
        <label><input type="checkbox" id="fig-sombra"${op.sombra ? " checked" : ""}> ${esc(t("Sombra"))}</label>
        <div class="abas fig-fundo" role="group" aria-label="${esc(t("Fundo da prévia"))}">
          <button type="button" data-fundo="xadrez" aria-pressed="true">${esc(t("Transparente"))}</button>
          <button type="button" data-fundo="escuro" aria-pressed="false">${esc(t("Escuro"))}</button>
          <button type="button" data-fundo="claro" aria-pressed="false">${esc(t("Claro"))}</button>
          <label class="fig-foto"><input type="file" accept="image/*"><span>${esc(t("Sua foto"))}</span></label>
        </div>
      </div>
      <p class="fig-nota">${esc(t("O PNG sai sempre com o fundo transparente; o fundo aqui é só para ver como fica. A sua foto não sai do navegador."))}</p>`;
    galeria.className = "fig-galeria fundo-xadrez";
    return;
  }
  $("#comp-titulo", dialogo).textContent = t("Resumo para compartilhar");
  const periodos = periodosDisponiveis(P.atividades);
  const atual = P.mes == null ? String(P.ano) : `${P.ano}-${P.mes}`;
  const opcoes = periodos
    .map((g) => `<optgroup label="${g.ano}">
      <option value="${g.ano}"${atual === String(g.ano) ? " selected" : ""}>${esc(g.emCurso ? t("{ano} até agora", { ano: g.ano }) : t("{ano} inteiro", { ano: g.ano }))}</option>
      ${g.meses.map((m) => `<option value="${g.ano}-${m.mes}"${atual === `${g.ano}-${m.mes}` ? " selected" : ""}>${esc(`${m.nome.charAt(0).toLocaleUpperCase()}${m.nome.slice(1)} ${g.ano}`)}</option>`).join("")}
    </optgroup>`)
    .join("");
  const esportes = [["corrida", GRUPOS.corrida.nome], ["caminhada", GRUPOS.caminhada.nome], ["tudo", t("Tudo")]];
  caixa.innerHTML = `
    <div class="fig-controles fig-periodo">
      <label class="fig-select"><span>${esc(t("Período"))}</span><select id="fig-periodo">${opcoes}</select></label>
      <div class="abas fig-esporte" role="group" aria-label="${esc(t("Esporte"))}">${esportes
        .map(([k, nome]) => `<button type="button" data-esporte="${k}" aria-pressed="${k === op.esporte}">${esc(nome)}</button>`)
        .join("")}</div>
    </div>
    <div class="fig-controles">
      ${controlesComuns()}
      <div class="abas fig-fundo-png" role="group" aria-label="${esc(t("Fundo da imagem"))}">
        <button type="button" data-png="cafe" aria-pressed="${op.fundo !== "transparente"}">${esc(t("Fundo café"))}</button>
        <button type="button" data-png="transparente" aria-pressed="${op.fundo === "transparente"}">${esc(t("Transparente"))}</button>
      </div>
      <label class="fig-sombra-png"><input type="checkbox" id="fig-sombra"${op.sombra ? " checked" : ""}> ${esc(t("Sombra"))}</label>
      <label class="fig-foto"><input type="file" accept="image/*"><span>${esc(t("Foto do retrato"))}</span></label>
    </div>
    <p class="fig-nota">${esc(t("Os números são calculados agora, com os treinos que já estão no site. A foto escolhida só entra no modelo Retrato e não sai do navegador."))}</p>`;
  ajustarPeriodo();
}

// com fundo café, a prévia fica sem xadrez e a opção de sombra some (só vale no transparente)
function ajustarPeriodo() {
  const transp = op.fundo === "transparente";
  galeria.className = `fig-galeria ${transp ? "fundo-xadrez" : "fundo-nenhum"}`;
  const s = $(".fig-sombra-png", dialogo);
  if (s) s.hidden = !transp;
}

function calcular() {
  R = dadosDoPeriodo({ atividades: P.atividades, rotas: P.rotas, perfil: P.P, ano: P.ano, mes: P.mes, esporte: op.esporte, foto: fotoRetrato });
}

// as figuras (ou os modelos) que dá para fazer com estes dados
function prontas() {
  const [lista, dados] = modo === "treino" ? [FIGURAS, D] : [MODELOS, R];
  return lista.filter((f) => {
    if (f.nova && !verNovas) return false;
    try {
      return f.pronta(dados);
    } catch {
      return false;
    }
  });
}

const textoAlt = (f) =>
  modo === "treino"
    ? t("Figura {nome} do treino {treino}", { nome: f.nome(), treino: limparNome(D.a.n) })
    : t("Resumo {nome}: {periodo}, {esporte}", { nome: f.nome(), periodo: R.titulo, esporte: R.nomeEsporte });

// Desenha uma imagem por vez, cedendo a vez ao navegador entre elas: a janela abre na hora e vai
// enchendo. Cada imagem vira um PNG guardado (o canvas é descartado), para não pesar no celular.
async function desenhar() {
  const minha = ++rodada;
  urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  const lista = prontas();
  const dados = modo === "treino" ? D : R;
  if (!lista.length) {
    galeria.innerHTML = `<p class="vazio">${esc(t("Nenhum treino deste esporte no período."))}</p>`;
    return;
  }
  galeria.innerHTML = lista
    .map((f) => `<article class="fig-cartao" data-fig="${f.id}">
      <div class="fig-previa"${fotoUrl && modo === "treino" ? ` style="background-image:url(${fotoUrl})"` : ""}><span class="fig-carregando">${esc(t("Desenhando..."))}</span></div>
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
      const blob = await pngDe(f.desenhar(dados, op));
      if (minha !== rodada) return;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      cartao.blob = blob;
      $(".fig-previa", cartao).innerHTML = `<img src="${url}" alt="${esc(textoAlt(f))}">`;
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
  const nomeArq = modo === "treino" ? `oceanthief-${D.a.id}-${cartao.dataset.fig}.png` : `oceanthief-${R.chave}-${R.esporte}-${cartao.dataset.fig}.png`;
  const avisar = (texto) => {
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
      avisar(t("Baixado"));
    } else if (b.dataset.acao === "copiar") {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": cartao.blob })]);
      avisar(t("Copiado"));
    } else {
      await navigator.share({ files: [new File([cartao.blob], nomeArq, { type: "image/png" })] });
    }
  } catch (erro) {
    if (erro?.name !== "AbortError") avisar(t("Não dá neste navegador"));
  }
}

// `T`: o treino (já com .data); `S`, `P`: site.json e perfil.json; `atividades`: a lista do site, preparada
export async function abrirCompartilhar({ T, S, P: perfil, atividades }) {
  if (!dialogo) criar();
  modo = "treino";
  montarOpcoes();
  dialogo.showModal();
  if (!D) {
    galeria.innerHTML = `<p class="vazio">${esc(t("Desenhando..."))}</p>`;
    const [evolucao] = await Promise.all([buscarJSON("data/evolucao.json", true), carregarFonte()]);
    const ant = edicaoAnterior(T, T.data, atividades.filter((a) => a.grupo === "corrida"));
    const arqAnt = ant ? await buscarJSON(`data/atividades/${ant.id}.json`, true) : null;
    D = dadosDoTreino({ T, S, P: perfil, atividades, evolucao, anterior: ant ? { ...ant, cad: arqAnt?.cad } : null });
  }
  desenhar();
}

// Os resumos do mês e do ano. `ano` e `mes` (0 a 11, ou null para o ano todo) são o período que
// abre escolhido; `rotas`: Map do id do treino para a rota (data/rotas.json).
export async function abrirResumo({ S, P: perfil, atividades, rotas, ano, mes = null }) {
  if (!dialogo) criar();
  modo = "periodo";
  P = { S, P: perfil, atividades, rotas, ano, mes };
  if (!op.esporte || !(op.esporte in GRUPOS || op.esporte === "tudo")) op.esporte = perfil?.esporte_principal || "corrida";
  montarOpcoes();
  dialogo.showModal();
  galeria.innerHTML = `<p class="vazio">${esc(t("Desenhando..."))}</p>`;
  const foto = perfil?.fotos?.[0];
  await Promise.all([
    carregarFonte(),
    fotoRetrato ? null : carregarImagem(foto?.grande || foto?.arquivo).then((img) => (fotoRetrato = img), () => null),
  ]);
  calcular();
  desenhar();
}
