// Figuras para compartilhar: as métricas de um treino em PNG de fundo transparente, para pôr por cima de
// uma foto (story do Instagram, post do LinkedIn). O estilo segue as artes da Coros: letra condensada,
// números grandes com o nome embaixo, uma cor de destaque, quadrados vermelhos nas pontas e, se quiser,
// a grade técnica com as letras das colunas.
//
// Cada figura é desenhada num <canvas> de 1080 px de largura (a altura muda de uma para outra) e sai
// em PNG pelo canvas.toBlob, que já guarda a transparência.
import {
  chaveDia, dataCurta, dataLonga, distValor, elev, grupoDe, hora, LOCALE, NOMES_ESFORCO, num, relogio, rotuloDist, semAcento, t, trechosRota,
} from "./comum.js";

export const LARGURA = 1080;
// as cores de destaque: o verde-limão das artes da Coros, o laranja do site, o creme, o branco,
// o amarelo do cartaz "Muga" (Arc'teryx) e o âmbar do "Outrun"
export const CORES = { neon: "#E4FF3A", laranja: "#F0894F", creme: "#EBD9B4", branco: "#FFFFFF", muga: "#FFE500", outrun: "#F3A83B" };
export const NOMES_CORES = () => ({ neon: t("Verde-limão"), laranja: t("Laranja"), creme: t("Creme"), branco: t("Branco"), muga: t("Amarelo"), outrun: t("Âmbar") });

function metaDoAno(perfil, ano) {
  const m = perfil?.meta_anual_km;
  return Number(m?.[ano] ?? (typeof m === "number" ? m : 0)) || 0;
}

// Tudo o que as figuras usam de um treino. `T` é o arquivo do treino (data/atividades/<id>.json, já com
// .data), `atividades` a lista do site já preparada (para os 30 dias e o ano), `anterior` a edição
// anterior da prova (com a cadência do arquivo dela), se houver.
export function dadosDoTreino({ T, S, P, atividades, evolucao, anterior }) {
  const serie = T.serie?.d?.length ? T.serie : null;
  return {
    a: T,
    data: T.data,
    x: {
      esforco_relativo: T.re, w_max: T.wx, w_ponderada: T.wp, kj: T.kj, alt_max: T.altx, alt_min: T.altn, temp_media: T.temp,
      cad_max: serie?.cad?.some(Boolean) ? Math.max(...serie.cad.filter(Boolean)) : null,
      serie,
    },
    zonas: (S.zonas_fc || []).filter((z) => z.max !== 0),
    atleta: S.atleta,
    tenis: (S.equipamento || []).find((g) => g.id === T.g)?.nome || null,
    atividades: atividades || [],
    meta: metaDoAno(P, T.data.getFullYear()),
    evolucao,
    anterior,
  };
}
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

// ------------------------------------------------------- as 5 figuras novas
// um triângulo para baixo com nome e número ao lado, como os pontos de passagem das artes
function marcador(p, x, y, nome, valor, lado = "direita") {
  p.triangulo(x, y - 22, 26, "baixo", p.acento);
  const dir = lado === "direita";
  const tx = dir ? x + 28 : x - 28;
  p.texto(MAIUSC(nome), tx, y - 26, { tam: 30, peso: 600, espaco: 1.5, alinhar: dir ? "left" : "right" });
  p.texto(valor, tx, y + 8, { tam: 26, peso: 500, alpha: 0.8, alinhar: dir ? "left" : "right" });
}

