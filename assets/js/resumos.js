// Resumos do mês e do ano para compartilhar: cinco modelos no tamanho do story (1080 × 1920).
// Cada um compara o período com o anterior: o mês com o mês anterior (janeiro com dezembro do ano
// anterior) e o ano com o ano anterior. Se o período ainda não acabou, a comparação usa os mesmos dias
// do anterior (de 1 a 25 de novembro contra de 1 a 25 de outubro), para não pôr um mês pela metade
// contra um mês inteiro. Nada de projeção: só o que já aconteceu.
//
// Os cinco seguem o mesmo sistema: o cabeçalho com o esporte e o tipo de resumo (sem o nome do site nem
// o endereço), o período em letra condensada grande, rótulos na letra do site (Manrope) e a seta ▲ na cor
// de destaque quando o número subiu e ▼ em branco apagado quando desceu. O fundo é o café do site, ou
// transparente.
import { chaveDia, dataCurta, DIAS_CURTOS, distValor, getUnidade, GRUPOS, inicioSemana, LOCALE, MESES_CURTOS, num, relogio, rotuloDist, t, trechosRota } from "./comum.js";
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
  const [semanaIni] = [...semanas].reduce((x, s) => (s[1] > x[1] ? s : x), ["", -1]);
  // os melhores do período (para os destaques): o ritmo só conta em treino de 3 km ou mais
  const melhorPor = (f, filtro = () => true) => lista.filter(filtro).reduce((x, a) => (!x || f(a) > f(x) ? a : x), null);
  const ritmoDe = (a) => a.s / distValor(a.m);
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
    lista: [...lista].sort((x, y) => x.data - y.data),
    semanaIni: semanaIni ? new Date(`${semanaIni}T12:00`) : null,
    rapido: esporte === "tudo" ? null : melhorPor((a) => -ritmoDe(a), (a) => a.m >= 3000 && a.s > 0),
    subidaMax: melhorPor((a) => a.el || 0, (a) => a.el > 0),
    longo: melhorPor((a) => a.s || 0, (a) => a.s > 0),
  };
}

const nomeDoEsporte = (e) => (e === "tudo" ? t("Todos os esportes") : GRUPOS[e]?.nome || e);
const ROTULOS_DIAS = { corrida: "Dias com corrida", caminhada: "Dias com caminhada", tudo: "Dias com treino" };
const ROTULOS_MAIOR = { corrida: "Maior corrida", caminhada: "Maior caminhada", tudo: "Maior treino" };

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

  // o período anterior: o mês anterior (janeiro compara com dezembro do ano anterior), ou o ano anterior
  const [antIni, antFimTotal] = ehAno ? [new Date(ano - 1, 0, 1), new Date(ano, 0, 1)] : [new Date(ano, mes - 1, 1), new Date(ano, mes, 1)];
  let anterior = null;
  let motivo = null;
  let diasAntTotal = [];
  let porDiaAntTotal = new Map();
  if (antFimTotal <= inicioDados) motivo = "sem-dados";
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
  // em janeiro, o anterior é de outro ano: "dezembro de 2025"; no título do duelo, só "dezembro"
  const nomeAntCurto = ehAno ? String(ano - 1) : nomeMes((mes + 11) % 12);
  const nomeAnt = !ehAno && mes === 0 ? t("{mes} de {ano}", { mes: nomeAntCurto, ano: ano - 1 }) : nomeAntCurto;
  let comparacao;
  if (motivo === "sem-dados") comparacao = ehAno ? t("Primeiro ano no Strava, sem comparação") : t("Sem dados do mês anterior para comparar");
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
    nomeAntCurto,
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

