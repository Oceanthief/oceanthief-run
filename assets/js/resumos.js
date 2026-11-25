// Resumos do mês e do ano para compartilhar: cinco modelos no tamanho do story (1080 × 1920).
// Cada um compara o período com o anterior: o mês com o mês anterior do mesmo ano (janeiro fica sem
// comparação) e o ano com o ano anterior. Se o período ainda não acabou, a comparação usa os mesmos dias
// do anterior (de 1 a 25 de novembro contra de 1 a 25 de outubro), para não pôr um mês pela metade
// contra um mês inteiro.
//
// Os cinco seguem o mesmo sistema: o cabeçalho com a marca e o esporte, o período em letra condensada
// grande, rótulos na letra do site (Manrope), a seta ▲ na cor de destaque quando o número subiu e ▼ em
// branco apagado quando desceu, e o endereço do site no pé. O fundo é o café do site, ou transparente.
import { chaveDia, dataCurta, DIAS_CURTOS, distValor, getUnidade, GRUPOS, inicioSemana, LOCALE, MESES_CURTOS, num, relogio, rotuloDist, t } from "./comum.js";
import { anguloQueEncaixa, LARGURA, MAIUSC, novaTela, pincel, rotaMedida, rotaNaCaixa, SANS, VERMELHO } from "./figuras.js";

const W = LARGURA;
const H = 1920;
const MX = 72; // margem dos lados
const BRANCO = "#FFFFFF";
const CAFE = "#190C07";
const APAGADO = "rgba(255,255,255,0.6)";

// ------------------------------------------------------------------ textos
const fmtMes = new Intl.DateTimeFormat(LOCALE, { month: "long" });
const nomeMes = (m) => fmtMes.format(new Date(2026, m, 15));
const U = () => MAIUSC(rotuloDist());
// as casas decimais das somas, como no resto do site: 1,55 km, 32,5 km, 194 km
const casas = (v) => (Math.abs(v) >= 99.95 ? 0 : Math.abs(v) >= 9.995 ? 1 : 2);
const kmPartes = (m) => {
  const v = distValor(m);
  return [[num(v, casas(v)), U()]];
};
function horasPartes(s) {
  const tot = Math.round(s / 60);
  const h = Math.floor(tot / 60);
  const mm = tot % 60;
  if (!h) return [[String(mm), "MIN"]];
  if (h >= 100 || !mm) return [[num(h), "H"]];
  return [[String(h), "H"], [String(mm).padStart(2, "0"), "MIN"]];
}
const subidaPartes = (m) => (getUnidade() === "mi" ? [[num(m * 3.28084), "FT"]] : [[num(m), "M"]]);
const ritmoPartes = (seg) => [[relogio(seg), `/${U()}`]];
const contaPartes = (n) => [[num(n), ""]];
const textoDe = (partes) => partes.map(([n, u]) => (u ? `${n} ${u.toLocaleLowerCase(LOCALE)}` : n)).join(" ");

// ------------------------------------------------------------------ dados
const somar = (lista, f) => lista.reduce((s, a) => s + (f(a) || 0), 0);

function listaDeDias(ini, fim) {
  const saida = [];
  for (let d = new Date(ini); d < fim; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) saida.push(d);
  return saida;
}

function porDiaDe(lista) {
  const m = new Map();
  for (const a of lista) {
    const d = m.get(a.dia) || { m: 0, s: 0, n: 0 };
    d.m += a.m || 0;
    d.s += a.s || 0;
    d.n++;
    m.set(a.dia, d);
  }
  return m;
}

// os números de um período: `lista` já filtrada pelo esporte; `dias`, os dias do período até hoje;
// `diasComAlgo`, os dias com qualquer treino (para contar o descanso)
function resumir(lista, dias, esporte, diasComAlgo) {
  const porDia = porDiaDe(lista);
  let seq = 0;
  let maiorSeq = 0;
  for (const d of dias) {
    if (porDia.has(chaveDia(d))) maiorSeq = Math.max(maiorSeq, ++seq);
    else seq = 0;
  }
  const semanas = new Map();
  for (const a of lista) {
    const k = chaveDia(inicioSemana(a.data));
    semanas.set(k, (semanas.get(k) || 0) + (a.m || 0));
  }
  const porMes = Array(12).fill(0);
  for (const a of lista) porMes[a.data.getMonth()] += a.m || 0;
  const m = somar(lista, (a) => a.m);
  const s = somar(lista, (a) => a.s);
  return {
    m,
    s,
    el: somar(lista, (a) => a.el),
    n: lista.length,
    dias: porDia.size,
    nDias: dias.length,
    porDia,
    maiorSeq,
    semana: Math.max(0, ...semanas.values()),
    porMes,
    maior: lista.reduce((x, a) => (!x || (a.m || 0) > (x.m || 0) ? a : x), null),
    maiorDia: Math.max(0, ...[...porDia.values()].map((d) => d.m)),
    descanso: dias.filter((d) => !diasComAlgo.has(chaveDia(d))).length,
    ritmo: esporte !== "tudo" && m > 0 && s > 0 ? s / distValor(m) : null,
  };
}

const nomeDoEsporte = (e) => (e === "tudo" ? t("Todos os esportes") : GRUPOS[e]?.nome || e);
const ROTULOS_DIAS = { corrida: "Dias com corrida", caminhada: "Dias com caminhada", tudo: "Dias com treino" };
const ROTULOS_MAIOR = { corrida: "Maior corrida", caminhada: "Maior caminhada", tudo: "Maior treino" };

// o endereço do site, para o pé das figuras (no computador de teste, o endereço publicado)
function endereco() {
  if (/github\.io$|\.[a-z]{2,}$/.test(location.hostname) && !/^(localhost|127\.)/.test(location.hostname)) {
    return `${location.host}${location.pathname.replace(/[^/]*$/, "")}`.replace(/\/$/, "");
  }
  return "oceanthief.github.io/oceanthief-run";
}

