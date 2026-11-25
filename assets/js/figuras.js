// Figuras para compartilhar: as métricas de um treino em PNG de fundo transparente, para pôr por cima de
// uma foto (story do Instagram, post do LinkedIn). O estilo segue as artes da Coros: letra condensada,
// números grandes com o nome embaixo, uma cor de destaque, quadrados vermelhos nas pontas e, se quiser,
// a grade técnica com as letras das colunas.
//
// Cada figura é desenhada num <canvas> de 1080 px de largura (a altura muda de uma para outra) e sai
// em PNG pelo canvas.toBlob, que já guarda a transparência.
import { dataLonga, distValor, elev, hora, LOCALE, NOMES_ESFORCO, num, relogio, rotuloDist, semAcento, t, trechosRota } from "./comum.js";

export const LARGURA = 1080;
export const CORES = { neon: "#E4FF3A", laranja: "#F0894F", creme: "#EBD9B4", branco: "#FFFFFF" };
const BRANCO = "#FFFFFF";
const VERMELHO = "#FF3B30";
const FONTE = '"Barlow Condensed", "Arial Narrow", sans-serif';
const M = 40; // margem: as artes da Coros deixam 40 px de cada lado

// ------------------------------------------------------------------ textos
const MAIUSC = (s) => String(s ?? "").toLocaleUpperCase(LOCALE);
// o nome do treino sem emoji e sem a exclamação do fim ("MEIA MARATONA DE JUIZ DE FORA! 🏅")
export const limparNome = (s) => MAIUSC(String(s || "").replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/[!\s]+$/u, "").replace(/\s{2,}/g, " ").trim());
const U = () => MAIUSC(rotuloDist());
const distTxt = (m, casas = 2) => `${num(distValor(m), casas)} ${U()}`;
const ritmoTxt = (seg) => `${relogio(seg)} /${U()}`; // seg por unidade
const ritmoKm = (seg) => `${relogio(seg)} /KM`; // as parciais são sempre por km
const ritmoDe = (m, s) => s / distValor(m);
const dataTxt = (d) => MAIUSC(dataLonga(d));

// ------------------------------------------------------------------ dados
// a série mais completa que existir: a nova (com tempo, cadência e potência) ou a do site
const serieDe = (D) => (D.x?.serie?.d?.length ? D.x.serie : D.a.serie?.d?.length ? D.a.serie : null);

// o tempo de cada ponto da série: o real, se veio, ou a conta pela velocidade
function temposDa(s) {
  if (s.t?.length === s.d.length) return s.t;
  const saida = [0];
  for (let i = 1; i < s.d.length; i++) {
    const v = ((s.v?.[i] || 0) + (s.v?.[i - 1] || 0)) / 2;
    saida.push(saida[i - 1] + (v > 0.3 ? (s.d[i] - s.d[i - 1]) / v : 0));
  }
  return saida;
}

