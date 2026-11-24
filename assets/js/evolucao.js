// Página Evolução: como as marcas, o ritmo e o coração mudaram desde o começo.
import {
  $, abas, aoMudarUnidade, aoRedimensionar, buscarJSON, carregarTudo, dataCurta, dataLonga, dist, distTreino, esc,
  iniciarDicas, linkTreino, MESES_CURTOS, montarRodape, montarTopo, NOMES_ESFORCO, nomeSite, nomeTopo, num, pace, paceSeg,
  getUnidade, relogio, rotuloDist, t,
} from "./comum.js";
import { DISTANCIAS, esforcosEm, previsoes, provaAlvo } from "./previsao.js";

let S, P, PL, A, E, CORRIDAS, porId;
const estado = { distancia: "5K" };

async function iniciar() {
  try {
    ({ site: S, perfil: P, plano: PL } = await carregarTudo());
    E = (await buscarJSON("data/evolucao.json", true)) || { esforcos: {}, meses: [] };
  } catch (erro) {
    $("#evolucao").innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
    return;
  }
  A = S.atividades;
  CORRIDAS = A.filter((a) => a.grupo === "corrida").sort((x, y) => x.data - y.data);
  porId = new Map(A.map((a) => [a.id, a]));
  document.title = t("Evolução: {nome}", { nome: nomeSite(S, P) });
  montarTopo({ nome: nomeTopo(S, P), pagina: "evolucao", plano: PL?.semanas?.length > 0 });
  montarRodape(S, P);
  if (!CORRIDAS.length) {
    $("#evolucao").innerHTML = `<p class="vazio">${t("Nenhum treino ainda")}</p>`;
    return;
  }
  desenhar();
  aoMudarUnidade(desenhar);
  aoRedimensionar(desenharGraficos);
  iniciarDicas();
}

// ------------------------------------------------------------------ dados
const nomeDist = (nome) => NOMES_ESFORCO[nome] || nome;
const quantil = (lista, q) => {
  const v = [...lista].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.round(q * (v.length - 1))))];
};
// todos os esforços numa distância: o melhor trecho de cada corrida, mais o tempo oficial das provas
const esforcos = (nome) => esforcosEm(E, CORRIDAS, porId, nome);

// a sequência de recordes: cada vez que o melhor tempo caiu
function recordes(lista) {
  const r = [];
  for (const x of lista) if (!r.length || x.t < r.at(-1).t) r.push(x);
  return r;
}

const disponiveis = () => DISTANCIAS.filter(([nome]) => esforcos(nome).length >= 2);

// ------------------------------------------------------------------ página
function desenhar() {
  const primeira = CORRIDAS[0];
  const faixa = [[t("Correndo desde"), `${MESES_CURTOS[primeira.data.getMonth()]} ${primeira.data.getFullYear()}`, ""]];
  for (const nome of ["5K", "10K", "Half-Marathon", "Marathon"]) {
    const lista = esforcos(nome);
    if (!lista.length) continue;
    const r = recordes(lista);
    const ganho = r[0].t - r.at(-1).t;
    faixa.push([
      t("Melhor {d}", { d: nomeDist(nome).toLowerCase() }),
      relogio(r.at(-1).t),
      ganho > 0 ? t("{d} a menos que na primeira vez", { d: relogio(ganho) }) : "",
    ]);
    if (faixa.length >= 4) break;
  }

  const opcoes = disponiveis();
  if (!opcoes.some(([n]) => n === estado.distancia)) estado.distancia = opcoes[0]?.[0] || "5K";

  $("#evolucao").innerHTML = `
    <header class="pagina-cabeca"><h1>${t("Evolução")}</h1></header>
    <dl class="faixa-numeros faixa-pagina">${faixa
      .map(([dt, dd, extra]) => `<div class="num-capa">${extra ? `<dd class="variacao">${esc(extra)}</dd>` : ""}<dt class="rotulo">${esc(dt)}</dt><dd class="valor">${esc(dd)}</dd></div>`)
      .join("")}</dl>

    <section class="secao secao-pagina" id="marcas">
      <div class="secao-cabeca com-acoes"><h2>${t("Recordes ao longo do tempo")}</h2><div class="abas" id="abas-marcas"></div></div>
      <div class="cartao-grafico">
        <div class="grafico" id="g-marcas"></div>
        <div class="legenda-evolucao">
          <span><i class="leg-linha"></i>${t("Recorde da época")}</span>
          <span><i class="leg-ponto"></i>${t("Melhor trecho de uma corrida")}</span>
          <span><i class="leg-ponto oficial"></i>${t("Prova")}</span>
        </div>
      </div>
      <div class="degraus" id="degraus"></div>
    </section>

    ${previsao()}

    <section class="secao secao-pagina" id="meses">
      <div class="secao-cabeca"><h2>${t("Mês a mês")}</h2></div>
      <div class="grade-evolucao" id="grade-meses"></div>
    </section>

    <section class="secao secao-pagina" id="anos">
      <div class="secao-cabeca"><h2>${t("Ano a ano")}</h2></div>
      ${anoAno()}
    </section>`;

  abas($("#abas-marcas"), opcoes.map(([nome]) => ({ valor: nome, rotulo: nomeDist(nome) })), estado.distancia, (v) => {
    estado.distancia = v;
    desenharMarcas();
  });
  desenharGraficos();
}

