// Desenhos dos quatro números da abertura: muro de tijolos, globo com a volta na Terra,
// globo com a órbita da ISS e o mapa de relevo da montanha de referência.
import { esc, num, reduzirMovimento, t } from "./comum.js";

const D3_GEO = "https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm";
const TOPOJSON = "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm";
const TERRA = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json";

// começa olhando para o Brasil
const ROTACAO_INICIAL = [47, 12];

// ------------------------------------------------ laço de animação único
// cada desenho registra um passo; o laço só roda com algum deles na tela
const passos = new Map();
const visiveis = new Set();
let pedido = 0;
let ultimo = 0;

const observador = "IntersectionObserver" in window
  ? new IntersectionObserver((entradas) => {
      for (const e of entradas) e.isIntersecting ? visiveis.add(e.target) : visiveis.delete(e.target);
      ligar();
    })
  : null;

function animar(el, passo) {
  if (reduzirMovimento()) return;
  passos.set(el, passo);
  if (observador) observador.observe(el);
  else visiveis.add(el);
}

function ligar() {
  if (pedido || !visiveis.size) return;
  const quadro = (t) => {
    pedido = 0;
    if (!visiveis.size) return;
    // 30 quadros por segundo bastam e poupam o processador
    if (t - ultimo >= 33) {
      const dt = Math.min(100, t - (ultimo || t));
      ultimo = t;
      for (const el of visiveis) passos.get(el)?.(dt);
    }
    pedido = requestAnimationFrame(quadro);
  };
  pedido = requestAnimationFrame(quadro);
}

// ------------------------------------------------ bibliotecas do globo
let geo = null;
function carregarGeo() {
  geo ??= Promise.all([import(D3_GEO), import(TOPOJSON), fetch(TERRA).then((r) => r.json())])
    .then(([d3, topo, mundo]) => ({ d3, terra: topo.feature(mundo, mundo.objects.land) }))
    .catch(() => null);
  return geo;
}

// ------------------------------------------------ elipses (anéis e órbitas)
// devolve os trechos de uma elipse inclinada, separados em "atrás" e "na frente" do globo
function trechosElipse({ cx, cy, rx, ry, inclinacao, de = 0, ate = Math.PI * 2, n = 160 }) {
  const cos = Math.cos(inclinacao), sin = Math.sin(inclinacao);
  const ponto = (t) => {
    const x = rx * Math.cos(t), y = ry * Math.sin(t);
    return [cx + x * cos - y * sin, cy + x * sin + y * cos];
  };
  const tras = [], frente = [];
  let atual = null, ladoAtual = null;
  const total = Math.max(2, Math.ceil((n * (ate - de)) / (Math.PI * 2)));
  for (let i = 0; i <= total; i++) {
    const t = de + ((ate - de) * i) / total;
    const lado = Math.sin(t) < 0 ? "tras" : "frente";
    const p = ponto(t);
    if (lado !== ladoAtual) {
      if (atual) atual.push(p); // emenda o trecho anterior até aqui
      atual = [p];
      (lado === "tras" ? tras : frente).push(atual);
      ladoAtual = lado;
    } else atual.push(p);
  }
  const d = (lista) => lista.filter((l) => l.length > 1).map((l) => `M${l.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L")}`).join("");
  return { tras: d(tras), frente: d(frente), ponto };
}

