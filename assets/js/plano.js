import {
  $, $$, aoMudarUnidade, aoRedimensionar, carregarTudo, contagemRegressiva, dataCurta, dataLonga, diaSemana, dist, distValor,
  DIAS_CURTOS, esc, hora, iniciarDicas, linkTreino, MESES_CURTOS, montarRodape, montarTopo, nomeSite, nomeTopo, num, relogio, rotuloDist,
  getUnidade, plural, t, tx,
} from "./comum.js";

iniciarDicas();
let S, P, PL, semanas;
const abertas = new Set();

iniciar();

async function iniciar() {
  try {
    ({ site: S, perfil: P, plano: PL } = await carregarTudo());
  } catch (erro) {
    $("#plano").innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
    return;
  }
  const temSemanas = PL?.semanas?.length > 0;
  montarTopo({ nome: nomeTopo(S, P), secoes: temSemanas ? [["#volume", t("Volume")], ["#semanas", t("Semana a semana")]] : [], pagina: "plano", plano: temSemanas });
  montarRodape(S, P);
  if (PL?.rascunho) {
    $("#plano").innerHTML = `<a class="voltar" href="./">${t("Voltar para o início")}</a><section class="secao" style="padding-top:2rem">
      <h2>${t("O plano ainda está sendo montado")}</h2><p class="sub">${esc(t("O plano de treino para a {prova} aparece aqui assim que estiver pronto.", { prova: tx(PL.prova?.nome) || t("próxima prova") }))}</p></section>`;
    return;
  }
  if (!temSemanas) {
    $("#plano").innerHTML = `<a class="voltar" href="./">${t("Voltar para o início")}</a><section class="secao" style="padding-top:2rem">
      <h2>${t("Nenhum plano cadastrado")}</h2><p class="sub">${t("Escreva o seu plano em config/plano.json e ele aparece aqui, com o que você já fez no Strava ao lado.")}</p></section>`;
    return;
  }
  document.title = t("Plano: {nome}", { nome: PL.prova?.nome || t("próxima prova") });

  const corridas = S.atividades.filter((a) => ["Run", "TrailRun", "VirtualRun"].includes(a.t));
  const hoje = new Date();
  semanas = PL.semanas.map((s, i) => {
    const ini = new Date(`${s.inicio}T00:00`);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + 7);
    const feitas = corridas.filter((a) => a.data >= ini && a.data < fim);
    return { ...s, n: i + 1, ini, fim, feitas, feito: feitas.reduce((t, a) => t + a.m, 0), passou: fim <= hoje, atual: ini <= hoje && hoje < fim };
  });
  const atual = semanas.find((s) => s.atual);
  if (atual) abertas.add(atual.n);
  desenhar();
  aoMudarUnidade(desenhar);
  aoRedimensionar(grafico);
}

function intervalo(ini) {
  const fim = new Date(ini);
  fim.setDate(fim.getDate() + 6);
  return ini.getMonth() === fim.getMonth()
    ? t("{a} a {b} {mes}", { a: ini.getDate(), b: fim.getDate(), mes: MESES_CURTOS[fim.getMonth()] })
    : t("{a} {m1} a {b} {m2}", { a: ini.getDate(), m1: MESES_CURTOS[ini.getMonth()], b: fim.getDate(), m2: MESES_CURTOS[fim.getMonth()] });
}

function paceAlvo(texto) {
  if (!texto) return "";
  const [m, s] = texto.split(":").map(Number);
  const seg = m * 60 + (s || 0);
  return `${relogio(getUnidade() === "mi" ? seg * 1.609344 : seg)} /${rotuloDist()}`;
}

