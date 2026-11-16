// Gráficos em SVG feitos à mão. As cores vêm das variáveis CSS do tema.
import { esc, num, chaveDia, inicioSemana, MESES_CURTOS, DIAS_CURTOS, t } from "./comum.js";

function escalaBonita(max, passos = 4) {
  if (!(max > 0)) return { topo: 1, passo: 0.25 };
  const bruto = max / passos;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  let f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  // 2,5 vira "3, 5, 8" quando o eixo arredonda para inteiro: troca por 2 ou 5
  if (f === 2.5 && !Number.isInteger(2.5 * mag)) f = max / (2 * mag) <= passos + 1.5 ? 2 : 5;
  const passo = f * mag;
  return { topo: Math.ceil(max / passo - 1e-9) * passo, passo };
}

function marcas(min, max, quantas = 4) {
  const { passo } = escalaBonita(max - min, quantas);
  const ini = Math.ceil(min / passo) * passo;
  const lista = [];
  for (let v = ini; v <= max + 1e-9; v += passo) lista.push(+v.toFixed(6));
  return lista;
}

const svg = (largura, altura, corpo, rotulo = "") =>
  `<svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img"${rotulo ? ` aria-label="${esc(rotulo)}"` : ""}>${corpo}</svg>`;

/** Barras verticais. dados: [{rotulo, valor, dica, classe, cor}] */
export function barras(el, { dados, altura = 220, fmtEixo = (v) => num(v), rotuloCada = 1, mostrarValores = false, fmtValor = (v) => num(v), rotulo = "", aoClicar } = {}) {
  const largura = Math.max(280, el.clientWidth || 600);
  const m = { t: mostrarValores ? 18 : 8, r: 2, b: 24, l: 38 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;
  const { topo, passo } = escalaBonita(Math.max(0, ...dados.map((d) => d.valor)));
  const banda = w / Math.max(1, dados.length);
  const folga = banda > 18 ? Math.min(banda * 0.25, 10) : banda > 6 ? 2 : 1;
  const bw = Math.max(1, banda - folga);
  const y = (v) => m.t + h - (v / topo) * h;
  let corpo = "";
  for (let v = 0; v <= topo + 1e-9; v += passo) {
    corpo += `<line class="${v === 0 ? "eixo" : "grade"}" x1="${m.l}" x2="${largura - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    corpo += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${esc(fmtEixo(v))}</text>`;
  }
  dados.forEach((d, i) => {
    const x = m.l + i * banda + folga / 2;
    const alto = d.valor > 0 ? Math.max(2, (d.valor / topo) * h) : 0;
    const estilo = d.cor ? ` style="fill:${d.cor}"` : "";
    // a área clicável cobre a coluna toda: facilita acertar barras finas
    corpo += `<g data-i="${i}"${d.dica ? ` data-dica="${esc(d.dica)}"` : ""}${aoClicar ? ' style="cursor:pointer"' : ""}>`;
    corpo += `<rect x="${m.l + i * banda}" y="${m.t}" width="${banda}" height="${h}" fill="transparent"/>`;
    if (alto) corpo += `<rect class="barra ${d.classe || ""}" x="${x}" y="${y(0) - alto}" width="${bw}" height="${alto}" rx="${bw > 6 ? 2 : 0}"${estilo}/>`;
    corpo += "</g>";
    if (mostrarValores && d.valor > 0) corpo += `<text class="rotulo-valor" x="${x + bw / 2}" y="${y(0) - alto - 5}" text-anchor="middle">${esc(fmtValor(d.valor))}</text>`;
    if (d.rotulo != null && i % rotuloCada === 0) corpo += `<text x="${x + bw / 2}" y="${altura - 6}" text-anchor="middle">${esc(d.rotulo)}</text>`;
  });
  el.innerHTML = svg(largura, altura, corpo, rotulo);
  if (aoClicar) {
    el.onclick = (ev) => {
      const g = ev.target.closest("g[data-i]");
      if (g) aoClicar(dados[+g.dataset.i], +g.dataset.i);
    };
  }
}

/** Barras horizontais em HTML. dados: [{rotulo, valor, texto, cor, dica, extra}] */
export function barrasH(el, dados, { max } = {}) {
  if (!dados.length) {
    el.innerHTML = `<p class="vazio">${t("Sem dados para mostrar aqui.")}</p>`;
    return;
  }
  const maior = max ?? Math.max(...dados.map((d) => d.valor), 1);
  el.innerHTML = `<div class="barras-h">${dados
    .map(
      (d) => `<div class="linha-h"${d.dica ? ` data-dica="${esc(d.dica)}"` : ""}>
        <span class="rotulo">${esc(d.rotulo)}${d.extra ? `<span class="aposentado">${esc(d.extra)}</span>` : ""}</span>
        <span class="trilho"><i style="width:${Math.max(0.5, (d.valor / maior) * 100)}%;${d.cor ? `background:${d.cor}` : ""}"></i></span>
        <span class="valor">${esc(d.texto ?? num(d.valor))}</span>
      </div>`
    )
    .join("")}</div>`;
}

/** Dispersão. pontos: [{x, y, dica}] */
export function dispersao(el, { pontos, altura = 260, fmtX = (v) => num(v), fmtY = (v) => num(v), rotuloX = "", rotuloY = "", inverterX = false, rotulo = "" }) {
  const largura = Math.max(280, el.clientWidth || 600);
  const m = { t: 10, r: 10, b: 38, l: 42 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;
  if (!pontos.length) {
    el.innerHTML = `<p class="vazio">${t("Sem dados para mostrar aqui.")}</p>`;
    return;
  }
  const xs = pontos.map((p) => p.x).sort((a, b) => a - b);
  const ys = pontos.map((p) => p.y).sort((a, b) => a - b);
  // corta 1% de cada ponta para um treino estranho não achatar o gráfico
  const q = (lista, f) => lista[Math.min(lista.length - 1, Math.max(0, Math.floor(f * (lista.length - 1))))];
  let [x0, x1] = [q(xs, 0.01), q(xs, 0.99)];
  let [y0, y1] = [q(ys, 0.01), q(ys, 0.99)];
  const px = (x1 - x0) * 0.06 || 1;
  const py = (y1 - y0) * 0.08 || 1;
  x0 -= px; x1 += px; y0 -= py; y1 += py;
  const sx = (v) => m.l + (inverterX ? (x1 - v) / (x1 - x0) : (v - x0) / (x1 - x0)) * w;
  const sy = (v) => m.t + h - ((v - y0) / (y1 - y0)) * h;
  let corpo = "";
  for (const v of marcas(y0, y1)) {
    corpo += `<line class="grade" x1="${m.l}" x2="${largura - m.r}" y1="${sy(v)}" y2="${sy(v)}"/>`;
    corpo += `<text x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end">${esc(fmtY(v))}</text>`;
  }
  for (const v of marcas(x0, x1, 5)) {
    corpo += `<text x="${sx(v)}" y="${altura - 22}" text-anchor="middle">${esc(fmtX(v))}</text>`;
  }
  corpo += `<line class="eixo" x1="${m.l}" x2="${largura - m.r}" y1="${m.t + h}" y2="${m.t + h}"/>`;
  corpo += `<text x="${m.l + w / 2}" y="${altura - 4}" text-anchor="middle">${esc(rotuloX)}</text>`;
  corpo += `<text x="${12}" y="${m.t + h / 2}" text-anchor="middle" transform="rotate(-90 12 ${m.t + h / 2})">${esc(rotuloY)}</text>`;
  for (const p of pontos) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    corpo += `<circle class="ponto" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3.2"${p.dica ? ` data-dica="${esc(p.dica)}"` : ""}/>`;
  }
  el.innerHTML = svg(largura, altura, corpo, rotulo);
}

/** Rosca. fatias: [{rotulo, valor, cor, dica}] */
export function rosca(el, { fatias, tamanho = 170, centro = ["", ""], rotulo = "" }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const r = tamanho / 2;
  const ri = r * 0.64;
  let ang = -Math.PI / 2;
  let corpo = "";
  if (!total) {
    corpo = `<circle cx="${r}" cy="${r}" r="${(r + ri) / 2}" fill="none" stroke="var(--linha)" stroke-width="${r - ri}"/>`;
  } else if (fatias.filter((f) => f.valor > 0).length === 1) {
    const f = fatias.find((x) => x.valor > 0);
    corpo = `<circle cx="${r}" cy="${r}" r="${(r + ri) / 2}" fill="none" stroke="${f.cor}" stroke-width="${r - ri}" data-dica="${esc(f.dica || f.rotulo)}"/>`;
  } else {
    for (const f of fatias) {
      if (!f.valor) continue;
      const a = (f.valor / total) * Math.PI * 2;
      const fim = ang + a;
      const folga = 0.012;
      const p = (raio, t) => `${(r + raio * Math.cos(t)).toFixed(2)} ${(r + raio * Math.sin(t)).toFixed(2)}`;
      const grande = a > Math.PI ? 1 : 0;
      corpo += `<path d="M${p(r, ang + folga)} A${r} ${r} 0 ${grande} 1 ${p(r, fim - folga)} L${p(ri, fim - folga)} A${ri} ${ri} 0 ${grande} 0 ${p(ri, ang + folga)}Z" fill="${f.cor}" data-dica="${esc(f.dica || f.rotulo)}"/>`;
      ang = fim;
    }
  }
  corpo += `<text x="${r}" y="${r + 2}" text-anchor="middle" style="font-stretch:62%;font-weight:800;font-size:${tamanho * 0.17}px;fill:var(--texto)">${esc(centro[0])}</text>`;
  corpo += `<text x="${r}" y="${r + tamanho * 0.13}" text-anchor="middle" style="font-size:11px;fill:var(--texto-3)">${esc(centro[1])}</text>`;
  el.innerHTML = svg(tamanho, tamanho, corpo, rotulo);
}

/** Calendário de dias. valores: Map("AAAA-MM-DD" → {nivel 0-4, dica}) */
export function calendario(el, { inicio, fim, valores, rotulo = "" }) {
  const comeco = inicioSemana(inicio);
  const semanas = Math.ceil(((fim - comeco) / 864e5 + 1) / 7);
  const disponivel = Math.max(720, el.clientWidth || 720) - 30;
  const passo = Math.min(24, Math.max(12, Math.floor(disponivel / semanas)));
  const lado = passo - 3;
  const largura = 30 + semanas * passo;
  const altura = 20 + 7 * passo;
  let corpo = "";
  [DIAS_CURTOS[0], "", DIAS_CURTOS[2], "", DIAS_CURTOS[4], "", ""].forEach((d, i) => {
    if (d) corpo += `<text x="0" y="${20 + i * passo + lado - 2}">${d}</text>`;
  });
  let mesAnterior = -1;
  const dia = new Date(comeco);
  for (let s = 0; s < semanas; s++) {
    for (let d = 0; d < 7; d++) {
      if (dia >= inicio && dia <= fim) {
        if (dia.getDate() <= 7 && d === 0 && dia.getMonth() !== mesAnterior) {
          mesAnterior = dia.getMonth();
          corpo += `<text x="${30 + s * passo}" y="11">${MESES_CURTOS[mesAnterior]}</text>`;
        }
        const v = valores.get(chaveDia(dia));
        corpo += `<rect class="n${v?.nivel ?? 0}" x="${30 + s * passo}" y="${20 + d * passo}" width="${lado}" height="${lado}" rx="2"${v?.dica ? ` data-dica="${esc(v.dica)}"` : ""}/>`;
      }
      dia.setDate(dia.getDate() + 1);
    }
  }
  el.innerHTML = svg(largura, altura, corpo, rotulo);
}

/** Linha mínima (evolução dos recordes). Valores menores ficam mais altos. */
export function miniLinha(valores, { menorMelhor = true } = {}) {
  if (valores.length < 2) return "";
  const w = 96, h = 28, p = 3;
  const min = Math.min(...valores), max = Math.max(...valores);
  const sx = (i) => p + (i / (valores.length - 1)) * (w - 2 * p);
  const sy = (v) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return p + (menorMelhor ? t : 1 - t) * (h - 2 * p);
  };
  const pts = valores.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  const ult = valores.length - 1;
  return `<svg class="mini-linha" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}"/><circle cx="${sx(ult)}" cy="${sy(valores[ult])}" r="2.6"/></svg>`;
}

/** Faixa do chip no número de peito: uma barra por semana. */
export function faixaChip(el, valores, { animar = true, dicas = [] } = {}) {
  const w = 1000, h = 48;
  const max = Math.max(...valores, 1);
  const banda = w / valores.length;
  let corpo = "";
  valores.forEach((v, i) => {
    const alto = v > 0 ? Math.max(3, (v / max) * h) : 1.5;
    const atraso = animar ? ` style="animation-delay:${(0.35 + i * 0.014).toFixed(3)}s"` : "";
    corpo += `<g${dicas[i] ? ` data-dica="${esc(dicas[i])}"` : ""}><rect x="${(i * banda).toFixed(1)}" y="0" width="${banda.toFixed(1)}" height="${h}" fill="transparent" style="fill:transparent"/>`;
    corpo += `<rect class="${i === valores.length - 1 ? "esta" : ""}${animar ? " cresce" : ""}" x="${(i * banda + 1).toFixed(1)}" y="${h - alto}" width="${Math.max(1, banda - 3).toFixed(1)}" height="${alto}"${atraso}/></g>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${corpo}</svg>`;
}