// "Dados do percurso": a tabela de cima e o perfil de altimetria enchendo a parte de baixo
function figDadosPercurso(D, op) {
  const s = serieDe(D);
  const alts = s.alt.filter((v) => v != null);
  const aMin = D.x?.alt_min ?? Math.min(...alts);
  const aMax = D.x?.alt_max ?? Math.max(...alts);
  const linhas = [
    [t("Distância total"), distTxt(D.a.m)],
    [t("Tempo"), relogio(tempoDe(D.a))],
    [t("Subida acumulada"), MAIUSC(elev(D.a.el || 0))],
    [t("Altitude mínima"), MAIUSC(elev(aMin))],
    [t("Altitude máxima"), MAIUSC(elev(aMax))],
  ];
  const c = novaTela(1350);
  const p = pincel(c, op);
  p.grade();
  const x0 = 150;
  const x1 = LARGURA - 150;
  p.texto(MAIUSC(t("Dados do percurso")), x0, 84, { tam: 32, peso: 500, espaco: 2 });
  p.texto(limparNome(D.a.n), x1, 84, { tam: 32, peso: 600, cor: p.acento, espaco: 2, alinhar: "right", max: 440 });
  p.texto(dataTxt(D.data), x1, 124, { tam: 30, peso: 500, alpha: 0.6, espaco: 2, alinhar: "right" });
  let y = 160;
  for (const [rot, val] of linhas) {
    p.linha([[x0, y], [x1, y]], { larg: 1.5, alpha: 0.55, comSombra: false });
    p.texto(MAIUSC(rot), x0, y + 50, { tam: 32, peso: 500, espaco: 2 });
    p.texto(val, x1, y + 50, { tam: 32, peso: 500, espaco: 2, alinhar: "right" });
    y += 76;
  }
  // o perfil: de ponta a ponta, sem margem, como nas artes
  const base = c.height;
  const topo = 880;
  const dMax = s.d.at(-1) || 1;
  const x = (d) => (d / dMax) * LARGURA;
  const hi = Math.max(aMax, aMin + 30);
  const yA = (a) => base - 60 - ((a - aMin) / (hi - aMin)) * (base - 60 - topo);
  const pts = s.d.map((d, i) => [x(d), yA(s.alt[i] ?? aMin)]);
  p.area([[0, pts[0][1]], ...pts, [LARGURA, pts.at(-1)[1]]], base, { cor: p.acento, alpha: 1 });
  p.linha(pts, { cor: p.acento, larg: 3 });
  // a largada e o ponto mais alto
  const R = D.a.rota ? rotaMedida(D) : null;
  const juntas = R && Math.hypot(R.pts[0][0] - R.pts.at(-1)[0], R.pts[0][1] - R.pts.at(-1)[1]) < 0.003;
  marcador(p, 36, pts[0][1] - 18, juntas ? t("Largada e chegada") : t("Largada"), MAIUSC(elev(s.alt.find((v) => v != null))));
  // o ponto mais alto: o lugar vem da série; o número, o mesmo da tabela (o do Strava)
  const iMax = s.alt.indexOf(Math.max(...alts));
  const xm = x(s.d[iMax]);
  if (xm > 260) marcador(p, Math.min(xm, LARGURA - 24), pts[iMax][1] - 18, t("Ponto mais alto"), MAIUSC(elev(aMax)), xm > LARGURA - 300 ? "esquerda" : "direita");
  return c;
}

