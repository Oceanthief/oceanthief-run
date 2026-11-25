// Página de teste das figuras para compartilhar (fica fora do site publicado).
// prototipo-figuras.html?id=<treino>: todas as figuras que aquele treino permite, com baixar, copiar e compartilhar.
import { $, $$, buscarJSON, carregarTudo, dataLocal, distTreino, esc, montarRodape, montarTopo, nomeTopo, t, dataLonga } from "./comum.js";
import { carregarFonte, CORES, edicaoAnterior, FIGURAS, limparNome, pngDe } from "./figuras.js";

const raiz = $("#figuras");
const op = { cor: "neon", grade: false, sombra: true };
let fundo = "xadrez";
let fotoUrl = null;

try {
  const { site, perfil, plano } = await carregarTudo();
  montarTopo({ nome: nomeTopo(site, perfil), plano: plano?.semanas?.length > 0 });
  montarRodape(site, perfil);
  const [evolucao] = await Promise.all([buscarJSON("data/evolucao.json", true), carregarFonte()]);
  const corridas = site.atividades.filter((a) => a.grupo === "corrida").sort((a, b) => b.data - a.data);
  const params = new URLSearchParams(location.search);
  let id = params.get("id") || String(corridas[0]?.id || "");
  const opcao = (a) => `<option value="${a.id}">${esc(`${dataLonga(a.data)}: ${limparNome(a.n)} (${distTreino(a.m)})`)}</option>`;

  raiz.innerHTML = `
    <header class="pagina-cabeca"><h1>${esc(t("Figuras para compartilhar"))}</h1></header>
    <div class="fig-controles">
      <label class="fig-treino">${esc(t("Treino"))} <select id="fig-treino">
        <optgroup label="${esc(t("Provas"))}">${corridas.filter((a) => a.prova).map(opcao).join("")}</optgroup>
        <optgroup label="${esc(t("Treinos recentes"))}">${corridas.slice(0, 60).map(opcao).join("")}</optgroup>
      </select></label>
      <div class="fig-cores" role="group" aria-label="${esc(t("Cor de destaque"))}">${Object.entries(CORES).map(([k, v]) => `<button type="button" data-cor="${k}" style="background:${v}" aria-label="${esc(k)}" aria-pressed="${k === op.cor}"></button>`).join("")}</div>
      <label><input type="checkbox" id="fig-grade"> ${esc(t("Grade técnica"))}</label>
      <label><input type="checkbox" id="fig-sombra" checked> ${esc(t("Sombra"))}</label>
      <div class="abas" id="fig-fundo" role="group" aria-label="${esc(t("Fundo da prévia"))}">
        <button type="button" data-fundo="xadrez" aria-pressed="true">${esc(t("Transparente"))}</button>
        <button type="button" data-fundo="escuro" aria-pressed="false">${esc(t("Escuro"))}</button>
        <button type="button" data-fundo="claro" aria-pressed="false">${esc(t("Claro"))}</button>
        <label class="fig-foto"><input type="file" accept="image/*" id="fig-foto"><span>${esc(t("Sua foto"))}</span></label>
      </div>
    </div>
    <p class="fig-nota">${esc(t("O PNG sai sempre com o fundo transparente; o fundo aqui é só para ver como fica. A sua foto não sai do navegador."))}</p>
    <div class="fig-galeria fundo-xadrez"></div>`;
  const galeria = $(".fig-galeria", raiz);
  const select = $("#fig-treino");
  if (![...select.options].some((o) => o.value === id)) {
    const a = corridas.find((x) => String(x.id) === id);
    select.insertAdjacentHTML("afterbegin", a ? opcao(a) : `<option value="${esc(id)}">${esc(id)}</option>`);
  }
  select.value = id;

  let D = null;
  async function carregarTreino() {
    const a = await buscarJSON(`data/atividades/${id}.json`);
    const x = await buscarJSON(`data/local/figuras/${id}.json`, true).catch(() => null);
    const data = dataLocal(a.d);
    const anterior = edicaoAnterior(a, data, site.atividades.filter((b) => b.grupo === "corrida"));
    const arqAnterior = anterior ? await buscarJSON(`data/atividades/${anterior.id}.json`, true).catch(() => null) : null;
    D = {
      a,
      x,
      data,
      zonas: (site.zonas_fc || []).filter((z) => z.max !== 0),
      atleta: site.atleta,
      evolucao,
      anterior: anterior ? { ...anterior, cad: arqAnterior?.cad } : null,
      tenis: (site.equipamento || []).find((g) => g.id === a.g)?.nome || null,
    };
  }

  function desenhar() {
    const prontas = FIGURAS.filter((f) => {
      try {
        return f.pronta(D);
      } catch {
        return false;
      }
    });
    galeria.innerHTML = prontas
      .map((f) => `<article class="fig-cartao" data-fig="${f.id}">
        <div class="fig-previa"${fotoUrl ? ` style="background-image:url(${fotoUrl})"` : ""}><img alt=""></div>
        <div class="fig-rodape"><h3>${esc(f.nome())}</h3><div class="fig-acoes">
          <button type="button" data-acao="baixar">${esc(t("Baixar"))}</button>
          <button type="button" data-acao="copiar">${esc(t("Copiar"))}</button>
          ${navigator.canShare ? `<button type="button" data-acao="compartilhar">${esc(t("Compartilhar"))}</button>` : ""}
        </div></div>
      </article>`)
      .join("");
    for (const f of prontas) {
      const cartao = $(`[data-fig="${f.id}"]`, galeria);
      try {
        const canvas = f.desenhar(D, op);
        cartao.canvas = canvas;
        const img = $("img", cartao);
        img.src = canvas.toDataURL("image/png");
        img.alt = t("Figura {nome} do treino {treino}", { nome: f.nome(), treino: limparNome(D.a.n) });
      } catch (erro) {
        cartao.querySelector(".fig-previa").innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
        console.error(f.id, erro);
      }
    }
  }

  // baixar, copiar (para colar no story do Instagram) e compartilhar (a folha do celular)
  galeria.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-acao]");
    if (!b) return;
    const cartao = b.closest(".fig-cartao");
    const nomeArq = `oceanthief-${id}-${cartao.dataset.fig}.png`;
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
        const url = URL.createObjectURL(await pngDe(cartao.canvas));
        const link = Object.assign(document.createElement("a"), { href: url, download: nomeArq });
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        marcar(t("Baixado"));
      } else if (b.dataset.acao === "copiar") {
        // o Safari exige a promessa dentro do ClipboardItem, criada no próprio clique
        await navigator.clipboard.write([new ClipboardItem({ "image/png": pngDe(cartao.canvas) })]);
        marcar(t("Copiado"));
      } else {
        const arquivo = new File([await pngDe(cartao.canvas)], nomeArq, { type: "image/png" });
        if (navigator.canShare?.({ files: [arquivo] })) await navigator.share({ files: [arquivo] });
        else marcar(t("Não dá neste navegador"));
      }
    } catch (erro) {
      if (erro?.name !== "AbortError") marcar(t("Não deu certo"));
    }
  });

  raiz.addEventListener("click", (ev) => {
    const cor = ev.target.closest("[data-cor]");
    if (cor) {
      op.cor = cor.dataset.cor;
      $$(".fig-cores button", raiz).forEach((x) => x.setAttribute("aria-pressed", String(x === cor)));
      desenhar();
    }
    const f = ev.target.closest("[data-fundo]");
    if (f) {
      fundo = f.dataset.fundo;
      fotoUrl = null;
      $$("#fig-fundo button", raiz).forEach((x) => x.setAttribute("aria-pressed", String(x === f)));
      galeria.className = `fig-galeria fundo-${fundo}`;
      desenhar();
    }
  });
  $("#fig-grade").onchange = (ev) => {
    op.grade = ev.target.checked;
    desenhar();
  };
  $("#fig-sombra").onchange = (ev) => {
    op.sombra = ev.target.checked;
    desenhar();
  };
  $("#fig-foto").onchange = (ev) => {
    const arq = ev.target.files?.[0];
    if (!arq) return;
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    fotoUrl = URL.createObjectURL(arq);
    $$("#fig-fundo button", raiz).forEach((x) => x.setAttribute("aria-pressed", "false"));
    galeria.className = "fig-galeria fundo-foto";
    desenhar();
  };
  select.onchange = async () => {
    id = select.value;
    history.replaceState(null, "", `?id=${id}`);
    await carregarTreino();
    desenhar();
  };

  await carregarTreino();
  desenhar();
} catch (erro) {
  raiz.innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
}