// Tudo o que os modelos usam de um período. `mes` de 0 a 11, ou null para o ano inteiro.
// `atividades`: a lista do site já preparada; `rotas`: Map do id do treino para a rota.
export function dadosDoPeriodo({ atividades, rotas, perfil, ano, mes = null, esporte = "corrida", foto = null, hoje = new Date() }) {
  const doEsporte = (a) => esporte === "tudo" || a.grupo === esporte;
  const hoje0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const amanha = new Date(hoje0.getFullYear(), hoje0.getMonth(), hoje0.getDate() + 1);
  const ehAno = mes == null;
  const ini = ehAno ? new Date(ano, 0, 1) : new Date(ano, mes, 1);
  const fim = ehAno ? new Date(ano + 1, 0, 1) : new Date(ano, mes + 1, 1);
  const emCurso = hoje0 >= ini && hoje0 < fim;
  const ate = emCurso ? amanha : fim;
  const primeira = atividades.reduce((x, a) => (a.data < x ? a.data : x), new Date(8.64e15));
  const inicioDados = new Date(primeira.getFullYear(), primeira.getMonth(), primeira.getDate());
  const entre = (de, a) => atividades.filter((x) => x.data >= de && x.data < a);
  const diasComAlgo = new Set(atividades.map((a) => a.dia));

  const diasTodos = listaDeDias(ini, fim);
  const listaAtual = entre(ini, ate).filter(doEsporte);
  // os dias antes do primeiro treino no Strava não contam (nem como descanso)
  const desde = ini < inicioDados ? inicioDados : ini;
  const atual = resumir(listaAtual, listaDeDias(desde, ate), esporte, diasComAlgo);

  // o período anterior: o mês anterior do mesmo ano, ou o ano anterior
  let antIni = null;
  let antFimTotal = null;
  if (ehAno) [antIni, antFimTotal] = [new Date(ano - 1, 0, 1), new Date(ano, 0, 1)];
  else if (mes > 0) [antIni, antFimTotal] = [new Date(ano, mes - 1, 1), new Date(ano, mes, 1)];
  let anterior = null;
  let motivo = null;
  let diasAntTotal = [];
  let porDiaAntTotal = new Map();
  if (!antIni) motivo = "janeiro";
  else if (antFimTotal <= inicioDados) motivo = "sem-dados";
  else {
    // período em curso: os mesmos dias do anterior (até o dia de hoje)
    let antAte = antFimTotal;
    if (emCurso) {
      antAte = ehAno
        ? new Date(ano - 1, hoje0.getMonth(), hoje0.getDate() + 1)
        : new Date(ano, mes - 1, Math.min(hoje0.getDate(), new Date(ano, mes, 0).getDate()) + 1);
    }
    anterior = resumir(entre(antIni, antAte).filter(doEsporte), listaDeDias(antIni < inicioDados ? inicioDados : antIni, antAte), esporte, diasComAlgo);
    diasAntTotal = listaDeDias(antIni, antFimTotal);
    porDiaAntTotal = porDiaDe(entre(antIni, antFimTotal).filter(doEsporte));
  }

  const nomeAtual = ehAno ? String(ano) : nomeMes(mes);
  const nomeAnt = ehAno ? String(ano - 1) : mes > 0 ? nomeMes(mes - 1) : "";
  let comparacao;
  if (motivo === "janeiro") comparacao = t("Primeiro mês do ano, sem comparação");
  else if (motivo === "sem-dados") comparacao = ehAno ? t("Primeiro ano no Strava, sem comparação") : t("Sem dados do mês anterior para comparar");
  else if (!emCurso) comparacao = t("Comparado com {ant}", { ant: nomeAnt });
  else if (ehAno) comparacao = t("Até {data}, comparado com o mesmo ponto de {ant}", { data: dataCurta(hoje0), ant: nomeAnt });
  else comparacao = t("De 1 a {dia} de {mes}, comparado com os mesmos dias de {ant}", { dia: hoje0.getDate(), mes: nomeAtual, ant: nomeAnt });

  const comRota = listaAtual.filter((a) => rotas?.get?.(a.id)).sort((x, y) => (y.m || 0) - (x.m || 0))[0] || null;
  const metaKm = Number(perfil?.meta_anual_km?.[ano] ?? (typeof perfil?.meta_anual_km === "number" ? perfil.meta_anual_km : 0)) || 0;
  return {
    ano,
    mes,
    ehAno,
    esporte,
    emCurso,
    hoje: hoje0,
    ini,
    fim,
    ate,
    desde,
    diasTodos,
    atual,
    anterior,
    motivo,
    diasAntTotal,
    porDiaAntTotal,
    diasComAlgo,
    nomeAtual,
    nomeAnt,
    comparacao,
    titulo: ehAno ? String(ano) : `${nomeAtual} ${ano}`,
    chave: ehAno ? String(ano) : `${ano}-${String(mes + 1).padStart(2, "0")}`,
    nomeEsporte: nomeDoEsporte(esporte),
    rotuloDias: t(ROTULOS_DIAS[esporte] || ROTULOS_DIAS.tudo),
    rotuloMaior: t(ROTULOS_MAIOR[esporte] || ROTULOS_MAIOR.tudo),
    comRota,
    rotaDe: (a) => rotas?.get?.(a.id) || "",
    // a meta do ano só vale para o esporte principal
    metaM: ehAno && esporte === (perfil?.esporte_principal || "corrida") ? metaKm * 1000 : 0,
    marca: perfil?.nome_site || "The Oceanthief Run",
    endereco: endereco(),
    foto,
  };
}

// o que cada linha mostra; `tipo: "ritmo"` compara ao contrário (menos é mais rápido)
const METRICAS = {
  distancia: { rotulo: () => t("Distância"), valor: (r) => r.m, partes: kmPartes },
  tempo: { rotulo: () => t("Tempo em movimento"), valor: (r) => r.s, partes: horasPartes },
  subida: { rotulo: () => t("Subida"), valor: (r) => r.el, partes: subidaPartes },
  dias: { rotulo: (R) => R.rotuloDias, valor: (r) => r.dias, partes: contaPartes },
  treinos: { rotulo: () => t("Treinos"), valor: (r) => r.n, partes: contaPartes },
  ritmo: { rotulo: () => t("Ritmo médio"), valor: (r) => r.ritmo, partes: ritmoPartes, tipo: "ritmo" },
  maior: { rotulo: (R) => R.rotuloMaior, valor: (r) => r.maior?.m || 0, partes: kmPartes },
};

// quanto mudou: { dir: "cima" | "baixo" | "igual", texto }
function variacao(atual, anterior, tipo = "pct") {
  if (anterior == null || atual == null) return null;
  if (tipo === "ritmo") {
    if (!atual || !anterior) return null;
    const d = anterior - atual; // positivo: ficou mais rápido
    if (Math.abs(d) < 0.5) return { dir: "igual", texto: "0:00" };
    return { dir: d > 0 ? "cima" : "baixo", texto: relogio(Math.abs(d)) };
  }
  if (!anterior) return atual > 0 ? { dir: "cima", texto: t("novo") } : null;
  const pct = (atual / anterior - 1) * 100;
  if (Math.abs(pct) < 0.5) return { dir: "igual", texto: "0%" };
  return { dir: pct > 0 ? "cima" : "baixo", texto: `${num(Math.abs(pct))}%` };
}