// "Últimos 30 dias": os km de cada dia até o treino, contra os 30 dias antes disso
function figUltimos30(D, op) {
  const grupo = grupoDe(D.a.t);
  const fim = new Date(D.data.getFullYear(), D.data.getMonth(), D.data.getDate());
  const dia = (n) => new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - n);
  const kmDia = new Map();
  for (const a of D.atividades) if (a.grupo === grupo) kmDia.set(a.dia, (kmDia.get(a.dia) || 0) + a.m / 1000);
  const dias = Array.from({ length: 30 }, (_, i) => dia(29 - i));
  const valores = dias.map((d) => kmDia.get(chaveDia(d)) || 0);
  const total = valores.reduce((a, b) => a + b, 0);
  const antes = Array.from({ length: 30 }, (_, i) => kmDia.get(chaveDia(dia(30 + i))) || 0).reduce((a, b) => a + b, 0);
  const c = novaTela(820);
  const p = pincel(c, op);
  p.grade();
  p.texto(MAIUSC(grupo === "corrida" ? t("Corrida em 30 dias") : t("Treino em 30 dias")), M, 84, { tam: 40, peso: 700, espaco: 1 });
  const bloco = (x, rotulo, valor, seta) => {
    p.texto(rotulo, x, 150, { tam: 32, peso: 500, alpha: 0.9 });
    const w = p.texto(num(distValor(valor * 1000)), x, 262, { tam: 120, peso: 700 });
    const wu = p.texto(U(), x + w + 8, 262, { tam: 48, peso: 600 });
    if (seta) {
      const sx = x + w + wu + 40;
      const cima = seta === "cima";
      p.linha([[sx, cima ? 258 : 190], [sx, cima ? 190 : 258]], { larg: 7 });
      p.linha([[sx - 20, cima ? 210 : 238], [sx, cima ? 190 : 258], [sx + 20, cima ? 210 : 238]], { larg: 7 });
    }
  };
  bloco(M, t("Últimos 30 dias"), total, Math.abs(total - antes) < 0.5 ? null : total > antes ? "cima" : "baixo");
  bloco(560, t("30 dias anteriores"), antes, null);
  // as barras, uma por dia; o dia do treino fica em branco
  const r = { x: M, y: 340, w: 860, h: 360 };
  const maxKm = Math.max(10, ...valores);
  const passoEixo = maxKm > 30 ? 10 : 5;
  const topoEixo = Math.ceil(maxKm / passoEixo) * passoEixo;
  const yV = (v) => r.y + r.h - (v / topoEixo) * r.h;
  for (let v = 0; v <= topoEixo; v += passoEixo * (topoEixo / passoEixo > 4 ? 2 : 1)) {
    p.texto(`${num(distValor(v * 1000))} ${U()}`, r.x + r.w + 24, yV(v) + 10, { tam: 26, peso: 500, alpha: 0.85 });
  }
  const gap = 8;
  const bw = (r.w - gap * 29) / 30;
  valores.forEach((v, i) => {
    if (v <= 0) return;
    const bx = r.x + i * (bw + gap);
    const by = yV(v);
    const ehHoje = i === 29;
    const g = p.ctx.createLinearGradient(0, by, 0, r.y + r.h);
    g.addColorStop(0, ehHoje ? BRANCO : p.acento);
    g.addColorStop(1, ehHoje ? "rgba(255,255,255,0.35)" : `${p.acento}55`);
    p.ctx.save();
    p.ctx.fillStyle = g;
    p.ctx.fillRect(bx, by, bw, r.y + r.h - by);
    p.ctx.restore();
  });
  for (let i = 0; i < 30; i += 7) p.texto(MAIUSC(dataCurta(dias[i])), r.x + i * (bw + gap) + bw / 2, r.y + r.h + 46, { tam: 28, peso: 500, alinhar: "center", alpha: 0.9 });
  return c;
}

// a cor de um trecho, com u de 0 (o mais lento) a 1 (o mais rápido): branco apagado, branco, destaque
function corDoRitmo(acento, u) {
  if (u < 0.5) return `rgba(255,255,255,${(0.22 + (u / 0.5) * 0.68).toFixed(2)})`;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(acento.slice(i, i + 2), 16));
  const e = (u - 0.5) / 0.5;
  const m = (a, z) => Math.round(a + (z - a) * e);
  return `rgba(${m(255, r)},${m(255, g)},${m(255, b)},${(0.9 + 0.1 * e).toFixed(2)})`;
}