// ------------------------------------------------ 1. muro de tijolos
/** Um tijolo por atividade, em ordem cronológica, assentados de baixo para cima. */
export function muro(el, { atividades, corDe, nomeDe }) {
  const n = atividades.length;
  if (!n) return (el.innerHTML = "");
  const L = 4, A = 2, folga = 0.55;
  const porFiada = Math.max(12, Math.round(Math.sqrt((2.8 * n) / 2)));
  const fiadas = Math.ceil(n / porFiada);
  const cheias = Math.floor(n / porFiada);
  const frente = porFiada * L + L / 2;
  // o bloco tem espessura: topo e lateral desenhados em perspectiva oblíqua
  const dx = 16, dy = 10;
  const altura = fiadas * A + dy;
  const base = altura; // o pé do muro
  const topoCheio = base - cheias * A; // altura das fiadas completas
  const grupos = new Map();
  atividades.forEach((a, i) => {
    const fiada = Math.floor(i / porFiada), pos = i % porFiada;
    const x = pos * L + (fiada % 2 ? L / 2 : 0);
    const y = base - (fiada + 1) * A;
    const g = a.grupo;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(`<rect x="${x.toFixed(2)}" y="${y}" width="${L - folga}" height="${A - folga}" rx=".35"/>`);
  });
  const faces = `
    <polygon class="topo-muro" points="0,${topoCheio} ${frente},${topoCheio} ${frente + dx},${topoCheio - dy} ${dx},${topoCheio - dy}"/>
    <polygon class="lado-muro" points="${frente},${topoCheio} ${frente + dx},${topoCheio - dy} ${frente + dx},${base - dy} ${frente},${base}"/>`;
  const largura = frente + dx;
  const ordem = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
  const legenda = ordem
    .slice(0, 4)
    .map(([g, lista]) => `<li><i style="background:${corDe(g)}"></i>${esc(nomeDe(g).toLowerCase())} <span>${lista.length}</span></li>`)
    .join("");
  el.innerHTML = `
    <div class="muro-cena">
      <svg class="muro" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="xMidYMax meet" role="img"
        aria-label="${esc(t("Muro com {n} tijolos, um por atividade, coloridos pelo esporte", { n: num(n) }))}">
        ${faces}
        ${ordem.map(([g, rects]) => `<g style="fill:${corDe(g)}">${rects.join("")}</g>`).join("")}
      </svg>
    </div>
    <ul class="legenda-muro">${legenda}</ul>`;
}

// ------------------------------------------------ 2. globo com a volta na Terra
export function globoVoltas(el, { voltas, rotulo }) {
  const cx = 110, cy = 100, R = 66;
  const inteiras = Math.floor(voltas);
  const resto = voltas - inteiras;
  const base = { cx, cy, rx: R * 1.36, ry: R * 0.26, inclinacao: -0.16 };
  let tras = "", frente = "";
  // a volta inteira, como trilho
  const guia = trechosElipse(base);
  tras += `<path class="anel-guia" d="${guia.tras}"/>`;
  frente += `<path class="anel-guia" d="${guia.frente}"/>`;
  // cada volta completa vira um anel
  for (let k = 0; k < Math.min(inteiras, 6); k++) {
    const e = trechosElipse({ ...base, rx: base.rx + k * 5, ry: base.ry + k * 2.2 });
    tras += `<path class="anel" d="${e.tras}"/>`;
    frente += `<path class="anel" d="${e.frente}"/>`;
  }
  // o pedaço da volta seguinte, começando na frente
  let ponta = "";
  if (resto > 0.002) {
    const k = Math.min(inteiras, 6);
    const ini = Math.PI / 2;
    const e = trechosElipse({ ...base, rx: base.rx + k * 5, ry: base.ry + k * 2.2, de: ini, ate: ini + resto * Math.PI * 2 });
    tras += `<path class="anel" d="${e.tras}"/>`;
    frente += `<path class="anel" d="${e.frente}"/>`;
    const [px, py] = e.ponto(ini + resto * Math.PI * 2);
    ponta = `<circle class="anel-ponta" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.6"/>`;
  }
  el.innerHTML = `
    <svg class="globo" viewBox="0 0 220 200" role="img" aria-label="${esc(rotulo)}">
      <g>${tras}</g>
      <circle class="globo-mar" cx="${cx}" cy="${cy}" r="${R}"/>
      <path class="globo-terra"/>
      <circle class="globo-borda" cx="${cx}" cy="${cy}" r="${R}"/>
      <g>${frente}${ponta}</g>
    </svg>`;
  desenharTerra(el, { cx, cy, R, grade: false });
}