function desenhar() {
  const prova = PL.prova || {};
  const data = prova.data ? new Date(prova.data) : null;
  const futura = data && data > new Date();
  const atual = semanas.find((s) => s.atual);
  const planejado = semanas.reduce((t, s) => t + (s.km || 0), 0);
  const feito = semanas.reduce((t, s) => t + s.feito, 0);
  const fases = PL.fases || {};
  const usadas = [...new Set(semanas.map((s) => s.fase))];

  $("#plano").innerHTML = `
    <a class="voltar" href="./">${t("Voltar para o início")}</a>
    <section class="plano-cabeca">
      <div>
        <h1>${esc(prova.nome || t("Próxima prova"))}</h1>
        <p class="quando">${data ? esc(t("{dia}, {data}, às {hora}", { dia: diaSemana(data), data: dataLonga(data), hora: hora(data) })) : ""}${prova.cidade ? esc(t(", em {lugar}", { lugar: tx(prova.cidade) })) : ""}. ${esc(t("Plano de {n} semanas, {d} no total.", { n: semanas.length, d: dist(planejado * 1000, 0) }))}</p>
        ${/^https?:\/\//.test(prova.link || "") ? `<p class="quando"><a href="${esc(prova.link)}" target="_blank" rel="noopener">${t("Página da prova")}</a></p>` : ""}
      </div>
      <dl class="metas">
        ${futura ? `<div style="grid-column:1/-1"><dt>${t("Falta")}</dt><dd><div class="relogio" id="relogio-plano"></div></dd></div>` : ""}
        ${prova.meta ? `<div><dt>${t("Meta")}</dt><dd>${esc(tx(prova.meta))}</dd></div>` : ""}
        ${prova.meta_pace ? `<div><dt>${t("Ritmo alvo")}</dt><dd>${esc(paceAlvo(prova.meta_pace))}</dd></div>` : ""}
        <div><dt>${atual ? t("Semana atual") : futura ? t("Começa em") : t("Situação")}</dt><dd>${atual ? t("{a} de {b}", { a: atual.n, b: semanas.length }) : futura && semanas[0].ini > new Date() ? plural(Math.ceil((semanas[0].ini - new Date()) / 864e5), "{n} dia", "{n} dias") : t("Concluído")}</dd></div>
        <div><dt>${t("Corrido no plano")}</dt><dd>${esc(dist(feito, 0))}</dd></div>
      </dl>
    </section>

    <section class="secao" id="volume" style="padding-top:2.5rem">
      <div class="secao-cabeca"><h2>${t("Volume")}</h2></div>
      <div class="grafico" id="g-plano"></div>
      <div class="legenda-fases"><span><i class="leg-plan"></i>${t("Planejado")}</span><span><i class="leg-feito"></i>${t("Corrido")}</span>${usadas.map((f) => `<span><i style="background:var(--fase-${esc(f)})"></i>${esc(tx(fases[f] || f))}</span>`).join("")}</div>
    </section>

    <section class="secao" id="semanas">
      <div class="secao-cabeca"><h2>${t("Semana a semana")}</h2></div>
      <ol class="semanas">${semanas.map(itemSemana).join("")}</ol>
    </section>`;

  if (futura) contagemRegressiva($("#relogio-plano"), data);
  grafico();
  $(".semanas").onclick = (ev) => {
    const b = ev.target.closest(".semana > button");
    if (!b) return;
    alternar(+b.closest(".semana").dataset.n);
  };
}

function alternar(n, abrir) {
  const li = $(`.semana[data-n="${n}"]`);
  const aberta = abrir ?? !abertas.has(n);
  if (aberta) abertas.add(n);
  else abertas.delete(n);
  li.classList.toggle("aberta", aberta);
  $("button", li).setAttribute("aria-expanded", String(aberta));
  $(".semana-corpo", li).hidden = !aberta;
}