// "Rota pelo ritmo": cada trecho da rota pintado pelo ritmo naquele ponto
function figRotaRitmo(D, op) {
  const R = rotaMedida(D);
  const s = serieDe(D);
  const vel = s.v.map((v, i) => {
    const janela = s.v.slice(Math.max(0, i - 2), i + 3).filter((x) => x > 0.8);
    return janela.length ? janela.reduce((a, b) => a + b, 0) / janela.length : null;
  });
  const ordem = vel.filter(Boolean).sort((a, b) => a - b);
  const lo = ordem[Math.floor(ordem.length * 0.05)];
  const hi = ordem[Math.floor(ordem.length * 0.95)];
  // a cor vem da posição do ritmo entre todos os do treino (não da diferença em s/km): num treino
  // constante, as pequenas variações ainda aparecem
  const posicao = (v) => {
    let a = 0;
    let z = ordem.length;
    while (a < z) {
      const m = (a + z) >> 1;
      if (ordem[m] < v) a = m + 1;
      else z = m;
    }
    return a / Math.max(1, ordem.length - 1);
  };
  let j = 0;
  const velEm = (d) => {
    while (j < s.d.length - 1 && s.d[j + 1] <= d) j++;
    return vel[j] ?? vel.find(Boolean);
  };
  const c = novaTela(1350);
  const p = pincel(c, op);
  p.grade();
  p.texto(dataTxt(D.data), M + 70, 150, { tam: 40, peso: 600, cor: p.acento, espaco: 1.5 });
  p.texto(limparNome(D.a.n), M + 70, 214, { tam: 62, peso: 700, espaco: 1.5, max: LARGURA - 2 * M - 140 });
  const proj = projetar(R.trechos, { x: 120, y: 280, w: 840, h: 840 });
  // a sombra embaixo de tudo, para a rota aparecer em qualquer foto
  if (op.sombra) for (const tr of R.trechos) p.linha(tr.map(proj), { cor: "rgba(0,0,0,0.45)", larg: 14, comSombra: false });
  let k = 0;
  for (const tr of R.trechos) {
    for (let i = 1; i < tr.length; i++) {
      k++;
      const d = (R.acum[k] / R.total) * D.a.m;
      const u = Math.min(1, Math.max(0, posicao(velEm(d) || lo)));
      p.linha([proj(tr[i - 1]), proj(tr[i])], { cor: corDoRitmo(p.acento, u), larg: 8, comSombra: false });
    }
    k++;
  }
  // a legenda: do lento ao rápido
  const lx = 150;
  const lw = LARGURA - 300;
  const ly = 1210;
  const g = p.ctx.createLinearGradient(lx, 0, lx + lw, 0);
  g.addColorStop(0, corDoRitmo(p.acento, 0));
  g.addColorStop(0.5, corDoRitmo(p.acento, 0.5));
  g.addColorStop(1, corDoRitmo(p.acento, 1));
  p.ctx.save();
  p.ctx.fillStyle = g;
  p.ctx.fillRect(lx, ly, lw, 14);
  p.ctx.restore();
  p.texto(MAIUSC(t("Mais lento")), lx, ly + 58, { tam: 28, peso: 600, espaco: 1.5 });
  p.texto(ritmoKm(1000 / lo), lx, ly + 96, { tam: 28, peso: 500, alpha: 0.8 });
  p.texto(MAIUSC(t("Mais rápido")), lx + lw, ly + 58, { tam: 28, peso: 600, espaco: 1.5, alinhar: "right", cor: p.acento });
  p.texto(ritmoKm(1000 / hi), lx + lw, ly + 96, { tam: 28, peso: 500, alpha: 0.8, alinhar: "right" });
  return c;
}