function desenharGraficos() {
  desenharMarcas();
  desenharMeses();
}

// ------------------------------------------------------------- recordes
function desenharMarcas() {
  const el = $("#g-marcas");
  if (!el) return;
  const lista = esforcos(estado.distancia);
  const r = recordes(lista);
  graficoMarcas(el, lista, r);

  // os degraus: cada recorde novo e quanto ele baixou
  $("#degraus").innerHTML = `<h3 class="bloco-titulo">${t("Cada recorde novo")}</h3><ol class="lista-degraus">${r
    .map((x, i) => {
      const ganho = i ? r[i - 1].t - x.t : 0;
      return `<li><a href="${linkTreino(x.id)}"><span class="quando">${esc(dataCurta(x.data))} ${x.data.getFullYear()}</span><b>${relogio(x.t)}</b><span class="ganho">${i ? `−${relogio(ganho)}` : t("primeiro")}</span></a></li>`;
    })
    .reverse()
    .join("")}</ol>`;
}

function passoTempo(intervalo, marcas = 5) {
  return [5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1800, 3600].find((p) => intervalo / p <= marcas) || 7200;
}

function graficoMarcas(el, lista, r) {
  const largura = Math.max(300, el.clientWidth || 800);
  const altura = largura < 600 ? 260 : 320;
  const m = { t: 18, r: 54, b: 28, l: 52 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;
  const x0 = new Date(CORRIDAS[0].data.getFullYear(), CORRIDAS[0].data.getMonth(), 1).getTime();
  const x1 = Date.now();
  const x = (d) => m.l + ((d.getTime() - x0) / (x1 - x0)) * w;
  const tempos = lista.map((p) => p.t);
  const lo0 = Math.min(...tempos);
  // os trechos muito lentos (um treino leve inteiro) ficam presos na borda de baixo, para não achatar o resto
  const hi0 = lista.length > 12 ? quantil(tempos, 0.9) : Math.max(...tempos);
  const folga = Math.max((hi0 - lo0) * 0.08, 5);
  const lo = lo0 - folga;
  const hi = hi0 + folga;
  const y = (v) => m.t + ((Math.min(v, hi) - lo) / (hi - lo)) * h; // mais rápido em cima

  let corpo = "";
  const passo = passoTempo(hi - lo);
  for (let v = Math.ceil(lo / passo) * passo; v <= hi; v += passo) {
    corpo += `<line class="grade" x1="${m.l}" x2="${largura - m.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
    corpo += `<text x="${m.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${relogio(v)}</text>`;
  }
  // meses no eixo de baixo: de 3 em 3 ou de 6 em 6, conforme o espaço
  const totalMeses = (new Date(x1).getFullYear() - new Date(x0).getFullYear()) * 12 + new Date(x1).getMonth() - new Date(x0).getMonth();
  const cada = [1, 2, 3, 6, 12].find((c) => (totalMeses / c) * 64 <= w) || 12;
  for (let d = new Date(x0); d.getTime() <= x1; d.setMonth(d.getMonth() + 1)) {
    const k = d.getFullYear() * 12 + d.getMonth();
    if (k % cada) continue;
    const px = x(d);
    corpo += `<line class="marca-mes" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${m.t + h}" y2="${m.t + h + 4}"/>`;
    corpo += `<text x="${px.toFixed(1)}" y="${altura - 6}" text-anchor="middle">${d.getMonth() === 0 || cada >= 12 ? d.getFullYear() : MESES_CURTOS[d.getMonth()]}</text>`;
  }
  corpo += `<line class="eixo" x1="${m.l}" x2="${largura - m.r}" y1="${m.t + h}" y2="${m.t + h}"/>`;

  // cada esforço: um ponto (as provas em vermelho); o alvo de toque é maior que o ponto
  for (const p of lista) {
    const cx = x(p.data).toFixed(1);
    const cy = y(p.t).toFixed(1);
    const dica = `${dataLonga(p.data)}\n${relogio(p.t)}, ${pace(DISTANCIAS.find(([n]) => n === estado.distancia)[1], p.t)}${p.a ? `\n${p.a.n}` : ""}`;
    corpo += `<a href="${linkTreino(p.id)}"><circle class="pt${p.oficial ? " oficial" : ""}" cx="${cx}" cy="${cy}" r="3.2"/><circle class="alvo-toque" cx="${cx}" cy="${cy}" r="9" data-dica="${esc(dica)}"/></a>`;
  }

  // a linha dos recordes, em degraus, até hoje
  if (r.length) {
    let d = `M${x(r[0].data).toFixed(1)} ${y(r[0].t).toFixed(1)}`;
    for (let i = 1; i < r.length; i++) d += `H${x(r[i].data).toFixed(1)}V${y(r[i].t).toFixed(1)}`;
    d += `H${(largura - m.r).toFixed(1)}`;
    corpo += `<path class="linha-recorde" d="${d}"/>`;
    for (const p of r) corpo += `<circle class="pt-recorde" cx="${x(p.data).toFixed(1)}" cy="${y(p.t).toFixed(1)}" r="4.5"/>`;
    const ult = r.at(-1);
    corpo += `<text class="rotulo-recorde" x="${(largura - m.r + 6).toFixed(1)}" y="${(y(ult.t) + 4).toFixed(1)}">${relogio(ult.t)}</text>`;
  }
  el.innerHTML = `<svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="${esc(t("Recordes em {d} ao longo do tempo", { d: nomeDist(estado.distancia) }))}">${corpo}</svg>`;
}

// ------------------------------------------------------------- previsão
// Fórmula de Riegel (previsao.js), pelo melhor tempo dos últimos 12 meses em cada distância
function previsao() {
  const { dist: distAlvo, nome: nomeAlvo, meta } = provaAlvo(P);
  const cartoes = [];
  for (const { nome, melhor, previsto } of previsoes(E, CORRIDAS, porId, distAlvo)) {
    let comparacao = "";
    if (meta) {
      const dif = Math.round(meta - previsto);
      comparacao = Math.abs(dif) < 30 ? t("Na meta") : dif > 0 ? t("{d} abaixo da meta", { d: relogio(dif) }) : t("{d} acima da meta", { d: relogio(-dif) });
    }
    cartoes.push(`<article class="cartao-previsao">
      <p>${esc(t("Pelo seu melhor {d}", { d: nomeDist(nome).toLowerCase() }))}</p>
      <strong>${relogio(previsto)}</strong>
      <a href="${linkTreino(melhor.id)}">${esc(t("{tempo} em {data}", { tempo: relogio(melhor.t), data: dataLonga(melhor.data) }))}</a>
      ${comparacao ? `<span class="comparacao${meta && previsto <= meta ? " dentro" : ""}">${esc(comparacao)}</span>` : ""}
    </article>`);
  }
  if (!cartoes.length) return "";
  return `<section class="secao secao-pagina" id="previsao">
    <div class="secao-cabeca"><h2>${esc(t("Previsão para a {prova}", { prova: nomeAlvo }))}</h2></div>
    <div class="previsoes">${cartoes.join("")}${meta ? `<article class="cartao-previsao meta"><p>${t("Meta")}</p><strong>${relogio(meta)}</strong><span>${esc(pace(distAlvo, meta))}</span></article>` : ""}</div>
    <p class="nota-pagina">${t("Conta feita com a fórmula de Riegel, a partir do melhor tempo dos últimos 12 meses em cada distância. Para a maratona ela costuma ser otimista: vale como referência, não como promessa.")}</p>
  </section>`;
}

// ------------------------------------------------------------- mês a mês
function desenharMeses() {
  const el = $("#grade-meses");
  if (!el) return;
  const meses = (E.meses || []).map((x) => {
    const [ano, mes] = x.mes.split("-").map(Number);
    return { ...x, data: new Date(ano, mes - 1, 15), nomeMes: `${MESES_CURTOS[mes - 1]} ${ano}` };
  });
  const mi = getUnidade() === "mi";
  const series = [
    {
      id: "ritmo", titulo: t("Ritmo médio"), largo: true, inverter: true, melhor: "menor", minimo: 30, passo: true,
      pontos: meses.filter((x) => x.m > 0).map((x) => ({ ...x, y: paceSeg(x.m, x.s) })),
      fmt: (v) => `${relogio(v)} /${rotuloDist()}`, eixo: (v) => relogio(v),
    },
    {
      id: "fc", titulo: t("Frequência cardíaca média"), melhor: "menor", minimo: 10,
      pontos: meses.filter((x) => x.hr).map((x) => ({ ...x, y: x.hr })),
      fmt: (v) => `${num(v)} bpm`, eixo: (v) => num(v),
    },
    {
      id: "leve", titulo: t("Ritmo nas corridas leves"), inverter: true, melhor: "menor", minimo: 30, passo: true,
      dica: t("Corridas com a frequência cardíaca média na zona 2. Se o ritmo sobe com o mesmo esforço, o fôlego melhorou."),
      pontos: meses.filter((x) => x.leve_m > 1000).map((x) => ({ ...x, y: paceSeg(x.leve_m, x.leve_s) })),
      fmt: (v) => `${relogio(v)} /${rotuloDist()}`, eixo: (v) => relogio(v),
    },
    {
      id: "mpb", titulo: t("Distância por batimento"), melhor: "maior", minimo: mi ? 0.3 : 0.1,
      dica: t("Quantos metros você corre a cada batida do coração. Sobe quando o mesmo esforço rende mais."),
      pontos: meses.filter((x) => x.mpb).map((x) => ({ ...x, y: mi ? x.mpb * 3.28084 : x.mpb })),
      fmt: (v) => `${num(v, 2)} ${mi ? t("pés") : "m"}`, eixo: (v) => num(v, 2),
    },
    {
      id: "cad", titulo: t("Cadência"), minimo: 8,
      dica: t("Passos por minuto, somando as duas pernas."),
      pontos: meses.filter((x) => x.cad).map((x) => ({ ...x, y: x.cad })),
      fmt: (v) => `${num(v)} ${t("passos/min")}`, eixo: (v) => num(v),
    },
  ].filter((s) => s.pontos.length >= 2);

  el.innerHTML =
    series
      .map((s) => {
        const ult = s.pontos.at(-1);
        const pri = s.pontos[0];
        const dif = ult.y - pri.y;
        const melhorou = s.melhor === "menor" ? dif < 0 : s.melhor === "maior" ? dif > 0 : false;
        const sinal = dif > 0 ? "+" : "−";
        const difTexto = Math.abs(dif) < 1e-9 ? "" : `${sinal}${s.inverter ? relogio(Math.abs(dif)) : s.eixo(Math.abs(dif))} ${t("desde {mes}", { mes: pri.nomeMes })}`;
        return `<article class="cartao-grafico cartao-mes${s.largo ? " largo" : ""}">
          <div class="cartao-mes-topo">
            <h3${s.dica ? ` class="com-dica" tabindex="0" data-dica="${esc(s.dica)}"` : ""}>${esc(s.titulo)}</h3>
            <p><b>${esc(s.fmt(ult.y))}</b>${difTexto ? `<span class="${melhorou ? "melhorou" : ""}">${esc(difTexto)}</span>` : ""}</p>
          </div>
          <div class="grafico" id="g-${s.id}"></div>
        </article>`;
      })
      .join("") + dispersaoCartao();

  for (const s of series) miniSerie($(`#g-${s.id}`), s);
  desenharDispersao();
}

function miniSerie(el, s) {
  const largura = Math.max(260, el.clientWidth || 500);
  const altura = s.largo ? 200 : 150;
  const m = { t: 10, r: 10, b: 24, l: 48 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;
  const xs = s.pontos.map((p) => p.data.getTime());
  const x0 = Math.min(...xs) - 15 * 864e5;
  const x1 = Math.max(...xs) + 15 * 864e5;
  const x = (d) => m.l + ((d.getTime() - x0) / (x1 - x0)) * w;
  const ys = s.pontos.map((p) => p.y);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  const falta = s.minimo - (hi - lo);
  if (falta > 0) {
    lo -= falta / 2;
    hi += falta / 2;
  }
  const folga = (hi - lo) * 0.1;
  lo -= folga;
  hi += folga;
  const y = (v) => m.t + (s.inverter ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)) * h;

  let corpo = "";
  // o maior passo redondo que ainda deixa pelo menos duas marcas no eixo
  const candidatos = s.passo ? [5, 10, 15, 20, 30, 60, 120, 300, 600] : [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100];
  const marcas = (p) => Math.floor(hi / p) - Math.ceil(lo / p) + 1;
  const passo = [...candidatos].reverse().find((p) => marcas(p) >= 2 && marcas(p) <= 4) || candidatos[0];
  for (let v = Math.ceil(lo / passo) * passo; v <= hi + 1e-9; v += passo) {
    corpo += `<line class="grade" x1="${m.l}" x2="${largura - m.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
    corpo += `<text x="${m.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(s.eixo(v))}</text>`;
  }
  const cada = Math.max(1, Math.ceil(s.pontos.length / Math.max(2, Math.floor(w / 58))));
  s.pontos.forEach((p, i) => {
    if (i % cada && i !== s.pontos.length - 1) return;
    const mes = p.data.getMonth();
    corpo += `<text x="${x(p.data).toFixed(1)}" y="${altura - 6}" text-anchor="middle">${mes === 0 || i === 0 ? `${MESES_CURTOS[mes]} ${String(p.data.getFullYear()).slice(2)}` : MESES_CURTOS[mes]}</text>`;
  });
  corpo += `<path class="linha-mes" d="${s.pontos.map((p, i) => `${i ? "L" : "M"}${x(p.data).toFixed(1)} ${y(p.y).toFixed(1)}`).join("")}"/>`;
  for (const p of s.pontos) {
    const cx = x(p.data).toFixed(1);
    const cy = y(p.y).toFixed(1);
    corpo += `<circle class="pt-mes" cx="${cx}" cy="${cy}" r="3.5"/><circle class="alvo-toque" cx="${cx}" cy="${cy}" r="11" data-dica="${esc(`${p.nomeMes}\n${s.fmt(p.y)}\n${t("{n} corridas", { n: num(p.n) })}`)}"/>`;
  }
  el.innerHTML = `<svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="${esc(s.titulo)}">${corpo}</svg>`;
}

// ritmo × FC de cada corrida desde que o relógio mede o coração; as mais recentes ficam mais fortes
function corridasComFc() {
  return CORRIDAS.filter((a) => a.hr && a.m >= 2000 && a.s > 0 && !a.in);
}

// as corridas com FC divididas em duas metades do período: as primeiras e as mais recentes
function periodos() {
  const lista = corridasComFc();
  const t0 = lista[0].data.getTime();
  const meio = t0 + (lista.at(-1).data.getTime() - t0) / 2;
  const antes = lista.filter((a) => a.data.getTime() < meio);
  const depois = lista.filter((a) => a.data.getTime() >= meio);
  const nome = (l) => {
    const a = l[0].data;
    const b = l.at(-1).data;
    const fim = `${MESES_CURTOS[b.getMonth()]} ${b.getFullYear()}`;
    return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? fim : t("{a} a {b}", { a: MESES_CURTOS[a.getMonth()], b: fim });
  };
  return [
    { lista: antes, nome: nome(antes), classe: "antes" },
    { lista: depois, nome: nome(depois), classe: "depois" },
  ].filter((g) => g.lista.length);
}

function dispersaoCartao() {
  const lista = corridasComFc();
  if (lista.length < 8) return "";
  const grupos = periodos();
  return `<article class="cartao-grafico cartao-mes largo">
    <div class="cartao-mes-topo"><h3 class="com-dica" tabindex="0" data-dica="${esc(t("Cada ponto é uma corrida. Se a linha das corridas recentes fica acima da outra, você ficou mais rápido com o coração no mesmo ritmo."))}">${t("Ritmo e frequência cardíaca de cada corrida")}</h3></div>
    <div class="grafico" id="g-dispersao"></div>
    <div class="legenda-evolucao">${grupos.map((g) => `<span><i class="leg-ponto ${g.classe}"></i>${esc(g.nome)}</span>`).join("")}</div>
  </article>`;
}

// reta de tendência (mínimos quadrados) do ritmo em função da FC
function tendencia(lista) {
  const n = lista.length;
  if (n < 5) return null;
  const xs = lista.map((a) => a.hr);
  const ys = lista.map((a) => paceSeg(a.m, a.s));
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num_ = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num_ += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const b = den ? num_ / den : 0;
  return { de: quantil(xs, 0.1), ate: quantil(xs, 0.9), y: (x) => my + b * (x - mx) };
}

function desenharDispersao() {
  const el = $("#g-dispersao");
  if (!el) return;
  const lista = corridasComFc();
  const grupos = periodos();
  const largura = Math.max(280, el.clientWidth || 700);
  const altura = largura < 600 ? 280 : 340;
  const m = { t: 12, r: 12, b: 42, l: 56 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;
  const fcs = lista.map((a) => a.hr);
  const paces = lista.map((a) => paceSeg(a.m, a.s));
  const fx0 = quantil(fcs, 0.02) - 3;
  const fx1 = quantil(fcs, 0.98) + 3;
  const py0 = quantil(paces, 0.03) - 8;
  const py1 = quantil(paces, 0.97) + 8;
  const x = (v) => m.l + ((Math.min(fx1, Math.max(fx0, v)) - fx0) / (fx1 - fx0)) * w;
  const y = (v) => m.t + ((Math.min(py1, Math.max(py0, v)) - py0) / (py1 - py0)) * h; // mais rápido em cima
  let corpo = "";
  const passoP = passoTempo(py1 - py0);
  for (let v = Math.ceil(py0 / passoP) * passoP; v <= py1; v += passoP) {
    corpo += `<line class="grade" x1="${m.l}" x2="${largura - m.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${m.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${relogio(v)}</text>`;
  }
  const passoF = fx1 - fx0 > 40 ? 10 : 5;
  for (let v = Math.ceil(fx0 / passoF) * passoF; v <= fx1; v += passoF) {
    corpo += `<text x="${x(v).toFixed(1)}" y="${m.t + h + 16}" text-anchor="middle">${v}</text>`;
  }
  corpo += `<line class="eixo" x1="${m.l}" x2="${largura - m.r}" y1="${m.t + h}" y2="${m.t + h}"/>`;
  corpo += `<text x="${m.l + w / 2}" y="${altura - 4}" text-anchor="middle">${esc(t("Frequência cardíaca média (bpm)"))}</text>`;
  corpo += `<text x="14" y="${m.t + h / 2}" text-anchor="middle" transform="rotate(-90 14 ${m.t + h / 2})">${esc(t("Ritmo (mais rápido em cima)"))}</text>`;
  for (const g of grupos) {
    for (const a of g.lista) {
      const cx = x(a.hr).toFixed(1);
      const cy = y(paceSeg(a.m, a.s)).toFixed(1);
      corpo += `<a href="${linkTreino(a.id)}"><circle class="pt-disp ${g.classe}" cx="${cx}" cy="${cy}" r="4" data-dica="${esc(`${dataLonga(a.data)}\n${a.n}\n${pace(a.m, a.s)}, ${num(a.hr)} bpm, ${distTreino(a.m)}`)}"/></a>`;
    }
  }
  for (const g of grupos) {
    const r = tendencia(g.lista);
    if (r) corpo += `<line class="tendencia ${g.classe}" x1="${x(r.de).toFixed(1)}" y1="${y(r.y(r.de)).toFixed(1)}" x2="${x(r.ate).toFixed(1)}" y2="${y(r.y(r.ate)).toFixed(1)}"/>`;
  }
  el.innerHTML = `<svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="${esc(t("Ritmo e frequência cardíaca de cada corrida"))}">${corpo}</svg>`;
}

// ------------------------------------------------------------- ano a ano
function anoAno() {
  const anos = [...new Set(CORRIDAS.map((a) => a.ano))].sort((x, y) => y - x);
  const melhores = Object.fromEntries(["5K", "10K", "Half-Marathon"].map((n) => [n, esforcos(n)]));
  const linhas = anos.map((ano) => {
    const doAno = CORRIDAS.filter((a) => a.ano === ano);
    const m = doAno.reduce((s, a) => s + a.m, 0);
    const s = doAno.reduce((x, a) => x + a.s, 0);
    const comFc = doAno.filter((a) => a.hr);
    const fcS = comFc.reduce((x, a) => x + a.s, 0);
    const fc = fcS ? comFc.reduce((x, a) => x + a.hr * a.s, 0) / fcS : null;
    const longa = doAno.reduce((x, a) => (a.m > (x?.m || 0) ? a : x), null);
    const melhor = (n) => {
      const l = melhores[n].filter((x) => x.data.getFullYear() === ano);
      return l.length ? relogio(Math.min(...l.map((x) => x.t))) : "–";
    };
    return `<tr>
      <td><b>${ano}</b></td>
      <td class="num">${num(doAno.length)}</td>
      <td class="num">${esc(dist(m))}</td>
      <td class="num">${esc(pace(m, s))}</td>
      <td class="num">${fc ? `${num(fc)} bpm` : "–"}</td>
      <td class="num">${longa ? `<a href="${linkTreino(longa.id)}">${esc(distTreino(longa.m))}</a>` : "–"}</td>
      <td class="num">${melhor("5K")}</td>
      <td class="num">${melhor("10K")}</td>
      <td class="num">${melhor("Half-Marathon")}</td>
      <td class="num">${num(doAno.filter((a) => a.prova).length)}</td>
    </tr>`;
  });
  return `<div class="tabela-rolagem"><table class="resultados ano-a-ano">
    <thead><tr><th>${t("Ano")}</th><th class="num">${t("Corridas")}</th><th class="num">${t("Distância")}</th><th class="num">${t("Ritmo médio")}</th><th class="num">${t("FC média")}</th><th class="num">${t("Mais longa")}</th><th class="num">${esc(nomeDist("5K"))}</th><th class="num">${esc(nomeDist("10K"))}</th><th class="num">${esc(nomeDist("Half-Marathon"))}</th><th class="num">${t("Provas")}</th></tr></thead>
    <tbody>${linhas.join("")}</tbody></table></div>`;
}

iniciar();