function itemSemana(s) {
  const fases = PL.fases || {};
  const aberta = abertas.has(s.n);
  const treinos = (s.treinos || []).map((w) => {
    const dia = new Date(s.ini);
    dia.setDate(dia.getDate() + (w.dia ?? 0));
    return `<li class="${w.chave ? "chave" : ""}">
      <span class="dia">${DIAS_CURTOS[w.dia ?? 0]} ${dia.getDate()}</span>
      <span class="titulo">${esc(tx(w.titulo))}${w.chave ? ` <span class="selo-chave">${t("Treino-chave")}</span>` : ""}</span>
      ${w.detalhe ? `<span class="detalhe">${esc(tx(w.detalhe))}</span>` : ""}
      <span class="km">${w.km ? esc(dist(w.km * 1000, w.km % 1 ? 1 : 0)) : ""}</span></li>`;
  });
  const feitas = s.feitas.length
    ? t("No Strava nesta semana: {lista}.", { lista: s.feitas.map((a) => `<a href="${linkTreino(a.id)}">${esc(a.n)}</a> (${esc(dist(a.m))})`).join(", ") })
    : s.passou || s.atual ? t("Nenhuma corrida registrada no Strava nesta semana.") : "";
  return `<li class="semana${s.atual ? " atual" : ""}${aberta ? " aberta" : ""}" data-n="${s.n}" style="--cor-fase:var(--fase-${esc(s.fase)})">
    <button type="button" aria-expanded="${aberta}" aria-controls="corpo-${s.n}">
      <span class="num-semana">${s.n}</span>
      <span class="datas">${intervalo(s.ini)}${s.atual ? t(", esta semana") : ""}<span class="foco">${esc(tx(s.foco) || "")}</span></span>
      <span class="fase">${esc(tx(fases[s.fase] || s.fase))}</span>
      <span class="volume"><b>${esc(dist((s.km || 0) * 1000, 0))}</b>${s.passou || s.atual ? esc(t("feito: {d}", { d: dist(s.feito, 0) })) : t("planejado")}</span>
    </button>
    <div class="semana-corpo" id="corpo-${s.n}"${aberta ? "" : " hidden"}>
      <ul class="treinos-semana">${treinos.join("")}</ul>
      ${feitas ? `<p class="feito-semana">${feitas}</p>` : ""}
    </div>
  </li>`;
}

function grafico() {
  const el = $("#g-plano");
  if (!el) return;
  const largura = Math.max(300, el.clientWidth);
  const altura = 250;
  const m = { t: 10, r: 2, b: 24, l: 36 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;
  const valores = semanas.map((s) => ({ plan: distValor((s.km || 0) * 1000), feito: distValor(s.feito) }));
  const maximo = Math.max(1, ...valores.map((v) => Math.max(v.plan, v.feito)));
  const passo = maximo > 120 ? 40 : maximo > 60 ? 20 : 10;
  const topo = Math.ceil(maximo / passo) * passo;
  const y = (v) => m.t + h - (v / topo) * h;
  const banda = w / semanas.length;
  const bw = Math.max(4, banda - Math.min(10, banda * 0.25));
  let corpo = "";
  for (let v = 0; v <= topo; v += passo) {
    corpo += `<line class="${v ? "grade" : "eixo"}" x1="${m.l}" x2="${largura - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`;
  }
  semanas.forEach((s, i) => {
    const x = m.l + i * banda + (banda - bw) / 2;
    const cor = `var(--fase-${s.fase})`;
    const v = valores[i];
    const dica = `${t("Semana {n}, {datas}", { n: s.n, datas: intervalo(s.ini) })}\n${t("Planejado: {d}", { d: dist((s.km || 0) * 1000, 0) })}${s.passou || s.atual ? `\n${t("Feito: {d}", { d: dist(s.feito, 0) })}` : ""}`;
    corpo += `<g data-n="${s.n}" data-dica="${esc(dica)}" style="cursor:pointer"><rect x="${m.l + i * banda}" y="${m.t}" width="${banda}" height="${h}" fill="transparent"/>`;
    corpo += `<rect x="${x}" y="${y(v.plan)}" width="${bw}" height="${y(0) - y(v.plan)}" rx="2" style="fill:color-mix(in srgb, ${cor} 30%, var(--fundo))${s.atual ? ";stroke:var(--texto);stroke-width:1.5" : ""}"/>`;
    if (v.feito > 0) corpo += `<rect x="${x + bw * 0.2}" y="${y(v.feito)}" width="${bw * 0.6}" height="${y(0) - y(v.feito)}" rx="1.5" style="fill:${cor}"/>`;
    corpo += `</g>`;
    if (semanas.length <= 24 || i % 2 === 0) corpo += `<text x="${x + bw / 2}" y="${altura - 6}" text-anchor="middle">${s.n}</text>`;
  });
  el.innerHTML = `<svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="${esc(t("Volume planejado e feito por semana, em {u}", { u: rotuloDist() }))}">${corpo}</svg>`;
  el.onclick = (ev) => {
    const g = ev.target.closest("g[data-n]");
    if (!g) return;
    const n = +g.dataset.n;
    alternar(n, true);
    $(`.semana[data-n="${n}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
  };
}