// ------------------------------------------------ 3. globo com a ISS
export function globoOrbita(el, { rotulo }) {
  const cx = 110, cy = 100, R = 58;
  const orbita = { cx, cy, rx: R * 1.42, ry: R * 0.5, inclinacao: -0.42 };
  const e = trechosElipse(orbita);
  el.innerHTML = `
    <svg class="globo" viewBox="0 0 220 200" role="img" aria-label="${esc(rotulo)}">
      <path class="orbita" d="${e.tras}"/>
      <g class="iss-tras"></g>
      <circle class="globo-mar" cx="${cx}" cy="${cy}" r="${R}"/>
      <path class="globo-grade"/>
      <circle class="globo-borda" cx="${cx}" cy="${cy}" r="${R}"/>
      <path class="orbita" d="${e.frente}"/>
      <g class="iss-frente"><g class="iss"><circle class="iss-brilho" r="8"/><circle class="iss-ponto" r="3.4"/></g></g>
    </svg>`;
  const iss = el.querySelector(".iss");
  const tras = el.querySelector(".iss-tras"), frente = el.querySelector(".iss-frente");
  let t = 2.2;
  const posicionar = () => {
    const [x, y] = e.ponto(t);
    iss.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    const destino = Math.sin(t) < 0 ? tras : frente;
    if (iss.parentNode !== destino) destino.appendChild(iss);
  };
  posicionar();
  desenharTerra(el, { cx, cy, R, grade: true, terra: false, extra: (dt) => {
    t = (t + dt * 0.0009) % (Math.PI * 2);
    posicionar();
  } });
}

// terra e grade giram devagar; sem as bibliotecas, fica só a esfera
async function desenharTerra(el, { cx, cy, R, grade, terra = true, extra }) {
  const lib = await carregarGeo();
  if (!lib || !el.isConnected) {
    if (extra) animar(el, extra);
    return;
  }
  const { d3 } = lib;
  const proj = d3.geoOrthographic().scale(R).translate([cx, cy]).clipAngle(90).rotate(ROTACAO_INICIAL);
  const caminho = d3.geoPath(proj);
  const pTerra = el.querySelector(".globo-terra");
  const pGrade = el.querySelector(".globo-grade");
  const malha = grade ? d3.geoGraticule10() : null;
  const pintar = () => {
    if (pTerra && terra) pTerra.setAttribute("d", caminho(lib.terra) || "");
    if (pGrade) pGrade.setAttribute("d", caminho(malha) || "");
  };
  pintar();
  let lon = ROTACAO_INICIAL[0];
  animar(el, (dt) => {
    lon = (lon - dt * 0.006) % 360;
    proj.rotate([lon, ROTACAO_INICIAL[1]]);
    pintar();
    extra?.(dt);
  });
}

// ------------------------------------------------ 4. a montanha no mapa de relevo
export function montanha(el, { lat, lng, nome, rotulo }) {
  el.innerHTML = `<div class="mapa-montanha" role="img" aria-label="${esc(rotulo)}"></div>`;
  if (!window.L) return null;
  const caixa = el.firstElementChild;
  const mapa = L.map(caixa, {
    center: [lat, lng],
    zoom: 12,
    zoomControl: false,
    attributionControl: true,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
    tap: false,
  });
  mapa.attributionControl.setPrefix(false);
  L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    subdomains: "abc",
    maxZoom: 17,
    attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> · © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  }).addTo(mapa);
  // o nome do pico já vem escrito no próprio mapa de relevo
  L.marker([lat, lng], {
    interactive: false,
    keyboard: false,
    title: nome,
    icon: L.divIcon({ className: "", html: `<span class="cume"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] }),
  }).addTo(mapa);
  return mapa;
}