// ------------------------------------------------------------------ desenho
// no fundo café, a sombra das letras só suja; ela fica para o PNG transparente
const opDe = (op) => ({ ...op, sombra: op.fundo === "transparente" && op.sombra });

let GRAO = null;
function grao() {
  if (GRAO) return GRAO;
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(160, 160);
  let s = 20261125;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = (s / 2147483647) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (GRAO = c);
}

// o café do site, com um brilho quente atrás do título e grão de papel impresso
function fundo(p, op) {
  if (op.fundo === "transparente") return;
  const { ctx } = p;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#24130B");
  g.addColorStop(0.5, CAFE);
  g.addColorStop(1, "#100704");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const r = ctx.createRadialGradient(W * 0.9, 140, 0, W * 0.9, 140, 980);
  r.addColorStop(0, "rgba(182,81,39,0.34)");
  r.addColorStop(1, "rgba(182,81,39,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = ctx.createPattern(grao(), "repeat");
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// a marca à esquerda (com o quadrado vermelho das figuras) e o esporte à direita
function cabeca(p, R) {
  p.quadrado(MX + 8, 91, 16, VERMELHO);
  p.texto(MAIUSC(R.marca), MX + 30, 100, { tam: 30, peso: 600, espaco: 5, alpha: 0.88 });
  p.texto(MAIUSC(R.nomeEsporte), W - MX, 100, { tam: 30, peso: 600, espaco: 5, cor: p.acento, alinhar: "right" });
}

function pe(p, R) {
  p.texto(R.endereco, MX, H - 66, { tam: 24, peso: 500, fam: SANS, alpha: 0.5 });
  p.texto(R.ehAno ? t("Resumo do ano") : t("Resumo do mês"), W - MX, H - 66, { tam: 24, peso: 500, fam: SANS, alpha: 0.5, alinhar: "right" });
}

// um número com a unidade menor ao lado ("194" + "KM"); diminui até caber em `max`; devolve a largura
function valor(p, partes, x, y, { tam = 112, cor = BRANCO, alpha = 1, alinhar = "left", max = 0 } = {}) {
  const largura = (k) =>
    partes.reduce((w, [n, u], i) => w + p.medir(n, { tam: tam * k, peso: 700 }) + (u ? 8 * k + p.medir(u, { tam: tam * 0.4 * k, peso: 600 }) : 0) + (i < partes.length - 1 ? 22 * k : 0), 0);
  let k = 1;
  while (max && k > 0.4 && largura(k) > max) k -= 0.04;
  const w = largura(k);
  let cx = alinhar === "right" ? x - w : alinhar === "center" ? x - w / 2 : x;
  partes.forEach(([n, u], i) => {
    cx += p.texto(n, cx, y, { tam: tam * k, peso: 700, cor, alpha });
    if (u) {
      cx += 8 * k;
      cx += p.texto(u, cx, y, { tam: tam * 0.4 * k, peso: 600, cor, alpha: alpha * 0.82 });
    }
    if (i < partes.length - 1) cx += 22 * k;
  });
  return w;
}

// a seta da variação: ▲ na cor de destaque quando subiu, ▼ em branco apagado quando desceu
function seta(p, v, x, y, { tam = 56, alinhar = "right" } = {}) {
  if (!v) return 0;
  const sobe = v.dir === "cima";
  const cor = sobe ? p.acento : APAGADO;
  const lado = Math.round(tam * 0.5);
  const txt = MAIUSC(v.texto);
  const wt = p.medir(txt, { tam, peso: 700 });
  const wTri = v.dir === "igual" ? 0 : lado + tam * 0.2;
  const w = wTri + wt;
  const x0 = alinhar === "right" ? x - w : alinhar === "center" ? x - w / 2 : x;
  if (v.dir !== "igual") p.triangulo(x0 + lado / 2, y - tam * 0.34, lado, v.dir, cor);
  p.texto(txt, x0 + wTri, y, { tam, peso: 700, cor });
  return w;
}

function barra(p, x, y, w, h, cor, alpha = 1) {
  if (!(w > 0)) return;
  p.caixa(x, y, Math.max(h, w), h, { larg: 0, preencher: cor, alphaFundo: alpha, raio: h / 2 });
}

// o título do período: o mês em cima e o ano embaixo, ou só o ano bem grande; devolve a linha de base
function titulo(p, R, y = 330) {
  if (R.ehAno) {
    p.texto(String(R.ano), MX - 12, y + 150, { tam: 400, peso: 700 });
    return y + 150;
  }
  p.texto(MAIUSC(R.nomeAtual), MX - 6, y, { tam: 210, peso: 700, max: W - 2 * MX });
  p.texto(String(R.ano), MX - 4, y + 186, { tam: 210, peso: 700, cor: p.acento });
  return y + 186;
}

// o título numa linha só, menor ("NOVEMBRO 2026")
const tituloCurto = (p, R, y) => p.texto(MAIUSC(R.titulo), MX - 4, y, { tam: 112, peso: 700, max: W - 2 * MX });

// a "impressão digital" do período: um traço por dia, da altura da distância do dia
function impressao(p, R, y, h) {
  const dias = R.diasTodos;
  const n = dias.length;
  const larg = W - 2 * MX;
  const slot = larg / n;
  const bw = R.ehAno ? Math.max(1.6, slot * 0.66) : slot * 0.54;
  const base = y + h;
  const maxM = Math.max(1, ...dias.map((d) => R.atual.porDia.get(chaveDia(d))?.m || 0));
  p.texto(R.ehAno ? t("Cada dia do ano") : t("Cada dia do mês"), MX, y - 48, { tam: 26, peso: 500, fam: SANS, alpha: 0.6 });
  let maiorI = -1;
  dias.forEach((d, i) => {
    if (d >= R.ate || d < R.desde) return;
    const x = MX + i * slot + (slot - bw) / 2;
    const dia = R.atual.porDia.get(chaveDia(d));
    p.ctx.save();
    if (!dia) {
      p.ctx.fillStyle = "rgba(255,255,255,0.22)";
      p.ctx.fillRect(x, base - 3, bw, 3);
    } else {
      const hh = Math.max(6, (dia.m / maxM) * h);
      p.ctx.fillStyle = p.acento;
      p.ctx.fillRect(x, base - hh, bw, hh);
      if (dia.m === maxM) maiorI = i;
    }
    p.ctx.restore();
  });
  // o maior dia ganha o número em cima (à direita da legenda, se a barra cair embaixo dela)
  if (maiorI >= 0 && maxM > 1) {
    const cx = MX + maiorI * slot + slot / 2;
    const txt = textoDe(kmPartes(maxM)).toLocaleUpperCase(LOCALE);
    const wt = p.medir(txt, { tam: 26, peso: 600 });
    const xt = Math.min(W - MX - wt / 2, Math.max(MX + wt / 2, cx));
    p.texto(txt, xt, y - 10, { tam: 26, peso: 600, alinhar: "center", cor: p.acento });
  }
  // as marcas embaixo: o primeiro e o último dia do mês, ou a inicial de cada mês do ano
  if (R.ehAno) {
    dias.forEach((d, i) => {
      if (d.getDate() === 1) p.texto(MAIUSC(MESES_CURTOS[d.getMonth()][0]), MX + i * slot, base + 36, { tam: 24, peso: 600, alpha: 0.55 });
    });
  } else {
    p.texto("1", MX + slot / 2, base + 36, { tam: 24, peso: 600, alpha: 0.55, alinhar: "center" });
    p.texto(String(n), MX + (n - 0.5) * slot, base + 36, { tam: 24, peso: 600, alpha: 0.55, alinhar: "center" });
  }
}

// ------------------------------------------------------------- 1. Ficha
// A ficha técnica do período: cinco números, cada um com a variação e duas barras na mesma escala
// (este período em cor, o anterior em branco apagado), e a "impressão digital" dos dias embaixo.
function modFicha(R, op) {
  const c = novaTela(H);
  const p = pincel(c, opDe(op));
  fundo(p, op);
  p.grade();
  cabeca(p, R);
  const yT = titulo(p, R);
  p.texto(R.comparacao, MX, yT + 70, { tam: 30, peso: 500, fam: SANS, alpha: 0.72, max: W - 2 * MX });
  const chaves = R.esporte === "tudo" ? ["distancia", "tempo", "subida", "dias", "treinos"] : ["distancia", "tempo", "subida", "dias", "ritmo"];
  const y0 = yT + 118;
  const passo = Math.min(196, (1600 - y0) / chaves.length);
  chaves.forEach((k, i) => linhaFicha(p, R, METRICAS[k], y0 + i * passo));
  impressao(p, R, 1676, 104);
  pe(p, R);
  return c;
}

function linhaFicha(p, R, M, y) {
  const a = M.valor(R.atual);
  const b = R.anterior ? M.valor(R.anterior) : null;
  p.texto(M.rotulo(R), MX, y + 34, { tam: 30, peso: 600, fam: SANS, alpha: 0.7 });
  valor(p, a ? M.partes(a) : [["–", ""]], MX - 2, y + 138, { tam: 108, max: 600 });
  const v = variacao(a, b, M.tipo);
  if (!v) return;
  seta(p, v, W - MX, y + 108, { tam: 58 });
  p.texto(t("vs. {v}", { v: b ? textoDe(M.partes(b)) : "0" }), W - MX, y + 148, { tam: 26, peso: 500, fam: SANS, alpha: 0.55, alinhar: "right" });
  const fa = M.tipo === "ritmo" ? 1 / a : a;
  const fb = M.tipo === "ritmo" ? (b ? 1 / b : 0) : b;
  const max = Math.max(fa, fb) || 1;
  barra(p, MX, y + 162, ((W - 2 * MX) * fa) / max, 7, p.acento, 1);
  barra(p, MX, y + 174, ((W - 2 * MX) * fb) / max, 7, BRANCO, 0.3);
}

// ------------------------------------------------------------ 2. Retrato
// A foto no meio e a maior corrida do período como uma fita grossa que passa por trás da foto e volta
// pela frente (o começo e o fim do caminho), com a faixa tracejada de rua no meio. Embaixo, quatro números.
function cobrir(ctx, img, F) {
  const k = Math.max(F.w / img.naturalWidth, F.h / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.drawImage(img, F.x + (F.w - w) / 2, F.y + (F.h - h) * 0.45, w, h);
}

function modRetrato(R, op) {
  const c = novaTela(H);
  const p = pincel(c, opDe(op));
  const { ctx } = p;
  fundo(p, op);
  p.grade();
  cabeca(p, R);
  const F = { x: 220, y: 236, w: 640, h: 820, r: 30 };
  let fita = null;
  if (R.comRota) {
    const Rr = rotaMedida({ a: { rota: R.rotaDe(R.comRota) } });
    if (Rr.pts.length > 1) {
      // a rota maior que a foto, encostando nas bordas, e alisada para parecer fita
      const caixa = { x: -30, y: 140, w: W + 60, h: 1000 };
      const { fn, trechos } = rotaNaCaixa(Rr, caixa, anguloQueEncaixa(Rr, caixa));
      const lisos = trechos.map((tr) => alisar(tr, 2));
      fita = { trechos: lisos, frente: trancado(lisos, F), ini: fn(Rr.pts[0]), fim: fn(Rr.pts.at(-1)) };
    }
  }
  const LARG = 72;
  const pintarFita = (trechos) => trechos.forEach((tr) => p.linha(tr, { cor: p.acento, larg: LARG, comSombra: op.fundo === "transparente" && op.sombra }));
  if (fita) pintarFita(fita.trechos);
  // a foto (ou, sem foto, um quadro café mais claro)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(F.x, F.y, F.w, F.h, F.r);
  ctx.clip();
  if (R.foto) {
    cobrir(ctx, R.foto, F);
    const g = ctx.createLinearGradient(0, F.y + F.h * 0.6, 0, F.y + F.h);
    g.addColorStop(0, "rgba(25,12,7,0)");
    g.addColorStop(1, "rgba(25,12,7,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(F.x, F.y, F.w, F.h);
  } else {
    ctx.fillStyle = "#2B1810";
    ctx.fillRect(F.x, F.y, F.w, F.h);
  }
  ctx.restore();
  if (fita) {
    pintarFita(fita.frente);
    // a largada e a chegada, só quando caem fora da foto
    const fora = ([x, y]) => x < F.x - 10 || x > F.x + F.w + 10 || y < F.y - 10 || y > F.y + F.h + 10;
    if (fora(fita.ini)) p.quadrado(fita.ini[0], fita.ini[1], 26, VERMELHO);
    if (fora(fita.fim)) p.quadrado(fita.fim[0], fita.fim[1], 26, VERMELHO);
  }
  const yT = F.y + F.h + 168;
  tituloCurto(p, R, yT);
  const LEGENDAS = {
    corrida: "A fita é a maior corrida do período: {d}, em {data}.",
    caminhada: "A fita é a maior caminhada do período: {d}, em {data}.",
    tudo: "A fita é o maior treino do período: {d}, em {data}.",
  };
  const legenda = fita ? t(LEGENDAS[R.esporte] || LEGENDAS.tudo, { d: textoDe(kmPartes(R.comRota.m)), data: dataCurta(R.comRota.data) }) : R.comparacao;
  p.texto(legenda, MX, yT + 54, { tam: 28, peso: 500, fam: SANS, alpha: 0.7, max: W - 2 * MX });
  const chaves = ["distancia", "tempo", R.esporte === "tudo" ? "treinos" : "dias", "subida"];
  chaves.forEach((k, i) => celula(p, R, METRICAS[k], i % 2 ? W / 2 + 16 : MX, yT + 128 + Math.floor(i / 2) * 206, W / 2 - MX - 24));
  pe(p, R);
  return c;
}

// alisa uma linha cortando os cantos (Chaikin): a rota fica com cara de fita, sem mudar o desenho
function alisar(pts, vezes = 2) {
  let p = pts;
  for (let k = 0; k < vezes && p.length > 2; k++) {
    const s = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      s.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    s.push(p.at(-1));
    p = s;
  }
  return p;
}

// O trançado: cada vez que a fita atravessa a foto, ela passa inteira por cima ou inteira por baixo
// (como uma fita de verdade). Passa por cima só quando não encosta no meio da foto, onde costuma estar a
// pessoa. Devolve os trechos que vão por cima, com um ponto de fora em cada ponta, para emendar sem corte.
function trancado(trechos, F) {
  const dentro = ([x, y]) => x > F.x && x < F.x + F.w && y > F.y && y < F.y + F.h;
  const [cx, cy, rx, ry] = [F.x + F.w / 2, F.y + F.h * 0.55, F.w * 0.3, F.h * 0.34];
  const noMeio = ([x, y]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  const frente = [];
  for (const tr of trechos) {
    let i = 0;
    while (i < tr.length) {
      if (!dentro(tr[i])) {
        i++;
        continue;
      }
      const ini = i;
      while (i < tr.length && dentro(tr[i])) i++;
      const run = tr.slice(Math.max(0, ini - 1), Math.min(tr.length, i + 1));
      // confere também o meio de cada pedaço reto (a rota simplificada tem poucos pontos)
      const encosta = run.some((q, k) => k > 0 && [0, 0.25, 0.5, 0.75].some((u) => noMeio([run[k - 1][0] + (q[0] - run[k - 1][0]) * u, run[k - 1][1] + (q[1] - run[k - 1][1]) * u])));
      if (!encosta && !noMeio(run.at(-1))) frente.push(run);
    }
  }
  return frente;
}

// um número com rótulo em cima e a variação embaixo ("▲ 28% vs. outubro")
function celula(p, R, M, x, y, larg, { tam = 96 } = {}) {
  const a = M.valor(R.atual);
  const b = R.anterior ? M.valor(R.anterior) : null;
  p.texto(M.rotulo(R), x, y, { tam: 27, peso: 600, fam: SANS, alpha: 0.7, max: larg });
  valor(p, a ? M.partes(a) : [["–", ""]], x - 2, y + 96, { tam, max: larg });
  const v = variacao(a, b, M.tipo);
  if (!v) return;
  const w = seta(p, v, x, y + 146, { tam: 38, alinhar: "left" });
  p.texto(t("vs. {ant}", { ant: R.nomeAnt }), x + w + 12, y + 146, { tam: 24, peso: 500, fam: SANS, alpha: 0.55, max: larg - w - 12 });
}

// --------------------------------------------------------- 3. Constância
// Os dias do período: no mês, um calendário; no ano, uma linha de pontos por mês. O círculo cresce com
// a distância do dia, os dias seguidos ficam ligados, o anel é um dia com outro esporte e o ponto
// pequeno, um dia de descanso.
function modConstancia(R, op) {
  const c = novaTela(H);
  const p = pincel(c, opDe(op));
  fundo(p, op);
  p.grade();
  cabeca(p, R);
  tituloCurto(p, R, 250);
  // o número grande: dias com treino
  const n = R.atual.dias;
  const wN = p.texto(num(n), MX - 10, 566, { tam: 300, peso: 700, cor: p.acento });
  const x2 = MX + wN + 30;
  const larg2 = W - MX - x2;
  p.texto(R.rotuloDias.toLocaleLowerCase(LOCALE), x2, 432, { tam: 40, peso: 700, fam: SANS, max: larg2 });
  p.texto(t("de {n} dias", { n: num(R.atual.nDias) }), x2, 484, { tam: 32, peso: 500, fam: SANS, alpha: 0.62, max: larg2 });
  const v = variacao(n, R.anterior?.dias);
  if (v) {
    const w = seta(p, v, x2, 560, { tam: 46, alinhar: "left" });
    p.texto(t("vs. {v} em {ant}", { v: num(R.anterior.dias), ant: R.nomeAnt }), x2 + w + 14, 560, { tam: 26, peso: 500, fam: SANS, alpha: 0.55, max: larg2 - w - 14 });
  } else p.texto(R.comparacao, x2, 560, { tam: 24, peso: 500, fam: SANS, alpha: 0.55, max: larg2 });

  const yFim = R.ehAno ? pontosDoAno(p, R, 690) : calendarioDoMes(p, R, 660);
  legendaPontos(p, R, yFim + 64);
  // três números embaixo
  const fatos = [
    { rotulo: t("Maior sequência"), partes: [[num(R.atual.maiorSeq), t("dias").toLocaleUpperCase(LOCALE)]], v: variacao(R.atual.maiorSeq, R.anterior?.maiorSeq) },
    R.ehAno
      ? (() => {
          const i = R.atual.porMes.indexOf(Math.max(...R.atual.porMes));
          return { rotulo: t("Mês mais forte"), partes: kmPartes(R.atual.porMes[i]), sub: nomeMes(i) };
        })()
      : { rotulo: t("Semana mais forte"), partes: kmPartes(R.atual.semana), v: variacao(R.atual.semana, R.anterior?.semana) },
    { rotulo: t("Dias de descanso"), partes: [[num(R.atual.descanso), ""]], v: variacao(R.atual.descanso, R.anterior?.descanso) },
  ];
  const yF = 1560;
  const col = (W - 2 * MX) / 3;
  fatos.forEach((f, i) => {
    const x = MX + i * col;
    p.texto(f.rotulo, x, yF, { tam: 26, peso: 600, fam: SANS, alpha: 0.7, max: col - 20 });
    valor(p, f.partes, x - 2, yF + 92, { tam: 84, max: col - 24 });
    if (f.v) seta(p, f.v, x, yF + 140, { tam: 32, alinhar: "left" });
    else if (f.sub) p.texto(f.sub, x, yF + 140, { tam: 26, peso: 500, fam: SANS, alpha: 0.6 });
  });
  pe(p, R);
  return c;
}

// o estado de um dia: "futuro", "ativo" (com o esporte), "outro" (outro esporte) ou "descanso"
function estadoDoDia(R, d) {
  if (d >= R.ate || d < R.desde) return { tipo: "futuro" };
  const k = chaveDia(d);
  const dia = R.atual.porDia.get(k);
  if (dia) return { tipo: "ativo", m: dia.m };
  return { tipo: R.diasComAlgo.has(k) ? "outro" : "descanso" };
}

function pintarDia(p, x, y, e, rMin, rMax, maxM, numero = null) {
  const ctx = p.ctx;
  if (e.tipo === "ativo") {
    const r = rMin + (rMax - rMin) * Math.sqrt(Math.min(1, (e.m || 0) / maxM));
    p.bola(x, y, r, { cor: p.acento });
    if (numero != null && r >= 24) p.texto(numero, x, y + 9, { tam: 26, peso: 700, cor: CAFE, alinhar: "center" });
  } else if (e.tipo === "outro") {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = rMin > 10 ? 3 : 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(4, rMin * 0.75), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (e.tipo === "descanso") {
    p.bola(x, y, rMin > 10 ? 4 : 2.4, { cor: "rgba(255,255,255,0.28)" });
  } else if (numero != null) {
    p.texto(numero, x, y + 9, { tam: 26, peso: 500, alinhar: "center", alpha: 0.22 });
  }
}

function calendarioDoMes(p, R, y0) {
  const dias = R.diasTodos;
  const desloc = (R.ini.getDay() + 6) % 7; // a semana começa na segunda
  const linhas = Math.ceil((desloc + dias.length) / 7);
  const cw = (W - 2 * MX) / 7;
  const ch = Math.min(122, 720 / linhas);
  DIAS_CURTOS.forEach((d, i) => p.texto(MAIUSC(d), MX + cw * (i + 0.5), y0, { tam: 28, peso: 600, alinhar: "center", alpha: 0.5 }));
  const yG = y0 + 34;
  const pos = (i) => [MX + cw * (((desloc + i) % 7) + 0.5), yG + ch * (Math.floor((desloc + i) / 7) + 0.5)];
  const estados = dias.map((d) => estadoDoDia(R, d));
  const maxM = Math.max(1, ...estados.map((e) => e.m || 0));
  // os dias seguidos, ligados por uma faixa (dentro da mesma semana)
  estados.forEach((e, i) => {
    if (e.tipo !== "ativo" || estados[i + 1]?.tipo !== "ativo" || (desloc + i) % 7 === 6) return;
    const [x, y] = pos(i);
    p.linha([[x, y], [x + cw, y]], { cor: p.acento, larg: 18, alpha: 0.32, comSombra: false });
  });
  estados.forEach((e, i) => {
    const [x, y] = pos(i);
    pintarDia(p, x, y, e, 15, Math.min(52, ch * 0.44), maxM, String(i + 1));
  });
  return yG + ch * linhas;
}

function pontosDoAno(p, R, y0) {
  const x0 = MX + 84;
  const cw = (W - MX - x0) / 31;
  const rh = 56;
  const maxM = Math.max(1, ...R.diasTodos.map((d) => R.atual.porDia.get(chaveDia(d))?.m || 0));
  for (let m = 0; m < 12; m++) {
    const y = y0 + m * rh + rh / 2;
    p.texto(MAIUSC(MESES_CURTOS[m]), MX, y + 10, { tam: 28, peso: 600, alpha: 0.55 });
    const nDias = new Date(R.ano, m + 1, 0).getDate();
    const estados = Array.from({ length: nDias }, (_, i) => estadoDoDia(R, new Date(R.ano, m, i + 1)));
    estados.forEach((e, i) => {
      if (e.tipo === "ativo" && estados[i + 1]?.tipo === "ativo") p.linha([[x0 + cw * (i + 0.5), y], [x0 + cw * (i + 1.5), y]], { cor: p.acento, larg: 8, alpha: 0.35, comSombra: false });
    });
    estados.forEach((e, i) => pintarDia(p, x0 + cw * (i + 0.5), y, e, 4, 12.5, maxM));
  }
  return y0 + 12 * rh;
}

function legendaPontos(p, R, y) {
  const ctx = p.ctx;
  let x = MX;
  p.bola(x + 12, y - 9, 12, { cor: p.acento });
  x += 34;
  x += p.texto(t("{esporte}, do tamanho da distância", { esporte: R.esporte === "tudo" ? t("Treino") : R.nomeEsporte }), x, y, { tam: 24, peso: 500, fam: SANS, alpha: 0.65 }) + 36;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x + 9, y - 9, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  x += 28;
  if (R.esporte !== "tudo") x += p.texto(t("outro esporte"), x, y, { tam: 24, peso: 500, fam: SANS, alpha: 0.65 }) + 36;
  else x -= 28;
  p.bola(x + 5, y - 9, 4, { cor: "rgba(255,255,255,0.4)" });
  p.texto(t("descanso"), x + 20, y, { tam: 24, peso: 500, fam: SANS, alpha: 0.65 });
}

// -------------------------------------------------------------- 4. Duelo
// Os dois períodos frente a frente, como numa ficha de luta: o anterior à esquerda, este à direita,
// as barras saindo do meio. Quem ganhou a linha fica com a barra cheia; no fim, o placar.
function modDuelo(R, op) {
  const c = novaTela(H);
  const p = pincel(c, opDe(op));
  fundo(p, op);
  p.grade();
  cabeca(p, R);
  const tam = R.ehAno ? 200 : 124;
  const yN = R.ehAno ? 340 : 300;
  const esq = MAIUSC(R.nomeAnt);
  const dir = MAIUSC(R.nomeAtual);
  p.texto(esq, MX - 4, yN, { tam, peso: 700, alpha: 0.5, max: 430 });
  p.texto(dir, W - MX + 4, yN, { tam, peso: 700, cor: p.acento, alinhar: "right", max: 430 });
  p.texto("×", W / 2, yN - tam * 0.28, { tam: 64, peso: 500, alinhar: "center", alpha: 0.45 });
  let sub = "";
  if (R.emCurso) sub = R.ehAno ? t("De 1º de janeiro a {data} de cada ano", { data: dataCurta(R.hoje) }) : t("{ano}, de 1 a {dia} de cada mês", { ano: R.ano, dia: R.hoje.getDate() });
  else if (!R.ehAno) sub = String(R.ano);
  if (sub) p.texto(sub, W / 2, yN + 70, { tam: 28, peso: 500, fam: SANS, alpha: 0.62, alinhar: "center" });

  const chaves = R.esporte === "tudo" ? ["distancia", "tempo", "treinos", "dias", "subida", "maior"] : ["distancia", "tempo", "treinos", "dias", "subida", "ritmo", "maior"];
  const y0 = yN + 120;
  const passo = (1580 - y0) / chaves.length;
  const MEIO = W / 2;
  const LMAX = 430;
  let placar = [0, 0];
  let maiorSalto = null;
  chaves.forEach((k, i) => {
    const M = METRICAS[k];
    const y = y0 + i * passo;
    const a = M.valor(R.atual) || 0;
    const b = M.valor(R.anterior) || 0;
    const fa = M.tipo === "ritmo" ? (a ? 1 / a : 0) : a;
    const fb = M.tipo === "ritmo" ? (b ? 1 / b : 0) : b;
    const g = Math.abs(fa - fb) < 1e-9 ? 0 : fa > fb ? 1 : -1;
    if (g > 0) placar[1]++;
    if (g < 0) placar[0]++;
    if (M.tipo !== "ritmo" && b > 0) {
      const pct = (a / b - 1) * 100;
      if (!maiorSalto || Math.abs(pct) > Math.abs(maiorSalto.pct)) maiorSalto = { pct, rotulo: M.rotulo(R) };
    }
    p.texto(M.rotulo(R), MEIO, y + 28, { tam: 27, peso: 600, fam: SANS, alpha: 0.68, alinhar: "center" });
    valor(p, b ? M.partes(b) : [["–", ""]], MX - 2, y + 100, { tam: 62, alpha: g < 0 ? 1 : 0.5, max: 400 });
    valor(p, a ? M.partes(a) : [["–", ""]], W - MX + 2, y + 100, { tam: 62, alpha: g > 0 ? 1 : 0.5, alinhar: "right", cor: g > 0 ? p.acento : BRANCO, max: 400 });
    const max = Math.max(fa, fb) || 1;
    const yb = y + 118;
    const lb = (LMAX * fb) / max;
    const la = (LMAX * fa) / max;
    barra(p, MEIO - 6 - lb, yb, lb, 20, BRANCO, g < 0 ? 0.9 : 0.28);
    barra(p, MEIO + 6, yb, la, 20, g > 0 ? p.acento : BRANCO, g > 0 ? 1 : 0.28);
    p.caixa(MEIO - 1, yb - 10, 2, 40, { larg: 0, preencher: BRANCO, alphaFundo: 0.5 });
  });
  // o placar
  const [pa, pb] = placar;
  const frase = pb === pa ? t("Empate: {a} a {b}", { a: pb, b: pa }) : t("{nome} levou {n} de {total}", { nome: pb > pa ? R.nomeAtual : R.nomeAnt, n: Math.max(pa, pb), total: chaves.length });
  p.texto(MAIUSC(frase), W / 2, 1700, { tam: 84, peso: 700, alinhar: "center", cor: pb > pa ? p.acento : BRANCO, max: W - 2 * MX });
  if (maiorSalto && Math.abs(maiorSalto.pct) >= 1) {
    p.texto(t("Maior diferença: {metrica}, {v}", { metrica: maiorSalto.rotulo.toLocaleLowerCase(LOCALE), v: `${maiorSalto.pct > 0 ? "+" : "−"}${num(Math.abs(maiorSalto.pct))}%` }), W / 2, 1756, {
      tam: 28, peso: 500, fam: SANS, alpha: 0.65, alinhar: "center",
    });
  }
  pe(p, R);
  return c;
}

// -------------------------------------------------------------- 5. Curva
// A soma da distância dia a dia, este período contra o anterior: a linha cheia é este (até hoje, se o
// período ainda não acabou; nada de projeção), a tracejada o anterior inteiro. No ano, a meta aparece
// como uma linha reta.
function modCurva(R, op) {
  const c = novaTela(H);
  const p = pincel(c, opDe(op));
  fundo(p, op);
  p.grade();
  cabeca(p, R);
  tituloCurto(p, R, 250);
  const acumular = (dias, porDia, ate) => {
    const saida = [];
    let s = 0;
    for (const d of dias) {
      if (ate && d >= ate) break;
      s += porDia.get(chaveDia(d))?.m || 0;
      saida.push(s);
    }
    return saida;
  };
  const A = acumular(R.diasTodos, R.atual.porDia, R.ate);
  const B = acumular(R.diasAntTotal, R.porDiaAntTotal);
  const diff = R.atual.m - R.anterior.m;
  const sobe = diff >= 0;
  valor(p, [[`${sobe ? "+" : "−"}${kmPartes(Math.abs(diff))[0][0]}`, U()]], MX - 8, 540, { tam: 230, cor: sobe ? p.acento : BRANCO });
  const frase = R.emCurso
    ? sobe ? t("a mais que {ant} até o mesmo dia", { ant: R.nomeAnt }) : t("a menos que {ant} até o mesmo dia", { ant: R.nomeAnt })
    : sobe ? t("a mais que {ant}", { ant: R.nomeAnt }) : t("a menos que {ant}", { ant: R.nomeAnt });
  p.texto(frase, MX, 606, { tam: 34, peso: 500, fam: SANS, alpha: 0.8, max: W - 2 * MX });

  // o gráfico
  const nd = Math.max(R.diasTodos.length, R.diasAntTotal.length);
  const x0 = MX;
  const x1 = W - MX - 170;
  const y0 = 740;
  const y1 = 1400;
  const alvo = R.metaM || 0;
  const topo = Math.max(A.at(-1) || 0, B.at(-1) || 0, alvo) * 1.08 || 1;
  const X = (i) => x0 + (i / Math.max(1, nd - 1)) * (x1 - x0);
  const Y = (v) => y1 - (v / topo) * (y1 - y0);
  // linhas de referência
  const passoKm = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => distValor(topo) / s <= 4.5) || 2000;
  for (let k = passoKm; k < distValor(topo); k += passoKm) {
    const yy = y1 - ((k / distValor(topo)) * (y1 - y0));
    p.linha([[x0, yy], [x1 + 150, yy]], { cor: BRANCO, larg: 1.5, alpha: 0.12, comSombra: false });
    if (!R.metaM || Math.abs(yy - Y(R.metaM)) > 44) p.texto(`${num(k)} ${U()}`, x0, yy - 10, { tam: 24, peso: 500, alpha: 0.45 });
  }
  p.linha([[x0, y1], [x1 + 150, y1]], { cor: BRANCO, larg: 2, alpha: 0.35, comSombra: false });
  // o eixo dos dias
  if (R.ehAno) {
    R.diasTodos.forEach((d, i) => {
      if (d.getDate() === 1) p.texto(MAIUSC(MESES_CURTOS[d.getMonth()][0]), X(i), y1 + 40, { tam: 24, peso: 600, alpha: 0.5 });
    });
  } else {
    [1, 8, 15, 22, 29].filter((d) => d <= nd).forEach((d) => p.texto(String(d), X(d - 1), y1 + 40, { tam: 24, peso: 600, alpha: 0.5, alinhar: "center" }));
  }
  // a meta do ano
  if (alvo) {
    // a etiqueta fica à esquerda, onde as curvas ainda estão lá embaixo
    p.linha([[x0, Y(alvo)], [x1 + 150, Y(alvo)]], { cor: BRANCO, larg: 3, alpha: 0.6, traco: [3, 12], comSombra: false });
    p.texto(MAIUSC(t("Meta: {v}", { v: textoDe(kmPartes(alvo)) })), x0, Y(alvo) - 14, { tam: 26, peso: 600, alpha: 0.75 });
  }
  // o anterior, tracejado
  p.linha(B.map((v, i) => [X(i), Y(v)]), { cor: BRANCO, larg: 4, alpha: 0.55, traco: [14, 12] });
  // este, com a área embaixo
  const ptsA = A.map((v, i) => [X(i), Y(v)]);
  if (ptsA.length > 1) {
    p.area(ptsA, y1, { cor: p.acento, alpha: 0.3 });
    p.linha(ptsA, { cor: p.acento, larg: 7 });
  }
  const fimA = ptsA.at(-1) || [x0, y1];
  p.bola(fimA[0], fimA[1], 13, { cor: p.acento });
  p.bola(fimA[0], fimA[1], 5, { cor: CAFE });
  // os rótulos da direita, afastados para não encostar
  const rot = [
    { y: Y(B.at(-1) || 0), v: textoDe(kmPartes(B.at(-1) || 0)), sub: R.emCurso ? t("{ant} inteiro", { ant: R.nomeAnt }) : R.nomeAnt, cor: BRANCO, alpha: 0.7 },
  ];
  if (!R.emCurso) rot.push({ y: Y(A.at(-1) || 0), v: textoDe(kmPartes(A.at(-1) || 0)), sub: R.nomeAtual, cor: p.acento, alpha: 1 });
  rot.sort((a, b) => a.y - b.y);
  for (let i = 1; i < rot.length; i++) if (rot[i].y - rot[i - 1].y < 84) rot[i].y = rot[i - 1].y + 84;
  rot.forEach((r) => {
    p.texto(r.v.toLocaleUpperCase(LOCALE), W - MX, r.y + 4, { tam: 40, peso: 700, cor: r.cor, alpha: r.alpha, alinhar: "right" });
    p.texto(r.sub, W - MX, r.y + 38, { tam: 22, peso: 500, fam: SANS, alpha: 0.6, alinhar: "right" });
  });
  // no período em curso, o total até hoje fica em cima do ponto, com a data
  if (R.emCurso) {
    const txt = textoDe(kmPartes(A.at(-1))).toLocaleUpperCase(LOCALE);
    p.texto(txt, fimA[0] - 22, fimA[1] - 30, { tam: 40, peso: 700, alinhar: "right" });
    p.texto(t("até {data}", { data: dataCurta(R.hoje) }), fimA[0] - 22, fimA[1] + 2, { tam: 22, peso: 500, fam: SANS, alpha: 0.6, alinhar: "right" });
  }
  // três números embaixo
  const semanas = Math.max(1, R.atual.nDias / 7);
  const fatos = [
    { rotulo: t("Média por semana"), partes: kmPartes(R.atual.m / semanas), v: variacao(R.atual.m / semanas, R.anterior.m / Math.max(1, R.anterior.nDias / 7)) },
    { rotulo: t("Maior dia"), partes: kmPartes(R.atual.maiorDia), v: variacao(R.atual.maiorDia, R.anterior.maiorDia) },
    alvo
      ? { rotulo: t("Da meta do ano"), partes: [[num(Math.min(999, (R.atual.m / alvo) * 100)), "%"]], sub: textoDe(kmPartes(alvo)) }
      : { rotulo: R.rotuloDias, partes: [[num(R.atual.dias), ""]], v: variacao(R.atual.dias, R.anterior.dias) },
  ];
  const yF = 1560;
  const col = (W - 2 * MX) / 3;
  fatos.forEach((f, i) => {
    const x = MX + i * col;
    p.texto(f.rotulo, x, yF, { tam: 26, peso: 600, fam: SANS, alpha: 0.7, max: col - 20 });
    valor(p, f.partes, x - 2, yF + 92, { tam: 84, max: col - 24 });
    if (f.v) seta(p, f.v, x, yF + 140, { tam: 32, alinhar: "left" });
    else if (f.sub) p.texto(f.sub, x, yF + 140, { tam: 26, peso: 500, fam: SANS, alpha: 0.6 });
  });
  pe(p, R);
  return c;
}

// --------------------------------------------------------------- catálogo
const temComparacao = (R) => !!R.anterior && (R.anterior.n > 0 || R.atual.n > 0);
export const MODELOS = [
  { id: "ficha", nome: () => t("Ficha do período"), pronta: (R) => R.atual.n > 0, desenhar: modFicha },
  { id: "retrato", nome: () => t("Retrato"), pronta: (R) => R.atual.n > 0 && (!!R.foto || !!R.comRota), desenhar: modRetrato },
  { id: "constancia", nome: () => t("Constância"), pronta: (R) => R.atual.n > 0, desenhar: modConstancia },
  { id: "duelo", nome: () => t("Duelo"), pronta: (R) => R.atual.n > 0 && temComparacao(R), desenhar: modDuelo },
  { id: "curva", nome: () => t("Curva acumulada"), pronta: (R) => R.atual.m > 0 && temComparacao(R) && R.anterior.m >= 0, desenhar: modCurva },
];

// os períodos que dá para escolher: cada ano (do mais novo ao mais velho) com os seus meses
export function periodosDisponiveis(atividades, hoje = new Date()) {
  const primeira = atividades.reduce((x, a) => (a.data < x ? a.data : x), new Date(8.64e15));
  const saida = [];
  for (let ano = hoje.getFullYear(); ano >= primeira.getFullYear(); ano--) {
    const meses = [];
    for (let m = 11; m >= 0; m--) {
      const ini = new Date(ano, m, 1);
      if (ini > hoje || new Date(ano, m + 1, 1) <= new Date(primeira.getFullYear(), primeira.getMonth(), 1)) continue;
      meses.push({ mes: m, nome: nomeMes(m) });
    }
    saida.push({ ano, emCurso: ano === hoje.getFullYear(), meses });
  }
  return saida;
}