// o esporte à esquerda (com o quadrado vermelho das figuras) e o tipo de resumo à direita;
// sem nome do site nem endereço (pedido do Victor)
function cabeca(p, R) {
  p.quadrado(MX + 8, 91, 16, VERMELHO);
  p.texto(MAIUSC(R.nomeEsporte), MX + 30, 100, { tam: 30, peso: 600, espaco: 5, cor: p.acento });
  p.texto(MAIUSC(R.ehAno ? t("Resumo do ano") : t("Resumo do mês")), W - MX, 100, { tam: 30, peso: 600, espaco: 5, alpha: 0.88, alinhar: "right" });
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
// A foto de ponta a ponta no alto, desmanchando no fundo; o período em letra grande por cima da borda
// da foto; a maior corrida do período num traço fino e pequeno, ao lado do número; quatro números embaixo.
function cobrir(ctx, img, F, foco = 0.5) {
  const k = Math.max(F.w / img.naturalWidth, F.h / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.drawImage(img, F.x + (F.w - w) / 2, F.y + (F.h - h) * foco, w, h);
}

function modRetrato(R, op) {
  const c = novaTela(H);
  const p = pincel(c, opDe(op));
  const { ctx } = p;
  fundo(p, op);
  const FH = 1200;
  // a foto num canvas à parte, apagada aos poucos embaixo: emenda no café e também no PNG transparente
  const f = document.createElement("canvas");
  f.width = W;
  f.height = FH;
  const fx = f.getContext("2d");
  cobrir(fx, R.foto, { x: 0, y: 0, w: W, h: FH }, 0.55);
  fx.globalCompositeOperation = "destination-in";
  const g = fx.createLinearGradient(0, 0, 0, FH);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.6, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  fx.fillStyle = g;
  fx.fillRect(0, 0, W, FH);
  ctx.drawImage(f, 0, 0);
  // o alto mais escuro, para o cabeçalho aparecer sobre qualquer foto
  const s = ctx.createLinearGradient(0, 0, 0, 280);
  s.addColorStop(0, "rgba(16,7,4,0.72)");
  s.addColorStop(1, "rgba(16,7,4,0)");
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, W, 280);
  p.grade();
  cabeca(p, R);

  const yT = 1186;
  p.texto(MAIUSC(R.titulo), MX - 6, yT, { tam: R.ehAno ? 250 : 156, peso: 700, max: W - 2 * MX });
  p.texto(R.comparacao, MX, yT + 56, { tam: 28, peso: 500, fam: SANS, alpha: 0.7, max: W - 2 * MX });

  // a maior corrida: o desenho da rota em traço fino (se tiver rota), a distância e o dia
  const maior = R.atual.maior;
  let x = MX;
  const yM = yT + 100;
  const rota = maior && R.rotaDe(maior);
  if (rota) {
    const Rr = rotaMedida({ a: { rota } });
    if (Rr.pts.length > 1) {
      const caixa = { x: MX, y: yM, w: 112, h: 112 };
      const { trechos, fn } = rotaNaCaixa(Rr, caixa, anguloQueEncaixa(Rr, caixa));
      trechos.forEach((tr) => p.linha(tr, { cor: p.acento, larg: 4 }));
      const [ix, iy] = fn(Rr.pts[0]);
      p.quadrado(ix, iy, 11, VERMELHO);
      x = MX + 112 + 32;
    }
  }
  if (maior) {
    p.texto(R.rotuloMaior, x, yM + 34, { tam: 26, peso: 600, fam: SANS, alpha: 0.7 });
    const w = valor(p, kmPartes(maior.m), x - 2, yM + 100, { tam: 62 });
    p.texto(dataCurta(maior.data), x + w + 18, yM + 100, { tam: 26, peso: 500, fam: SANS, alpha: 0.6 });
  }

  const chaves = ["distancia", "tempo", R.esporte === "tudo" ? "treinos" : "dias", "subida"];
  chaves.forEach((k, i) => celula(p, R, METRICAS[k], i % 2 ? W / 2 + 16 : MX, yM + 178 + Math.floor(i / 2) * 200, W / 2 - MX - 24));
  return c;
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
  const esq = MAIUSC(R.nomeAntCurto);
  const dir = MAIUSC(R.nomeAtual);
  p.texto(esq, MX - 4, yN, { tam, peso: 700, alpha: 0.5, max: 430 });
  p.texto(dir, W - MX + 4, yN, { tam, peso: 700, cor: p.acento, alinhar: "right", max: 430 });
  p.texto("×", W / 2, yN - tam * 0.28, { tam: 64, peso: 500, alinhar: "center", alpha: 0.45 });
  // os anos embaixo (janeiro contra dezembro mostra os dois)
  const anos = !R.ehAno && R.mes === 0 ? t("{a} e {b}", { a: R.ano - 1, b: R.ano }) : String(R.ano);
  let sub = "";
  if (R.emCurso) sub = R.ehAno ? t("De 1º de janeiro a {data} de cada ano", { data: dataCurta(R.hoje) }) : t("{ano}, de 1 a {dia} de cada mês", { ano: anos, dia: R.hoje.getDate() });
  else if (!R.ehAno) sub = anos;
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
  const frase = pb === pa ? t("Empate: {a} a {b}", { a: pb, b: pa }) : t("{nome} levou {n} de {total}", { nome: pb > pa ? R.nomeAtual : R.nomeAntCurto, n: Math.max(pa, pb), total: chaves.length });
  p.texto(MAIUSC(frase), W / 2, 1700, { tam: 84, peso: 700, alinhar: "center", cor: pb > pa ? p.acento : BRANCO, max: W - 2 * MX });
  if (maiorSalto && Math.abs(maiorSalto.pct) >= 1) {
    p.texto(t("Maior diferença: {metrica}, {v}", { metrica: maiorSalto.rotulo.toLocaleLowerCase(LOCALE), v: `${maiorSalto.pct > 0 ? "+" : "−"}${num(Math.abs(maiorSalto.pct))}%` }), W / 2, 1756, {
      tam: 28, peso: 500, fam: SANS, alpha: 0.65, alinhar: "center",
    });
  }
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
  return c;
}

// os números de cima dos modelos novos: rótulo, valor e a seta ao lado
function parDeNumeros(p, R, chaves, y) {
  chaves.forEach((k, i) => {
    const M = METRICAS[k];
    const x = i ? W / 2 + 16 : MX;
    const a = M.valor(R.atual);
    const b = R.anterior ? M.valor(R.anterior) : null;
    p.texto(M.rotulo(R), x, y, { tam: 27, peso: 600, fam: SANS, alpha: 0.7 });
    const w = valor(p, a ? M.partes(a) : [["–", ""]], x - 2, y + 92, { tam: 96, max: W / 2 - MX - 150 });
    const v = variacao(a, b, M.tipo);
    if (v) seta(p, v, x + w + 20, y + 92, { tam: 38, alinhar: "left" });
  });
}

// encaixa trechos (lat, lng) numa caixa, com o norte para cima, sem distorcer
function encaixar(trechos, caixa) {
  const pts = trechos.flat();
  const lat0 = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [la, lo] of pts) {
    x0 = Math.min(x0, lo * k);
    x1 = Math.max(x1, lo * k);
    y0 = Math.min(y0, -la);
    y1 = Math.max(y1, -la);
  }
  const e = Math.min(caixa.w / (x1 - x0 || 1e-9), caixa.h / (y1 - y0 || 1e-9));
  const ox = caixa.x + (caixa.w - (x1 - x0) * e) / 2;
  const oy = caixa.y + (caixa.h - (y1 - y0) * e) / 2;
  return ([la, lo]) => [ox + (lo * k - x0) * e, oy + (-la - y0) * e];
}