// "Relógio das parciais": cada km é um raio em volta do tempo total; quanto mais longo, mais rápido
function figRelogio(D, op) {
  const lista = parciais(D);
  const c = novaTela(1180);
  const p = pincel(c, op);
  p.grade();
  cabecalho(p, D, 80);
  const cx = LARGURA / 2;
  const cy = 640;
  const r0 = 250;
  const rMax = 470;
  const vel = lista.map((x) => 1000 / x.ritmo);
  const inteiras = lista.filter((x) => x.inteira);
  const melhor = inteiras.reduce((a, b) => (b.ritmo < a.ritmo ? b : a), inteiras[0]);
  const vHi = Math.max(...vel);
  const vLo = Math.min(...vel) * 0.85;
  const passo = (Math.PI * 2) / lista.length;
  const espessura = Math.min(34, ((Math.PI * 2 * r0) / lista.length) * 0.62);
  const comprimento = (v) => 30 + ((v - vLo) / (vHi - vLo || 1)) * (rMax - r0 - 30);
  // o anel tracejado é o ritmo médio: o raio que passa dele foi um km mais rápido que a média
  const rMedia = r0 + comprimento(D.a.m / tempoDe(D.a));
  p.ctx.save();
  p.ctx.globalAlpha = 0.55;
  p.ctx.strokeStyle = BRANCO;
  p.ctx.lineWidth = 2;
  p.ctx.setLineDash([8, 10]);
  p.ctx.beginPath();
  p.ctx.arc(cx, cy, rMedia, 0, Math.PI * 2);
  p.ctx.stroke();
  p.ctx.restore();
  lista.forEach((x, i) => {
    const ang = -Math.PI / 2 + passo * (i + 0.5);
    const len = comprimento(vel[i]);
    const [c1, s1] = [Math.cos(ang), Math.sin(ang)];
    p.linha([[cx + c1 * r0, cy + s1 * r0], [cx + c1 * (r0 + len), cy + s1 * (r0 + len)]], {
      cor: x === melhor ? p.acento : BRANCO, larg: espessura, alpha: x === melhor ? 1 : x.inteira ? 0.78 : 0.4,
    });
    if (i === 0 || (i + 1) % 5 === 0 || x === melhor) {
      const rr = r0 + len + espessura / 2 + (x === melhor ? 44 : 30);
      const lx = Math.min(LARGURA - 60, Math.max(60, cx + c1 * rr));
      p.texto(x === melhor ? relogio(x.ritmo) : String(i + 1), lx, cy + s1 * rr + 12, { tam: x === melhor ? 38 : 26, peso: x === melhor ? 700 : 500, alinhar: "center", cor: x === melhor ? p.acento : BRANCO, alpha: x === melhor ? 1 : 0.8 });
    }
  });
  p.texto(distTxt(D.a.m), cx, cy - 70, { tam: 40, peso: 600, alinhar: "center", cor: p.acento });
  p.texto(relogio(tempoDe(D.a)), cx, cy + 40, { tam: 120, peso: 700, alinhar: "center", max: r0 * 1.8 });
  // o anel tracejado é a média: está escrito no meio, embaixo do tempo
  p.texto(`${MAIUSC(t("Média"))} ${ritmoKm(tempoDe(D.a) / (D.a.m / 1000))}`, cx, cy + 92, { tam: 28, peso: 600, alinhar: "center", alpha: 0.85, espaco: 1.5 });
  return c;
}