// a média de uma série por km (para a cadência de cada parcial)
function mediaPorKm(s, chave, km) {
  const lista = [];
  for (let k = 0; k < km; k++) {
    const v = [];
    for (let i = 0; i < s.d.length; i++) if (s.d[i] >= k * 1000 && s.d[i] < (k + 1) * 1000 && s[chave]?.[i]) v.push(s[chave][i]);
    lista.push(v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  }
  return lista;
}

// as parciais com o km acumulado e o ritmo de cada uma
function parciais(D) {
  let acum = 0;
  return (D.a.parciais || [])
    .filter((p) => p.m >= 300 && p.s)
    .map((p, i) => {
      acum += p.m;
      return { i, km: acum / 1000, m: p.m, s: p.s, ritmo: p.s / (p.m / 1000), hr: p.hr, el: p.el, inteira: p.m >= 950 };
    });
}

// O que cada número grande mostra. Devolve null quando o treino não tem aquela medida.
// na prova vale o tempo total (o do relógio da prova); no treino, o tempo em movimento
const tempoDe = (a) => (a.prova && a.e ? a.e : a.s);
const MEDIDAS = {
  tempo: (D) => ({ valor: relogio(tempoDe(D.a)), rotulo: D.a.prova && D.a.e ? t("Tempo de prova") : t("Tempo em movimento") }),
  distancia: (D) => ({ valor: distTxt(D.a.m), rotulo: t("Distância") }),
  ritmo: (D) => (D.a.m && D.a.s ? { valor: ritmoTxt(ritmoDe(D.a.m, tempoDe(D.a))), rotulo: t("Ritmo médio") } : null),
  fc: (D) => (D.a.hr ? { valor: `${D.a.hr} BPM`, rotulo: t("FC média") } : null),
  fcmax: (D) => (D.a.hrx ? { valor: `${D.a.hrx} BPM`, rotulo: t("FC máxima") } : null),
  subida: (D) => (D.a.el != null ? { valor: MAIUSC(elev(D.a.el)), rotulo: t("Subida") } : null),
  cadencia: (D) => (D.a.cad ? { valor: `${Math.round(D.a.cad * 2)} PPM`, rotulo: t("Cadência") } : null),
  potencia: (D) => (D.a.w ? { valor: `${D.a.w} W`, rotulo: t("Potência média") } : null),
  potenciaPond: (D) => (D.x?.w_ponderada ? { valor: `${D.x.w_ponderada} W`, rotulo: t("Potência ponderada") } : null),
  potenciaMax: (D) => (D.x?.w_max ? { valor: `${D.x.w_max} W`, rotulo: t("Potência máxima") } : null),
  calorias: (D) => (D.a.cal ? { valor: `${num(D.a.cal)} KCAL`, rotulo: t("Calorias") } : null),
  esforco: (D) => (D.x?.esforco_relativo ? { valor: num(D.x.esforco_relativo), rotulo: t("Esforço relativo") } : null),
  energia: (D) => (D.x?.kj ? { valor: `${num(D.x.kj)} KJ`, rotulo: t("Energia") } : null),
  temperatura: (D) => {
    const c = D.x?.temp_media ?? D.a.clima?.temp;
    return c != null ? { valor: `${num(c)} °C`, rotulo: t("Temperatura") } : null;
  },
};
const medidas = (D, lista, n) => lista.map((k) => MEDIDAS[k](D)).filter(Boolean).slice(0, n);

// ------------------------------------------------------------------ pincel
function novaTela(altura) {
  const c = document.createElement("canvas");
  c.width = LARGURA;
  c.height = Math.round(altura);
  return c;
}

function pincel(c, op) {
  const ctx = c.getContext("2d");
  const comEspaco = "letterSpacing" in ctx;
  const acento = CORES[op.cor] || CORES.neon;
  const fonte = (tam, peso) => `${peso} ${tam}px ${FONTE}`;
  function sombra(ligada) {
    const on = op.sombra && ligada;
    ctx.shadowColor = on ? "rgba(0,0,0,0.55)" : "transparent";
    ctx.shadowBlur = on ? 14 : 0;
    ctx.shadowOffsetY = on ? 2 : 0;
  }
  function medir(str, { tam = 30, peso = 600, espaco = 0 } = {}) {
    ctx.font = fonte(tam, peso);
    if (comEspaco) {
      ctx.letterSpacing = `${espaco}px`;
      const w = ctx.measureText(str).width - (espaco && str.length ? espaco : 0);
      ctx.letterSpacing = "0px";
      return w;
    }
    return [...str].reduce((s, ch) => s + ctx.measureText(ch).width, 0) + espaco * Math.max(0, [...str].length - 1);
  }
  // escreve e devolve a largura; com `max`, a letra diminui até caber
  function texto(str, x, y, { tam = 30, peso = 600, cor = BRANCO, alinhar = "left", base = "alphabetic", espaco = 0, alpha = 1, max = 0 } = {}) {
    str = String(str ?? "");
    let tamF = tam;
    while (max && tamF > 12 && medir(str, { tam: tamF, peso, espaco }) > max) tamF -= 2;
    const w = medir(str, { tam: tamF, peso, espaco });
    const x0 = alinhar === "right" ? x - w : alinhar === "center" ? x - w / 2 : x;
    ctx.save();
    sombra(true);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = cor;
    ctx.font = fonte(tamF, peso);
    ctx.textBaseline = base;
    ctx.textAlign = "left";
    if (comEspaco) {
      ctx.letterSpacing = `${espaco}px`;
      ctx.fillText(str, x0, y);
    } else if (!espaco) ctx.fillText(str, x0, y);
    else {
      let cx = x0;
      for (const ch of str) {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + espaco;
      }
    }
    ctx.restore();
    return w;
  }
  function linha(pts, { cor = BRANCO, larg = 2, alpha = 1, traco = null, fechar = false, comSombra = true } = {}) {
    if (pts.length < 2) return;
    ctx.save();
    sombra(comSombra);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = cor;
    ctx.lineWidth = larg;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (traco) ctx.setLineDash(traco);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (fechar) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  function area(pts, base, { cor, alpha = 0.5 } = {}) {
    ctx.save();
    const g = ctx.createLinearGradient(0, Math.min(...pts.map((p) => p[1])), 0, base);
    g.addColorStop(0, cor);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], base);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts.at(-1)[0], base);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function caixa(x, y, w, h, { cor = BRANCO, larg = 2, alpha = 0.9, preencher = null, alphaFundo = 1, raio = 0 } = {}) {
    ctx.save();
    sombra(false);
    ctx.beginPath();
    if (raio && ctx.roundRect) ctx.roundRect(x, y, w, h, raio);
    else ctx.rect(x, y, w, h);
    if (preencher) {
      ctx.globalAlpha = alphaFundo;
      ctx.fillStyle = preencher;
      ctx.fill();
    }
    if (larg) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = cor;
      ctx.lineWidth = larg;
      ctx.stroke();
    }
    ctx.restore();
  }
  function bola(x, y, r, { cor = acento, alpha = 1 } = {}) {
    ctx.save();
    sombra(true);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function quadrado(x, y, lado, cor = VERMELHO) {
    ctx.save();
    sombra(true);
    ctx.fillStyle = cor;
    ctx.fillRect(x - lado / 2, y - lado / 2, lado, lado);
    ctx.restore();
  }
  // triângulo: para cima (melhorou), para baixo, ou para a direita (o "▸" das artes da Coros)
  function triangulo(x, y, lado, dir = "cima", cor = acento) {
    ctx.save();
    sombra(true);
    ctx.fillStyle = cor;
    ctx.beginPath();
    const h = lado * 0.87;
    if (dir === "cima") {
      ctx.moveTo(x, y - h / 2);
      ctx.lineTo(x + lado / 2, y + h / 2);
      ctx.lineTo(x - lado / 2, y + h / 2);
    } else if (dir === "baixo") {
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + lado / 2, y - h / 2);
      ctx.lineTo(x - lado / 2, y - h / 2);
    } else {
      ctx.moveTo(x + h / 2, y);
      ctx.lineTo(x - h / 2, y - lado / 2);
      ctx.lineTo(x - h / 2, y + lado / 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function seta(x1, y, x2, cor = acento) {
    linha([[x1, y], [x2, y]], { cor, larg: 3 });
    linha([[x2 - 14, y - 10], [x2, y], [x2 - 14, y + 10]], { cor, larg: 3 });
  }
  // a grade técnica das artes da Coros: 3 colunas entre as margens, letras nas pontas
  function grade() {
    if (!op.grade) return;
    const H = c.height;
    const xs = [M, M + (LARGURA - 2 * M) / 3, M + ((LARGURA - 2 * M) * 2) / 3, LARGURA - M];
    ctx.save();
    sombra(false);
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = BRANCO;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const x of xs) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    let ultima = 0;
    for (let y = M; y < H - M - 60; y += (LARGURA - 2 * M) / 3) {
      ctx.moveTo(0, y);
      ctx.lineTo(LARGURA, y);
      ultima = y;
    }
    if (H - M - ultima > 60) {
      ctx.moveTo(0, H - M);
      ctx.lineTo(LARGURA, H - M);
    }
    ctx.stroke();
    ctx.restore();
    "ABCD".split("").forEach((l, i) => {
      texto(l, xs[i], 26, { tam: 22, peso: 500, alpha: 0.55, alinhar: "center" });
      texto(l, xs[i], H - 10, { tam: 22, peso: 500, alpha: 0.55, alinhar: "center" });
    });
  }
  return { ctx, acento, texto, medir, linha, area, caixa, bola, quadrado, triangulo, seta, grade };
}

// o nome do treino à esquerda e a data à direita, na cor de destaque
function cabecalho(p, D, y) {
  const data = dataTxt(D.data);
  const wData = p.medir(data, { tam: 32, peso: 600, espaco: 2 });
  p.texto(limparNome(D.a.n), M, y, { tam: 32, peso: 600, cor: p.acento, espaco: 2, max: LARGURA - 2 * M - wData - 40 });
  p.texto(data, LARGURA - M, y, { tam: 32, peso: 600, cor: p.acento, espaco: 2, alinhar: "right" });
}

// um número grande com o nome embaixo
function numero(p, med, x, y, alinhar = "left", { tam = 108, max = 470 } = {}) {
  p.texto(MAIUSC(med.valor), x, y, { tam, peso: 700, alinhar, max });
  p.texto(MAIUSC(med.rotulo), x, y + 44, { tam: 32, peso: 600, alinhar, espaco: 1.5, alpha: 0.92 });
}

// duas colunas de números, a da esquerda alinhada à esquerda e a da direita à direita
function gradeDeNumeros(p, lista, y0, passo = 196) {
  lista.forEach((med, i) => {
    const y = y0 + Math.floor(i / 2) * passo;
    numero(p, med, i % 2 ? LARGURA - M : M, y, i % 2 ? "right" : "left");
  });
}

// ------------------------------------------------------------------ figuras
function figResumo(D, op, chaves, titulo) {
  const lista = medidas(D, chaves, 6);
  const n = lista.length >= 6 ? 6 : 4;
  const c = novaTela(150 + (n / 2) * 196);
  const p = pincel(c, op);
  p.grade();
  cabecalho(p, D, 80);
  if (titulo) p.texto(MAIUSC(titulo), M, 80 + 44, { tam: 26, peso: 500, alpha: 0.75, espaco: 3 });
  gradeDeNumeros(p, lista.slice(0, n), 225);
  return c;
}

function figDestaque(D, op) {
  const c = novaTela(640);
  const p = pincel(c, op);
  p.grade();
  cabecalho(p, D, 80);
  const valor = num(distValor(D.a.m), 2);
  const w = p.texto(valor, M - 6, 380, { tam: 300, peso: 700 });
  p.texto(U(), M + w + 16, 380, { tam: 120, peso: 700, cor: p.acento });
  const tres = [MEDIDAS.tempo(D), MEDIDAS.ritmo(D), MEDIDAS.fc(D) || MEDIDAS.subida(D)].filter(Boolean);
  const xs = [M, LARGURA / 2, LARGURA - M];
  const al = ["left", "center", "right"];
  tres.forEach((med, i) => {
    p.texto(MAIUSC(med.valor), xs[i], 520, { tam: 76, peso: 700, alinhar: al[i], max: 320 });
    p.texto(MAIUSC(med.rotulo), xs[i], 560, { tam: 28, peso: 600, alinhar: al[i], espaco: 1.5, alpha: 0.92 });
  });
  return c;
}

// uma faixa com um rótulo em destaque (como "MENS 5000" nas artes) e o nome do treino ao lado
function faixa(p, rotulo, resto, y) {
  const w = p.medir(rotulo, { tam: 34, peso: 600, espaco: 1 });
  p.caixa(M - 6, y - 32, w + 16, 42, { larg: 0, preencher: BRANCO, alphaFundo: 0.28 });
  p.texto(rotulo, M + 2, y, { tam: 34, peso: 600, espaco: 1, alpha: 0.9 });
  p.texto(resto, M + w + 30, y, { tam: 34, peso: 600, espaco: 1, max: LARGURA - 2 * M - w - 40 });
}

function figParciais(D, op) {
  let lista = parciais(D);
  const s = serieDe(D);
  const cad = s?.cad ? mediaPorKm(s, "cad", lista.length) : null;
  lista = lista.map((x, i) => ({ ...x, cad: cad?.[i] ? cad[i] * 2 : null }));
  // em treino longo, uma linha a cada 5 km
  if (lista.length > 22) {
    const grupos = [];
    for (let i = 0; i < lista.length; i += 5) {
      const g = lista.slice(i, i + 5);
      const m = g.reduce((a, x) => a + x.m, 0);
      const sec = g.reduce((a, x) => a + x.s, 0);
      const hrs = g.filter((x) => x.hr);
      const cads = g.filter((x) => x.cad);
      grupos.push({
        i: grupos.length, km: g.at(-1).km, m, s: sec, ritmo: sec / (m / 1000), inteira: m >= 4500,
        hr: hrs.length ? Math.round(hrs.reduce((a, x) => a + x.hr * x.s, 0) / hrs.reduce((a, x) => a + x.s, 0)) : null,
        cad: cads.length ? cads.reduce((a, x) => a + x.cad, 0) / cads.length : null,
        el: g.reduce((a, x) => a + (x.el || 0), 0),
      });
    }
    lista = grupos;
  }
  const inteiras = lista.filter((x) => x.inteira);
  const melhor = inteiras.length ? inteiras.reduce((a, b) => (b.ritmo < a.ritmo ? b : a)) : null;
  const passo = 62;
  const c = novaTela(150 + lista.length * passo + 30);
  const p = pincel(c, op);
  p.grade();
  faixa(p, MAIUSC(t("Parciais")), limparNome(D.a.n), 80);
  const temHr = lista.some((x) => x.hr);
  const temCad = lista.some((x) => x.cad);
  lista.forEach((x, i) => {
    const y = 170 + i * passo;
    const cor = x === melhor ? p.acento : BRANCO;
    const kmTxt = Number.isInteger(Math.round(x.km * 10) / 10) ? num(Math.round(x.km)) : num(x.km, 1);
    p.texto(kmTxt, M, y, { tam: 42, peso: 700, cor: p.acento });
    let xx = 170;
    p.texto(MAIUSC(t("Ritmo")), xx, y, { tam: 34, peso: 500, alpha: 0.6 });
    p.texto(relogio(x.ritmo), xx + 92, y, { tam: 42, peso: 700, cor });
    xx = 420;
    if (temHr) {
      p.texto(MAIUSC(t("FC")), xx, y, { tam: 34, peso: 500, alpha: 0.6 });
      p.texto(x.hr ? `${x.hr} BPM` : "–", xx + 44, y, { tam: 42, peso: 700, cor });
      xx = 660;
    }
    if (temCad) {
      p.texto("CAD", xx, y, { tam: 34, peso: 500, alpha: 0.6 });
      p.texto(x.cad ? num(x.cad) : "–", xx + 62, y, { tam: 42, peso: 700, cor });
    }
    if (x.el != null) {
      const metros = Math.round(Math.abs(x.el));
      const w = p.texto(`${num(metros)} M`, LARGURA - M, y, { tam: 36, peso: 600, alinhar: "right", alpha: 0.8 });
      if (metros) p.triangulo(LARGURA - M - w - 22, y - 13, 16, x.el > 0 ? "cima" : "baixo", BRANCO);
    }
  });
  return c;
}

// a caixa das artes de gráfico: título em cima, gráfico no meio, números embaixo
function caixaGrafico(p, y, h, esquerda, direita, rodape) {
  p.caixa(M, y, LARGURA - 2 * M, h, { larg: 2, alpha: 0.85 });
  p.linha([[M, y + 76], [LARGURA - M, y + 76]], { larg: 2, alpha: 0.85, comSombra: false });
  p.linha([[M, y + h - 76], [LARGURA - M, y + h - 76]], { larg: 2, alpha: 0.85, comSombra: false });
  p.texto(MAIUSC(esquerda), M + 24, y + 50, { tam: 34, peso: 600, espaco: 2 });
  if (direita) p.texto(MAIUSC(direita), LARGURA - M - 24, y + 50, { tam: 34, peso: 600, espaco: 2, alinhar: "right", max: 460 });
  const xs = [M + 24, LARGURA / 2, LARGURA - M - 24];
  const al = ["left", "center", "right"];
  rodape.slice(0, 3).forEach(([rot, val], i) => {
    const wr = p.medir(`${MAIUSC(rot)} `, { tam: 30, peso: 500, espaco: 1 });
    const wv = p.medir(MAIUSC(val), { tam: 36, peso: 700 });
    const total = wr + wv;
    const x0 = al[i] === "left" ? xs[i] : al[i] === "center" ? xs[i] - total / 2 : xs[i] - total;
    p.texto(`${MAIUSC(rot)} `, x0, y + h - 26, { tam: 30, peso: 500, espaco: 1, alpha: 0.6 });
    p.texto(MAIUSC(val), x0 + wr, y + h - 26, { tam: 36, peso: 700 });
  });
  return { x: M + 24, y: y + 100, w: LARGURA - 2 * M - 48, h: h - 200 };
}

function figAltimetria(D, op) {
  const s = serieDe(D);
  const c = novaTela(620);
  const p = pincel(c, op);
  p.grade();
  const r = caixaGrafico(p, 60, 520, t("Altimetria e FC"), limparNome(D.a.n), [
    [t("Distância"), distTxt(D.a.m)],
    [t("Subida"), elev(D.a.el || 0)],
    [t("FC média"), D.a.hr ? `${D.a.hr} BPM` : "–"],
  ]);
  const dMax = s.d.at(-1) || 1;
  const x = (d) => r.x + (d / dMax) * (r.w - 110);
  const alts = s.alt.filter((v) => v != null);
  const aMin = Math.min(...alts);
  const aMax = Math.max(aMin + 40, Math.max(...alts));
  const yA = (a) => r.y + r.h - ((a - aMin) / (aMax - aMin)) * r.h * 0.75;
  const ptsA = s.d.map((d, i) => [x(d), yA(s.alt[i] ?? aMin)]);
  p.area(ptsA, r.y + r.h, { cor: p.acento, alpha: 0.75 });
  p.linha(ptsA, { cor: p.acento, larg: 2.5, alpha: 0.95 });
  if (s.hr?.some(Boolean)) {
    const hrs = s.hr.filter(Boolean);
    const hMin = Math.floor((Math.min(...hrs) - 5) / 50) * 50;
    const hMax = Math.ceil((Math.max(...hrs) + 5) / 50) * 50;
    const yH = (h) => r.y + r.h - ((h - hMin) / (hMax - hMin)) * r.h;
    for (let v = hMin; v <= hMax; v += 50) {
      p.linha([[r.x + r.w - 104, yH(v)], [r.x + r.w - 92, yH(v)]], { larg: 2, alpha: 0.8, comSombra: false });
      p.texto(`${v} BPM`, r.x + r.w, yH(v) + 10, { tam: 26, peso: 500, alinhar: "right", alpha: 0.8 });
    }
    const ptsH = s.d.map((d, i) => (s.hr[i] ? [x(d), yH(s.hr[i])] : null)).filter(Boolean);
    p.linha(ptsH, { larg: 2.5 });
    // o pico da FC, como os pontos de passagem nas artes
    const iMax = s.hr.indexOf(Math.max(...hrs));
    const [mx, my] = [x(s.d[iMax]), yH(s.hr[iMax])];
    p.triangulo(mx, my - 18, 14, "cima", BRANCO);
    p.texto(`${MAIUSC(t("FC máxima"))} ${s.hr[iMax]}`, Math.min(mx + 12, r.x + r.w - 260), my - 30, { tam: 28, peso: 600 });
  }
  return c;
}

function figCurvaFc(D, op) {
  const s = serieDe(D);
  const tempos = temposDa(s);
  const c = novaTela(700);
  const p = pincel(c, op);
  p.grade();
  const atleta = MAIUSC([D.atleta?.nome, D.atleta?.sobrenome].filter(Boolean).join(" "));
  p.texto(atleta || limparNome(D.a.n), M, 80, { tam: 40, peso: 600, cor: p.acento, espaco: 1.5, max: 480 });
  p.texto(dataTxt(D.data), LARGURA - M, 80, { tam: 40, peso: 600, cor: p.acento, espaco: 1.5, alinhar: "right" });
  const hrs = s.hr.filter(Boolean);
  const minHr = Math.min(...hrs);
  const r = caixaGrafico(p, 120, 560, t("Frequência cardíaca"), "", [
    [t("FC média"), `${D.a.hr || Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)} BPM`],
    [t("FC mínima"), `${minHr} BPM`],
    [t("FC máxima"), `${D.a.hrx || Math.max(...hrs)} BPM`],
  ]);
  const tMax = tempos.at(-1) || 1;
  const hMin = Math.floor((minHr - 5) / 50) * 50;
  const hMax = Math.ceil((Math.max(...hrs) + 5) / 50) * 50;
  const x = (tt) => r.x + 4 + (tt / tMax) * (r.w - 8);
  const y = (h) => r.y + r.h - ((h - hMin) / (hMax - hMin)) * r.h;
  // só o topo e o chão da escala, como nas artes: no meio, o rótulo cairia em cima da linha
  p.texto(`${hMax} BPM`, r.x, y(hMax) + 26, { tam: 24, peso: 500, alpha: 0.75 });
  p.texto(`${hMin} BPM`, r.x, y(hMin) - 10, { tam: 24, peso: 500, alpha: 0.75 });
  // marcas de tempo embaixo: de 10 em 10, 15 em 15 ou 30 em 30 min
  const passoMin = [5, 10, 15, 30, 60].find((m) => tMax / 60 / m <= 5) || 60;
  for (let m = 0; m * 60 <= tMax; m += passoMin) p.texto(`${m} MIN`, x(m * 60), r.y + r.h + 4, { tam: 22, peso: 500, alpha: 0.75, alinhar: m ? "center" : "left", base: "top" });
  const pts = s.hr.map((h, i) => (h ? [x(tempos[i]), y(h)] : null)).filter(Boolean);
  p.linha(pts, { cor: p.acento, larg: 3 });
  const iMax = s.hr.indexOf(Math.max(...hrs));
  p.triangulo(x(tempos[iMax]), y(s.hr[iMax]) - 18, 14, "cima", BRANCO);
  p.texto(MAIUSC(t("Pico")), Math.min(x(tempos[iMax]) + 12, r.x + r.w - 80), y(s.hr[iMax]) - 30, { tam: 26, peso: 600 });
  return c;
}

const ZONAS_NOMES = () => [t("zona|Recuperação"), t("zona|Aeróbico"), t("zona|Ritmo"), t("zona|Limiar"), t("zona|Anaeróbico")];
function figZonas(D, op) {
  const s = serieDe(D);
  const tempos = temposDa(s);
  const zonas = D.zonas;
  const tempoZona = zonas.map(() => 0);
  for (let i = 1; i < s.d.length; i++) {
    const h = s.hr[i];
    if (!h) continue;
    const z = zonas.findIndex((zz) => h >= zz.min && (zz.max === -1 || h < zz.max));
    tempoZona[z === -1 ? zonas.length - 1 : z] += tempos[i] - tempos[i - 1];
  }
  const total = tempoZona.reduce((a, b) => a + b, 0) || 1;
  const c = novaTela(250 + zonas.length * 120);
  const p = pincel(c, op);
  p.grade();
  cabecalho(p, D, 80);
  p.texto(MAIUSC(t("Tempo em cada zona")), M, 170, { tam: 64, peso: 700 });
  const nomes = ZONAS_NOMES();
  zonas.forEach((z, i) => {
    const y = 260 + i * 120;
    const pct = tempoZona[i] / total;
    p.texto(`Z${i + 1}`, M, y + 36, { tam: 48, peso: 700, cor: p.acento });
    p.texto(MAIUSC(nomes[i] || ""), M + 76, y + 14, { tam: 30, peso: 600, espaco: 1 });
    p.texto(z.max === -1 ? `${z.min}+ BPM` : `${z.min}–${z.max} BPM`, M + 76, y + 46, { tam: 24, peso: 500, alpha: 0.65 });
    const bx = 330;
    const bw = 470;
    p.caixa(bx, y + 8, bw, 34, { larg: 0, preencher: BRANCO, alphaFundo: 0.16 });
    if (pct > 0) p.caixa(bx, y + 8, Math.max(4, bw * pct), 34, { larg: 0, preencher: p.acento, alphaFundo: 0.45 + i * 0.13 });
    p.texto(relogio(tempoZona[i]), LARGURA - M, y + 30, { tam: 44, peso: 700, alinhar: "right" });
    p.texto(`${num(pct * 100)}%`, LARGURA - M, y + 62, { tam: 26, peso: 600, alinhar: "right", alpha: 0.75 });
  });
  return c;
}

function figBarras(D, op) {
  const lista = parciais(D);
  const c = novaTela(640);
  const p = pincel(c, op);
  p.grade();
  const inteiras = lista.filter((x) => x.inteira);
  const melhor = inteiras.reduce((a, b) => (b.ritmo < a.ritmo ? b : a), inteiras[0]);
  const pior = inteiras.reduce((a, b) => (b.ritmo > a.ritmo ? b : a), inteiras[0]);
  const r = caixaGrafico(p, 60, 540, t("Ritmo por km"), limparNome(D.a.n), [
    [t("Mais rápido"), `KM ${melhor.i + 1}`],
    [t("Média"), ritmoKm(D.a.s / (D.a.m / 1000))],
    [t("Mais lento"), `KM ${pior.i + 1}`],
  ]);
  const vel = lista.map((x) => 1000 / x.ritmo);
  const vMax = Math.max(...vel);
  const vMin = Math.min(...vel) * 0.86;
  const gap = Math.max(3, Math.min(10, (r.w / lista.length) * 0.22));
  const bw = (r.w - gap * (lista.length - 1)) / lista.length;
  const topo = r.y + 46;
  const altura = r.h - 46 - 30;
  lista.forEach((x, i) => {
    const h = Math.max(6, ((vel[i] - vMin) / (vMax - vMin)) * altura * (x.inteira ? 1 : 0.999));
    const bx = r.x + i * (bw + gap);
    const by = topo + altura - h;
    p.caixa(bx, by, bw, h, { larg: 0, preencher: x === melhor ? p.acento : BRANCO, alphaFundo: x === melhor ? 1 : x.inteira ? 0.72 : 0.4 });
    const rotular = lista.length <= 12 || (i + 1) % 5 === 0 || i === 0;
    if (rotular) p.texto(String(i + 1), bx + bw / 2, topo + altura + 30, { tam: 24, peso: 500, alinhar: "center", alpha: 0.75 });
    if (x === melhor) p.texto(relogio(x.ritmo), bx + bw / 2, by - 12, { tam: 34, peso: 700, cor: p.acento, alinhar: "center" });
  });
  // a média, tracejada
  const vMed = D.a.m / D.a.s;
  const yMed = topo + altura - ((vMed - vMin) / (vMax - vMin)) * altura;
  p.linha([[r.x, yMed], [r.x + r.w, yMed]], { larg: 2, traco: [10, 8], alpha: 0.9 });
  return c;
}

// --------------------------------------------------------------- mapas
// projeta a rota (lat, lng) para caber num retângulo, sem distorcer
function projetar(trechos, caixaR) {
  const pts = trechos.flat();
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p[1] * k);
  const ys = pts.map((p) => -p[0]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const esc = Math.min(caixaR.w / (x1 - x0 || 1e-6), caixaR.h / (y1 - y0 || 1e-6));
  const ox = caixaR.x + (caixaR.w - (x1 - x0) * esc) / 2;
  const oy = caixaR.y + (caixaR.h - (y1 - y0) * esc) / 2;
  return ([la, lo]) => [ox + (lo * k - x0) * esc, oy + (-la - y0) * esc];
}
// a rota numa lista só, com a distância acumulada (m) de cada ponto
function rotaMedida(D) {
  const trechos = trechosRota(D.a.rota);
  const pts = trechos.flat();
  const acum = [0];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const dLat = ((b[0] - a[0]) * Math.PI) / 180;
    const dLng = ((b[1] - a[1]) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    acum.push(acum[i - 1] + 12742000 * Math.asin(Math.sqrt(h)));
  }
  return { trechos, pts, acum, total: acum.at(-1) || 1 };
}
// o ponto da rota em `fracao` (0 a 1) do caminho
function pontoNa(R, fracao) {
  const alvo = Math.min(1, Math.max(0, fracao)) * R.total;
  let i = R.acum.findIndex((a) => a >= alvo);
  if (i <= 0) return R.pts[Math.max(0, i)];
  const u = (alvo - R.acum[i - 1]) / (R.acum[i] - R.acum[i - 1] || 1);
  return [R.pts[i - 1][0] + (R.pts[i][0] - R.pts[i - 1][0]) * u, R.pts[i - 1][1] + (R.pts[i][1] - R.pts[i - 1][1]) * u];
}
const trechoDaRota = (R, de, ate) => {
  const saida = [pontoNa(R, de)];
  R.pts.forEach((pt, i) => {
    const f = R.acum[i] / R.total;
    if (f > de && f < ate) saida.push(pt);
  });
  saida.push(pontoNa(R, ate));
  return saida;
};

function figRotaMarcos(D, op) {
  const R = rotaMedida(D);
  const c = novaTela(1350);
  const p = pincel(c, op);
  p.grade();
  p.texto(dataTxt(D.data), M + 70, 150, { tam: 40, peso: 600, cor: p.acento, espaco: 1.5 });
  const nome = limparNome(D.a.n);
  p.texto(nome, M + 70, 214, { tam: 66, peso: 700, cor: p.acento, espaco: 1.5, max: LARGURA - 2 * M - 140 });
  const proj = projetar(R.trechos, { x: 150, y: 290, w: 720, h: 960 });
  for (const tr of R.trechos) p.linha(tr.map(proj), { larg: 4 });
  // marcos: de N em N km, com o tempo de prova em cada um (pelas parciais)
  const lista = parciais(D);
  const km = D.a.m / 1000;
  const N = [1, 2, 5, 10, 20].find((n) => km / n <= 6) || 20;
  let acumS = 0;
  const tempoAte = [];
  for (const x of lista) {
    acumS += x.s;
    tempoAte.push(acumS);
  }
  // o rótulo vai à direita do marco; se bater em outro (ida e volta pelo mesmo caminho), vai para a esquerda
  const ocupados = [];
  const bate = (b) => ocupados.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
  for (let k = N; k < km - N * 0.4; k += N) {
    const [mx, my] = proj(pontoNa(R, (k * 1000) / D.a.m));
    p.linha([[mx - 22, my], [mx + 22, my]], { cor: p.acento, larg: 3 });
    p.bola(mx, my, 12);
    const largura = 170;
    const opcoes = [
      { al: "left", x: mx + 34, y: my },
      { al: "right", x: mx - 34, y: my },
      { al: "left", x: mx + 34, y: my + 96 },
      { al: "right", x: mx - 34, y: my - 96 },
    ].filter((o) => (o.al === "left" ? o.x + largura < LARGURA - 10 : o.x - largura > 10));
    const caixaDe = (o) => ({ x: o.al === "left" ? o.x : o.x - largura, y: o.y - 44, w: largura, h: 92 });
    const o = opcoes.find((x) => !bate(caixaDe(x))) || opcoes[0];
    ocupados.push(caixaDe(o));
    p.texto(`KM ${k}`, o.x, o.y - 2, { tam: 44, peso: 700, cor: p.acento, alinhar: o.al });
    if (tempoAte[k - 1]) p.texto(relogio(tempoAte[k - 1]), o.x, o.y + 38, { tam: 36, peso: 500, cor: p.acento, alinhar: o.al });
  }
  // largada e chegada
  const ini = proj(R.pts[0]);
  const fim = proj(R.pts.at(-1));
  const juntas = Math.hypot(ini[0] - fim[0], ini[1] - fim[1]) < 40;
  p.bola(ini[0], ini[1], 7, { cor: BRANCO });
  p.texto(MAIUSC(juntas ? t("Largada e chegada") : t("Largada")), ini[0] + 16, ini[1] + 26, { tam: 26, peso: 600 });
  if (!juntas) {
    p.bola(fim[0], fim[1], 7, { cor: BRANCO });
    p.texto(MAIUSC(t("Chegada")), fim[0] + 16, fim[1] + 26, { tam: 26, peso: 600 });
  }
  return c;
}

// o melhor trecho: o km mais rápido (ou os 5 km mais rápidos, num treino longo)
function melhorTrecho(D) {
  const lista = parciais(D).filter((x) => x.inteira);
  if (!lista.length) return null;
  const n = D.a.m >= 15000 && lista.length >= 6 ? 5 : 1;
  let melhor = null;
  for (let i = 0; i + n <= lista.length; i++) {
    const g = lista.slice(i, i + n);
    const sec = g.reduce((a, x) => a + x.s, 0);
    const m = g.reduce((a, x) => a + x.m, 0);
    if (!melhor || sec / m < melhor.s / melhor.m) melhor = { de: i, ate: i + n, s: sec, m };
  }
  return { ...melhor, n };
}

function figMelhorTrecho(D, op) {
  const B = melhorTrecho(D);
  const R = rotaMedida(D);
  const c = novaTela(1350);
  const p = pincel(c, op);
  p.grade();
  // a frase de cima: onde o melhor trecho caiu na corrida
  const total = parciais(D).filter((x) => x.inteira).length;
  const terco = (B.de + B.ate) / 2 / Math.max(1, total);
  const frase = B.n === 1
    ? terco > 0.66 ? t("Terminou mais forte: o km mais rápido foi o {k}º.", { k: B.de + 1 }) : terco < 0.34 ? t("Saiu forte: o km mais rápido foi o {k}º.", { k: B.de + 1 }) : t("O km mais rápido foi o {k}º, no meio do treino.", { k: B.de + 1 })
    : terco > 0.6 ? t("Terminou mais forte: os 5 km mais rápidos foram do km {a} ao {b}.", { a: B.de, b: B.ate }) : t("Os 5 km mais rápidos foram do km {a} ao {b}.", { a: B.de, b: B.ate });
  p.texto(limparNome(D.a.n), M, 110, { tam: 38, peso: 600, cor: p.acento, espaco: 3, max: LARGURA - 2 * M });
  p.texto(MAIUSC(frase), M, 162, { tam: 38, peso: 600, cor: p.acento, espaco: 3, max: LARGURA - 2 * M });
  const proj = projetar(R.trechos, { x: 90, y: 300, w: 440, h: 960 });
  for (const tr of R.trechos) p.linha(tr.map(proj), { larg: 4, alpha: 0.45 });
  const de = (B.de * 1000) / D.a.m;
  const ate = (B.ate * 1000) / D.a.m;
  p.linha(trechoDaRota(R, de, ate).map(proj), { cor: p.acento, larg: 7 });
  const [ax, ay] = proj(pontoNa(R, de));
  const [bx, by] = proj(pontoNa(R, ate));
  p.quadrado(ax, ay, 20);
  p.quadrado(bx, by, 20);
  const rotuloPonta = (x, y, km) => {
    const dir = x < 300;
    p.texto(`KM ${km}`, dir ? x + 24 : x - 24, y - 6, { tam: 30, peso: 600, cor: p.acento, alinhar: dir ? "left" : "right" });
  };
  rotuloPonta(ax, ay, B.de);
  rotuloPonta(bx, by, B.ate);
  // os números à direita
  const media = D.a.s / (D.a.m / 1000);
  const ritmoB = B.s / (B.m / 1000);
  const x0 = 600;
  p.texto(MAIUSC(B.n === 1 ? t("Km mais rápido") : t("5 km mais rápidos")), x0, 690, { tam: 32, peso: 600, cor: p.acento, espaco: 2 });
  p.texto(B.n === 1 ? relogio(B.s) : relogio(B.s), x0, 770, { tam: 84, peso: 700 });
  p.texto(ritmoKm(ritmoB), x0, 820, { tam: 34, peso: 600, alpha: 0.85 });
  p.texto(MAIUSC(t("Média do treino")), x0, 900, { tam: 32, peso: 600, cor: p.acento, espaco: 2 });
  p.texto(ritmoKm(media), x0, 960, { tam: 64, peso: 700 });
  const ganho = media - ritmoB;
  p.seta(x0, 1040, x0 + 70);
  p.triangulo(x0 + 110, 1028, 18, "cima", "#3BD16F");
  p.texto(relogio(ganho), x0 + 126, 1062, { tam: 76, peso: 700 });
  p.texto(MAIUSC(t("Mais rápido por km")), x0 + 126, 1104, { tam: 30, peso: 600, cor: p.acento, espaco: 2 });
  return c;
}

function figEsforcos(D, op) {
  const lista = (D.a.esforcos || []).filter((e) => e.t);
  const passo = 76;
  const c = novaTela(170 + lista.length * passo + 20);
  const p = pincel(c, op);
  p.grade();
  faixa(p, MAIUSC(t("Melhores esforços")), limparNome(D.a.n), 80);
  lista.forEach((e, i) => {
    const y = 180 + i * passo;
    const nome = MAIUSC(NOMES_ESFORCO[e.nome] || e.nome);
    const destaque = e.pr === 1;
    p.texto(nome, M, y, { tam: 42, peso: 700, cor: p.acento, max: 240 });
    p.texto(relogio(e.t), 330, y, { tam: 48, peso: 700, cor: destaque ? p.acento : BRANCO });
    p.texto(ritmoKm(e.t / (e.dist / 1000)), 520, y, { tam: 36, peso: 500, alpha: 0.75 });
    if (e.pr) {
      const selo = e.pr === 1 ? MAIUSC(t("Recorde")) : MAIUSC(t("{n}º melhor", { n: e.pr }));
      const w = p.medir(selo, { tam: 30, peso: 700, espaco: 1.5 });
      p.caixa(LARGURA - M - w - 20, y - 34, w + 20, 44, { larg: e.pr === 1 ? 0 : 2, cor: p.acento, preencher: e.pr === 1 ? p.acento : null, alphaFundo: 1, alpha: 0.9 });
      p.texto(selo, LARGURA - M - 10, y, { tam: 30, peso: 700, espaco: 1.5, alinhar: "right", cor: e.pr === 1 ? "#111111" : p.acento });
    }
  });
  return c;
}

// --------------------------------------------------------- antes e agora
const COMUNS = new Set(["corrida", "da", "de", "do", "dos", "das", "e", "a", "o", "em", "the", "run", "race", "prova", "primeira",
  "segunda", "ano", "edicao", "meia", "maratona", "half", "marathon", "km", "k", "internacional", "international"]);
const palavras = (nome) => new Set(semAcento(nome).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((x) => x.length > 1 && !COMUNS.has(x)));

// a edição anterior da mesma prova (o mesmo critério da página Provas, com distância bem parecida)
export function edicaoAnterior(a, data, corridas) {
  if (!a.prova) return null;
  const pp = palavras(a.n);
  const candidatas = corridas.filter((b) => {
    if (!b.prova || b.id === a.id || b.data.getFullYear() >= data.getFullYear()) return false;
    const pb = palavras(b.n);
    const comum = [...pp].filter((x) => pb.has(x)).length;
    const jaccard = comum / (new Set([...pp, ...pb]).size || 1);
    const meses = Math.abs(b.data.getMonth() - data.getMonth());
    return pp.size && jaccard >= 0.5 && Math.min(meses, 12 - meses) <= 1 && Math.min(a.m, b.m) / Math.max(a.m, b.m) >= 0.9;
  });
  return candidatas.sort((x, y) => y.data - x.data)[0] || null;
}

// recordes batidos neste treino e o recorde que existia antes (evolucao.json)
function recordesBatidos(D) {
  return (D.a.esforcos || [])
    .filter((e) => e.pr === 1 && e.t)
    .map((e) => {
      const antes = (D.evolucao?.esforcos?.[e.nome] || []).filter(([d, , id]) => id !== D.a.id && new Date(`${d}T12:00`) < D.data);
      const melhor = antes.length ? Math.min(...antes.map((x) => x[1])) : null;
      return melhor && melhor > e.t ? { nome: e.nome, agora: e.t, antes: melhor } : null;
    })
    .filter(Boolean);
}

function figAntesAgora(D, op) {
  const B = D.anterior;
  if (B) {
    const tA = B.e || B.s;
    const tB = D.a.e || D.a.s;
    const linhas = [
      [t("Tempo"), relogio(tA), relogio(tB)],
      [t("Ritmo"), ritmoTxt(ritmoDe(B.m, tA)), ritmoTxt(ritmoDe(D.a.m, tB))],
      B.hr && D.a.hr ? [t("FC média"), `${B.hr} BPM`, `${D.a.hr} BPM`] : null,
      B.cad && D.a.cad ? [t("Cadência"), `${Math.round(B.cad * 2)} PPM`, `${Math.round(D.a.cad * 2)} PPM`] : null,
    ].filter(Boolean);
    const c = novaTela(400 + linhas.length * 120 + 150);
    const p = pincel(c, op);
    p.grade();
    p.texto(MAIUSC(t("Antes e agora")), M, 110, { tam: 34, peso: 600, espaco: 1 });
    p.texto(limparNome(D.a.n), M, 170, { tam: 54, peso: 600, cor: p.acento, espaco: 3, max: LARGURA - 2 * M });
    const xA = 330;
    const xB = 730;
    p.texto(String(B.data.getFullYear()), xA, 300, { tam: 40, peso: 600, alpha: 0.85 });
    p.texto(String(D.data.getFullYear()), xB, 300, { tam: 40, peso: 600, alpha: 0.85 });
    linhas.forEach(([rot, a, b], i) => {
      const y = 400 + i * 120;
      p.texto(MAIUSC(rot), M, y, { tam: 30, peso: 600, cor: p.acento, espaco: 2 });
      p.texto(MAIUSC(a), xA, y, { tam: 72, peso: 700, alpha: 0.75 });
      p.texto(MAIUSC(b), xB, y, { tam: 72, peso: 700 });
    });
    p.seta(xA + 290, 400 + ((linhas.length - 1) * 120) / 2 - 20, xB - 40);
    const dif = tA - tB;
    const yF = 400 + linhas.length * 120 + 40;
    p.triangulo(xB + 10, yF - 26, 22, dif >= 0 ? "cima" : "baixo", dif >= 0 ? "#3BD16F" : VERMELHO);
    p.texto(relogio(Math.abs(dif)), xB + 34, yF, { tam: 84, peso: 700 });
    p.texto(MAIUSC(dif >= 0 ? t("Mais rápido") : t("Mais lento")), xB + 34, yF + 44, { tam: 32, peso: 600, cor: p.acento, espaco: 2 });
    return c;
  }
  const lista = recordesBatidos(D);
  const c = novaTela(330 + lista.length * 130);
  const p = pincel(c, op);
  p.grade();
  p.texto(MAIUSC(t("Recordes batidos")), M, 110, { tam: 34, peso: 600, espaco: 1 });
  p.texto(limparNome(D.a.n), M, 170, { tam: 54, peso: 600, cor: p.acento, espaco: 3, max: LARGURA - 2 * M });
  p.texto(MAIUSC(t("Antes")), 330, 260, { tam: 30, peso: 600, alpha: 0.75, espaco: 2 });
  p.texto(MAIUSC(t("Agora")), 600, 260, { tam: 30, peso: 600, alpha: 0.75, espaco: 2 });
  lista.forEach((r, i) => {
    const y = 360 + i * 130;
    p.texto(MAIUSC(NOMES_ESFORCO[r.nome] || r.nome), M, y, { tam: 48, peso: 700, cor: p.acento, max: 260 });
    p.texto(relogio(r.antes), 330, y, { tam: 64, peso: 700, alpha: 0.7 });
    p.texto(relogio(r.agora), 600, y, { tam: 64, peso: 700 });
    p.triangulo(850, y - 22, 18, "cima", "#3BD16F");
    p.texto(relogio(r.antes - r.agora), 870, y, { tam: 56, peso: 700 });
  });
  return c;
}

function figCadenciaPotencia(D, op) {
  const s = D.x.serie;
  const c = novaTela(900);
  const p = pincel(c, op);
  p.grade();
  cabecalho(p, D, 80);
  const blocos = [
    { titulo: t("Cadência"), dados: s.cad.map((v) => (v ? v * 2 : null)), cor: p.acento, valores: [[t("Média"), `${Math.round((D.a.cad || 0) * 2)} PPM`], [t("Máxima"), `${Math.round((D.x.cad_max || 0) * 2)} PPM`]] },
    { titulo: t("Potência"), dados: s.w, cor: BRANCO, valores: [[t("Média"), `${D.a.w || "–"} W`], [t("Ponderada"), `${D.x.w_ponderada || "–"} W`], [t("Máxima"), `${D.x.w_max || "–"} W`]] },
  ];
  blocos.forEach((b, i) => {
    const y = 130 + i * 380;
    p.caixa(M, y, LARGURA - 2 * M, 340, { larg: 2, alpha: 0.85 });
    p.texto(MAIUSC(b.titulo), M + 24, y + 52, { tam: 36, peso: 600, espaco: 2 });
    let xx = LARGURA - M - 24;
    for (const [rot, val] of [...b.valores].reverse()) {
      const wv = p.texto(val, xx, y + 52, { tam: 40, peso: 700, alinhar: "right" });
      const wr = p.texto(`${MAIUSC(rot)} `, xx - wv - 6, y + 52, { tam: 26, peso: 500, alinhar: "right", alpha: 0.6, espaco: 1 });
      xx -= wv + wr + 34;
    }
    // o gráfico: média móvel de 5 pontos (a cadência vem em números inteiros e ficaria em degraus) e
    // sem os 2% mais altos e mais baixos, para um pico não achatar tudo
    b.dados = b.dados.map((v, j) => {
      if (!v) return null;
      const janela = b.dados.slice(Math.max(0, j - 2), j + 3).filter(Boolean);
      return janela.reduce((a, z) => a + z, 0) / janela.length;
    });
    const vals = b.dados.filter(Boolean).sort((a, z) => a - z);
    const lo = vals[Math.floor(vals.length * 0.02)];
    const hi = vals[Math.floor(vals.length * 0.98)];
    const r = { x: M + 24, y: y + 90, w: LARGURA - 2 * M - 48, h: 220 };
    const dMax = s.d.at(-1) || 1;
    const pts = s.d.map((d, j) => (b.dados[j] ? [r.x + (d / dMax) * r.w, r.y + r.h - ((Math.min(hi, Math.max(lo, b.dados[j])) - lo) / (hi - lo || 1)) * r.h] : null)).filter(Boolean);
    p.linha(pts, { cor: b.cor, larg: 2.5 });
  });
  return c;
}

function figCondicoes(D, op) {
  const itens = [
    { valor: hora(D.data), rotulo: t("Saída") },
    MEDIDAS.temperatura(D),
    D.a.lugar?.cidade ? { valor: D.a.lugar.cidade, rotulo: t("Cidade") } : null,
    D.tenis ? { valor: D.tenis, rotulo: t("Tênis") } : null,
    D.a.ap ? { valor: D.a.ap, rotulo: t("Relógio") } : null,
    MEDIDAS.calorias(D),
  ].filter(Boolean).slice(0, 4);
  const c = novaTela(150 + Math.ceil(itens.length / 2) * 196);
  const p = pincel(c, op);
  p.grade();
  cabecalho(p, D, 80);
  itens.forEach((med, i) => {
    const y = 225 + Math.floor(i / 2) * 196;
    numero(p, med, i % 2 ? LARGURA - M : M, y, i % 2 ? "right" : "left", { tam: 96, max: 470 });
  });
  return c;
}

// --------------------------------------------------------------- catálogo
// `pronta(D)`: se o treino tem o que a figura precisa
export const FIGURAS = [
  { id: "resumo", nome: () => t("Resumo"), pronta: (D) => D.a.m > 0 && D.a.s > 0, desenhar: (D, op) => figResumo(D, op, ["tempo", "distancia", "ritmo", "fc", "subida", "cadencia", "potencia", "calorias"]) },
  { id: "destaque", nome: () => t("Distância em destaque"), pronta: (D) => D.a.m > 0 && D.a.s > 0, desenhar: figDestaque },
  { id: "tecnico", nome: () => t("Resumo técnico"), pronta: (D) => medidas(D, ["esforco", "potencia", "potenciaPond", "cadencia", "fcmax", "energia", "calorias", "temperatura"], 6).length >= 4, desenhar: (D, op) => figResumo(D, op, ["esforco", "potencia", "potenciaPond", "cadencia", "fcmax", "energia", "calorias", "temperatura"]) },
  { id: "parciais", nome: () => t("Parciais"), pronta: (D) => parciais(D).length >= 2, desenhar: figParciais },
  { id: "barras", nome: () => t("Ritmo por km"), pronta: (D) => parciais(D).filter((x) => x.inteira).length >= 3, desenhar: figBarras },
  { id: "altimetria", nome: () => t("Altimetria e FC"), pronta: (D) => serieDe(D)?.alt?.some((v) => v != null), desenhar: figAltimetria },
  { id: "curvafc", nome: () => t("Curva de FC"), pronta: (D) => serieDe(D)?.hr?.filter(Boolean).length > 10, desenhar: figCurvaFc },
  { id: "zonas", nome: () => t("Zonas de FC"), pronta: (D) => serieDe(D)?.hr?.filter(Boolean).length > 10 && D.zonas?.length >= 3, desenhar: figZonas },
  { id: "rota", nome: () => t("Rota com marcos"), pronta: (D) => !!D.a.rota && D.a.m >= 2000 && parciais(D).length >= 2, desenhar: figRotaMarcos },
  { id: "trecho", nome: () => t("Melhor trecho"), pronta: (D) => !!D.a.rota && parciais(D).filter((x) => x.inteira).length >= 3, desenhar: figMelhorTrecho },
  { id: "esforcos", nome: () => t("Melhores esforços"), pronta: (D) => (D.a.esforcos || []).filter((e) => e.t).length >= 2, desenhar: figEsforcos },
  { id: "antes", nome: () => t("Antes e agora"), pronta: (D) => !!D.anterior || recordesBatidos(D).length > 0, desenhar: figAntesAgora },
  { id: "cadencia", nome: () => t("Cadência e potência"), pronta: (D) => D.x?.serie?.cad?.some(Boolean) && D.x?.serie?.w?.some(Boolean), desenhar: figCadenciaPotencia },
  { id: "condicoes", nome: () => t("Condições"), pronta: () => true, desenhar: figCondicoes },
];

// o PNG da figura (para baixar, copiar ou compartilhar)
export const pngDe = (canvas) => new Promise((r) => canvas.toBlob(r, "image/png"));

// espera a letra condensada carregar: sem ela, o canvas desenharia com a letra reserva
export async function carregarFonte() {
  if (!document.fonts?.load) return;
  await Promise.all([500, 600, 700].map((p) => document.fonts.load(`${p} 40px "Barlow Condensed"`)));
}