// -------------------------------------------------------------- 6. Rotas
// Todas as rotas do período, uma por quadro, na ordem em que aconteceram (o norte para cima); a maior
// fica em branco. Treino sem rota (esteira, academia) vira um anel. No ano, os quadros ficam pequenos e
// sem legenda: vira um mosaico.
function modRotas(R, op) {
  const c = novaTela(H);
  const p = pincel(c, opDe(op));
  fundo(p, op);
  p.grade();
  cabeca(p, R);
  tituloCurto(p, R, 250);
  parDeNumeros(p, R, ["treinos", "distancia"], 340);
  const lista = R.atual.lista;
  const [x0, x1, y0, y1] = [MX, W - MX, 520, 1800];
  // a legenda embaixo: a maior em branco; o anel é treino sem rota
  const yL = 1866;
  p.linha([[MX, yL - 9], [MX + 34, yL - 9]], { cor: BRANCO, larg: 4 });
  let xl = MX + 48 + p.texto(R.rotuloMaior, MX + 48, yL, { tam: 24, peso: 500, fam: SANS, alpha: 0.65 }) + 36;
  if (lista.some((a) => !trechosRota(R.rotaDe(a)).length)) {
    p.ctx.save();
    p.ctx.strokeStyle = "rgba(255,255,255,0.45)";
    p.ctx.lineWidth = 2.5;
    p.ctx.beginPath();
    p.ctx.arc(xl + 10, yL - 9, 10, 0, Math.PI * 2);
    p.ctx.stroke();
    p.ctx.restore();
    xl += 32;
    p.texto(t("sem rota (esteira ou sem GPS)"), xl, yL, { tam: 24, peso: 500, fam: SANS, alpha: 0.65 });
  }
  let melhor = { cols: 1, lado: 0 };
  for (let cols = 1; cols <= 18; cols++) {
    const lado = Math.min((x1 - x0) / cols, (y1 - y0) / Math.ceil(lista.length / cols));
    if (lado > melhor.lado) melhor = { cols, lado };
  }
  const { cols, lado } = melhor;
  const comLegenda = lado >= 150;
  const pad = lado * 0.1;
  const larg = Math.max(1.6, Math.min(4, lado / 55));
  const ox = x0 + (x1 - x0 - cols * lado) / 2;
  lista.forEach((a, i) => {
    const cx = ox + (i % cols) * lado;
    const cy = y0 + Math.floor(i / cols) * lado;
    const caixa = { x: cx + pad, y: cy + pad, w: lado - 2 * pad, h: lado - 2 * pad - (comLegenda ? 36 : 0) };
    const trechos = trechosRota(R.rotaDe(a));
    const cor = a === R.atual.maior ? BRANCO : p.acento;
    if (trechos.length) {
      const fn = encaixar(trechos, caixa);
      trechos.forEach((tr) => p.linha(tr.map(fn), { cor, larg }));
    } else {
      p.ctx.save();
      p.ctx.strokeStyle = "rgba(255,255,255,0.45)";
      p.ctx.lineWidth = larg;
      p.ctx.beginPath();
      p.ctx.arc(caixa.x + caixa.w / 2, caixa.y + caixa.h / 2, Math.min(caixa.w, caixa.h) * 0.26, 0, Math.PI * 2);
      p.ctx.stroke();
      p.ctx.restore();
    }
    if (comLegenda) {
      const yl = cy + lado - pad;
      p.texto(MAIUSC(dataCurta(a.data)), cx + pad, yl, { tam: 22, peso: 600, alpha: 0.55 });
      p.texto(textoDe(kmPartes(a.m)).toLocaleUpperCase(LOCALE), cx + lado - pad, yl, { tam: 22, peso: 600, alpha: 0.85, alinhar: "right" });
    }
  });
  return c;
}