// "O treino no ano": os km do ano em pontos (como a página "O ano em pontos"), com os deste treino acesos
function figAnoPontos(D, op) {
  const ano = D.data.getFullYear();
  const doAno = D.atividades.filter((a) => a.grupo === "corrida" && a.ano === ano).sort((a, b) => a.data - b.data);
  const pontos = [];
  let acum = 0;
  for (const a of doAno) {
    const ini = acum;
    acum += a.m / 1000;
    for (let k = Math.floor(ini) + 1; k <= Math.floor(acum); k++) pontos.push(String(a.id) === String(D.a.id));
  }
  const colunas = 50;
  const passo = (LARGURA - 2 * M) / colunas;
  const n = Math.max(pontos.length, D.meta);
  const linhas = Math.ceil(n / colunas);
  const y0 = 230;
  const c = novaTela(y0 + linhas * passo + 190);
  const p = pincel(c, op);
  p.grade();
  cabecalho(p, D, 80);
  p.texto(MAIUSC(t("{ano} em pontos", { ano })), M, 170, { tam: 64, peso: 700 });
  const pos = (k) => [M + ((k % colunas) + 0.5) * passo, y0 + (Math.floor(k / colunas) + 0.5) * passo];
  const ctx = p.ctx;
  ctx.save();
  pontos.forEach((nosso, k) => {
    const [x, y] = pos(k);
    ctx.globalAlpha = nosso ? 1 : 0.32;
    ctx.fillStyle = nosso ? p.acento : BRANCO;
    ctx.beginPath();
    ctx.arc(x, y, passo * (nosso ? 0.36 : 0.3), 0, Math.PI * 2);
    ctx.fill();
  });
  // o que falta para a meta, em anéis
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = BRANCO;
  ctx.lineWidth = 1.5;
  for (let k = pontos.length; k < D.meta; k++) {
    const [x, y] = pos(k);
    ctx.beginPath();
    ctx.arc(x, y, passo * 0.28, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // a linha da meta, em degrau, como na página
  if (D.meta) {
    const q = Math.floor(D.meta / colunas);
    const resto = D.meta % colunas;
    const yq = y0 + q * passo;
    const pts = resto ? [[M, yq + passo], [M + resto * passo, yq + passo], [M + resto * passo, yq], [LARGURA - M, yq]] : [[M, yq], [LARGURA - M, yq]];
    p.linha(pts, { larg: 3, traco: [10, 7], alpha: 0.95 });
  }
  const yR = y0 + linhas * passo + 100;
  const tres = [
    [t("Este treino"), distTxt(D.a.m)],
    [t("No ano"), distTxt(acum * 1000, 0)],
    D.meta ? [t("Meta"), distTxt(D.meta * 1000, 0)] : null,
  ].filter(Boolean);
  const xs = [M, LARGURA / 2, LARGURA - M];
  const al = ["left", "center", "right"];
  tres.forEach(([rot, val], i) => {
    p.texto(val, xs[i], yR, { tam: 60, peso: 700, alinhar: al[i], cor: i === 0 ? p.acento : BRANCO });
    p.texto(MAIUSC(rot), xs[i], yR + 40, { tam: 28, peso: 600, alinhar: al[i], espaco: 1.5, alpha: 0.9 });
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
  // `nova`: ainda esperando a aprovação do Victor; no site só aparecem com ?figuras=novas no endereço
  { id: "percurso", nova: true, nome: () => t("Dados do percurso"), pronta: (D) => serieDe(D)?.alt?.some((v) => v != null), desenhar: figDadosPercurso },
  { id: "trintadias", nova: true, nome: () => t("Últimos 30 dias"), pronta: (D) => D.atividades.length > 0, desenhar: figUltimos30 },
  { id: "rotaritmo", nova: true, nome: () => t("Rota pelo ritmo"), pronta: (D) => !!D.a.rota && serieDe(D)?.v?.filter((v) => v > 0.8).length > 20, desenhar: figRotaRitmo },
  { id: "relogio", nova: true, nome: () => t("Relógio das parciais"), pronta: (D) => parciais(D).filter((x) => x.inteira).length >= 3, desenhar: figRelogio },
  { id: "anopontos", nova: true, nome: () => t("O treino no ano"), pronta: (D) => grupoDe(D.a.t) === "corrida" && D.atividades.length > 0, desenhar: figAnoPontos },
];

// o PNG da figura (para baixar, copiar ou compartilhar)
export const pngDe = (canvas) => new Promise((r) => canvas.toBlob(r, "image/png"));

// espera a letra condensada carregar: sem ela, o canvas desenharia com a letra reserva
export async function carregarFonte() {
  if (!document.fonts?.load) return;
  await Promise.all([500, 600, 700].map((p) => document.fonts.load(`${p} 40px "Barlow Condensed"`)));
}