// ---------------------------------------------------------- 7. Destaques
// Os melhores do período, cada um contra o melhor do período anterior: a maior distância, o ritmo mais
// rápido (treinos de 3 km ou mais), a maior subida, a semana mais forte e o treino mais longo em tempo.
// À direita, o dia e o nome do treino.
function cortar(p, txt, max, op) {
  let s = String(txt || "");
  if (p.medir(s, op) <= max) return s;
  while (s.length > 1 && p.medir(`${s}…`, op) > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

function modDestaques(R, op) {
  const c = novaTela(H);
  const p = pincel(c, opDe(op));
  fundo(p, op);
  p.grade();
  cabeca(p, R);
  tituloCurto(p, R, 250);
  p.texto(R.comparacao, MX, 310, { tam: 28, peso: 500, fam: SANS, alpha: 0.7, max: W - 2 * MX });
  const ritmoDe = (a) => a.s / distValor(a.m);
  const linhas = [
    { rotulo: R.rotuloMaior, de: (r) => r.maior, partes: (a) => kmPartes(a.m), num: (a) => a.m },
    { rotulo: t("Ritmo mais rápido"), de: (r) => r.rapido, partes: (a) => ritmoPartes(ritmoDe(a)), num: (a) => ritmoDe(a), tipo: "ritmo" },
    { rotulo: t("Maior subida"), de: (r) => r.subidaMax, partes: (a) => subidaPartes(a.el), num: (a) => a.el },
    { rotulo: t("Mais tempo num treino"), de: (r) => r.longo, partes: (a) => horasPartes(a.s), num: (a) => a.s },
    { rotulo: t("Semana mais forte"), semana: true, partes: (r) => kmPartes(r.semana), num: (r) => r.semana },
  ].filter((l) => (l.semana ? R.atual.semana > 0 : !!l.de(R.atual)));
  const y0 = 400;
  const passo = Math.min(280, (1850 - y0) / linhas.length);
  linhas.forEach((l, i) => {
    const y = y0 + i * passo;
    const a = l.semana ? R.atual : l.de(R.atual);
    const b = R.anterior ? (l.semana ? (R.anterior.semana > 0 ? R.anterior : null) : l.de(R.anterior)) : null;
    p.texto(l.rotulo, MX, y + 30, { tam: 28, peso: 600, fam: SANS, alpha: 0.7 });
    valor(p, l.partes(a), MX - 2, y + 130, { tam: 108, max: 560 });
    // o dia e o nome, à direita
    const dia = l.semana ? R.atual.semanaIni : a.data;
    if (dia) p.texto(MAIUSC(l.semana ? t("Semana de {data}", { data: dataCurta(dia) }) : dataCurta(dia)), W - MX, y + 92, { tam: 40, peso: 600, alpha: 0.6, alinhar: "right", max: 380 });
    if (!l.semana) {
      // o nome do treino sem emoji (a letra do canvas não desenha todos)
      const nome = String(a.n || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();
      const op2 = { tam: 24, peso: 500, fam: SANS };
      p.texto(cortar(p, nome, 380, op2), W - MX, y + 130, { ...op2, alpha: 0.5, alinhar: "right" });
    }
    const v = b ? variacao(l.num(a), l.num(b), l.tipo) : null;
    if (v) {
      const w = seta(p, v, MX, y + 186, { tam: 34, alinhar: "left" });
      p.texto(t("vs. {v} em {ant}", { v: textoDe(l.partes(b)), ant: R.nomeAnt }), MX + w + 14, y + 186, { tam: 24, peso: 500, fam: SANS, alpha: 0.55 });
    }
    if (i < linhas.length - 1) p.linha([[MX, y + passo - 34], [W - MX, y + passo - 34]], { cor: BRANCO, larg: 1.5, alpha: 0.12, comSombra: false });
  });
  return c;
}

// -------------------------------------------------------------- 8. Ritmo
// Cada treino é um ponto, na posição do ritmo médio (mais rápido para a direita) e do tamanho da
// distância: em cima o período anterior, embaixo este. A linha de cada faixa é o ritmo médio do período.
function enxame(pontos, X, rMax, maxM, altura) {
  const saida = [];
  for (const q of [...pontos].sort((a, b) => X(a.r) - X(b.r))) {
    const r = Math.max(4, rMax * Math.sqrt(q.m / maxM));
    const x = X(q.r);
    // o lugar livre mais perto do meio da faixa; sem lugar, fica por cima dos outros (nenhum some)
    let y = 0;
    for (let k = 0; ; k++) {
      const tentativa = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3;
      if (Math.abs(tentativa) > altura) break;
      if (!saida.some((o) => Math.hypot(o.x - x, o.y - tentativa) < o.raio + r + 2)) {
        y = tentativa;
        break;
      }
    }
    saida.push({ x, y, raio: r, m: q.m });
  }
  return saida;
}

function modRitmo(R, op) {
  const c = novaTela(H);
  const p = pincel(c, opDe(op));
  fundo(p, op);
  p.grade();
  cabeca(p, R);
  tituloCurto(p, R, 250);
  valor(p, ritmoPartes(R.atual.ritmo), MX - 8, 520, { tam: 220, cor: p.acento });
  const v = variacao(R.atual.ritmo, R.anterior?.ritmo, "ritmo");
  if (v) {
    const w = seta(p, v, MX, 596, { tam: 44, alinhar: "left" });
    const frase = v.dir === "cima" ? t("mais rápido que {ant}", { ant: R.nomeAnt }) : v.dir === "baixo" ? t("mais lento que {ant}", { ant: R.nomeAnt }) : t("igual a {ant}", { ant: R.nomeAnt });
    p.texto(frase, MX + w + 16, 596, { tam: 30, peso: 500, fam: SANS, alpha: 0.75 });
  } else p.texto(t("Ritmo médio do período"), MX, 596, { tam: 30, peso: 500, fam: SANS, alpha: 0.75 });

  const pts = (r) => (r?.lista || []).filter((a) => a.m >= 1000 && a.s > 0).map((a) => ({ r: a.s / distValor(a.m), m: a.m }));
  const A = pts(R.atual);
  const B = pts(R.anterior);
  const todos = [...A, ...B].map((q) => q.r).sort((a, b) => a - b);
  const qt = (f) => todos[Math.min(todos.length - 1, Math.max(0, Math.round(f * (todos.length - 1))))];
  let [lo, hi] = [qt(0.03), qt(0.97)];
  const folga = Math.max(10, (hi - lo) * 0.08);
  [lo, hi] = [lo - folga, hi + folga];
  const [x0, x1] = [MX + 20, W - MX - 20];
  // mais rápido (ritmo menor) para a direita
  const X = (r) => x0 + ((hi - Math.min(hi, Math.max(lo, r))) / (hi - lo)) * (x1 - x0);
  const maxM = Math.max(1, ...[...A, ...B].map((q) => q.m));
  const n = Math.max(A.length, B.length);
  const rMax = n > 80 ? 10 : n > 30 ? 15 : 22;
  const faixas = [
    ...(B.length ? [{ pts: B, y: 860, cor: BRANCO, alpha: 0.5, nome: R.nomeAnt, media: R.anterior.ritmo }] : []),
    { pts: A, y: B.length ? 1220 : 1040, cor: p.acento, alpha: 1, nome: R.nomeAtual, media: R.atual.ritmo },
  ];
  // as marcas do eixo: o menor passo (15 s, 30 s, 1 min...) que deixe no máximo 8 marcas
  const passoS = [15, 30, 60, 120, 300, 600].find((s) => (hi - lo) / s <= 8) || 900;
  const yEixo = 1420;
  for (let s = Math.ceil(lo / passoS) * passoS; s <= hi; s += passoS) {
    p.linha([[X(s), 700], [X(s), yEixo - 30]], { cor: BRANCO, larg: 1.5, alpha: 0.08, comSombra: false });
    p.texto(relogio(s), X(s), yEixo, { tam: 24, peso: 500, alpha: 0.5, alinhar: "center" });
  }
  p.texto(t("mais lento"), x0, yEixo + 46, { tam: 24, peso: 500, fam: SANS, alpha: 0.55 });
  p.texto(t("mais rápido"), x1 - 22, yEixo + 46, { tam: 24, peso: 500, fam: SANS, alpha: 0.55, alinhar: "right" });
  p.triangulo(x1 - 6, yEixo + 38, 14, "direita", "rgba(255,255,255,0.55)");
  faixas.forEach((f) => {
    p.texto(MAIUSC(f.nome), MX, f.y - 150, { tam: 30, peso: 600, espaco: 2, cor: f.cor, alpha: f.alpha === 1 ? 1 : 0.7 });
    if (f.media) {
      const xm = X(f.media);
      p.linha([[xm, f.y - 120], [xm, f.y + 120]], { cor: f.cor, larg: 3, alpha: 0.8, traco: [10, 8], comSombra: false });
      p.texto(relogio(f.media), xm, f.y - 128, { tam: 28, peso: 700, cor: f.cor, alinhar: "center", alpha: f.alpha === 1 ? 1 : 0.8 });
    }
    for (const b of enxame(f.pts, X, rMax, maxM, 112)) p.bola(b.x, f.y + b.y, b.raio, { cor: f.cor, alpha: f.alpha });
  });
  // três números embaixo
  const rap = R.atual.rapido;
  const fatos = [
    rap ? { rotulo: t("Mais rápido (3 km ou mais)"), partes: ritmoPartes(rap.s / distValor(rap.m)), sub: dataCurta(rap.data) } : null,
    { rotulo: t("Treinos"), partes: [[num(A.length), ""]], v: variacao(A.length, R.anterior ? B.length : null) },
    { rotulo: t("Distância por treino"), partes: kmPartes(A.reduce((s, q) => s + q.m, 0) / Math.max(1, A.length)) },
  ].filter(Boolean);
  const col = (W - 2 * MX) / 3;
  fatos.forEach((f, i) => {
    const x = MX + i * col;
    p.texto(f.rotulo, x, 1600, { tam: 26, peso: 600, fam: SANS, alpha: 0.7, max: col - 20 });
    valor(p, f.partes, x - 2, 1692, { tam: 84, max: col - 24 });
    if (f.v) seta(p, f.v, x, 1740, { tam: 32, alinhar: "left" });
    else if (f.sub) p.texto(f.sub, x, 1740, { tam: 26, peso: 500, fam: SANS, alpha: 0.6 });
  });
  return c;
}

// --------------------------------------------------------------- catálogo
const temComparacao = (R) => !!R.anterior && (R.anterior.n > 0 || R.atual.n > 0);
// um modelo novo pode entrar com `nova: true`: só aparece com ?resumos=novos no endereço, até ser aprovado
export const MODELOS = [
  { id: "ficha", nome: () => t("Ficha do período"), pronta: (R) => R.atual.n > 0, desenhar: modFicha },
  { id: "retrato", nome: () => t("Retrato"), pronta: (R) => R.atual.n > 0 && !!R.foto, desenhar: modRetrato },
  { id: "constancia", nome: () => t("Constância"), pronta: (R) => R.atual.n > 0, desenhar: modConstancia },
  { id: "duelo", nome: () => t("Duelo"), pronta: (R) => R.atual.n > 0 && temComparacao(R), desenhar: modDuelo },
  { id: "curva", nome: () => t("Curva acumulada"), pronta: (R) => R.atual.m > 0 && temComparacao(R) && R.anterior.m >= 0, desenhar: modCurva },
  { id: "rotas", nome: () => t("Rotas"), pronta: (R) => R.atual.lista.filter((a) => trechosRota(R.rotaDe(a)).length).length >= 2, desenhar: modRotas },
  { id: "destaques", nome: () => t("Destaques"), pronta: (R) => R.atual.n >= 2, desenhar: modDestaques },
  { id: "ritmo", nome: () => t("Ritmo"), pronta: (R) => R.esporte !== "tudo" && R.atual.lista.filter((a) => a.m >= 1000 && a.s > 0).length >= 3, desenhar: modRitmo },
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
