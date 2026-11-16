// Funções usadas por todas as páginas: dados, formatos, unidades, tema e dicas.

export const GRUPOS = {
  corrida: { nome: "Corrida", tipos: ["Run", "TrailRun", "VirtualRun"] },
  pedal: { nome: "Pedal", tipos: ["Ride", "GravelRide", "MountainBikeRide", "VirtualRide", "EBikeRide", "EMountainBikeRide", "Velomobile", "Handcycle"] },
  natacao: { nome: "Natação", tipos: ["Swim"] },
  caminhada: { nome: "Caminhada", tipos: ["Walk", "Hike", "Snowshoe"] },
  forca: { nome: "Força e outros treinos", tipos: ["WeightTraining", "Workout", "Crossfit", "HighIntensityIntervalTraining", "Yoga", "Pilates", "StairStepper", "Elliptical", "Rowing", "VirtualRow"] },
  outros: { nome: "Outros", tipos: [] },
};

const NOMES_TIPO = {
  Run: "Corrida", TrailRun: "Trail", VirtualRun: "Esteira", Ride: "Pedal", GravelRide: "Gravel",
  MountainBikeRide: "Mountain bike", VirtualRide: "Rolo", EBikeRide: "Bike elétrica", Swim: "Natação",
  Walk: "Caminhada", Hike: "Trilha", WeightTraining: "Musculação", Workout: "Treino", Crossfit: "Crossfit",
  HighIntensityIntervalTraining: "HIIT", Yoga: "Yoga", Pilates: "Pilates", Rowing: "Remo", VirtualRow: "Remo indoor",
  Elliptical: "Elíptico", StairStepper: "Escada", Soccer: "Futebol", Tennis: "Tênis", Surfing: "Surfe",
  StandUpPaddling: "Stand up paddle", Kayaking: "Caiaque", Canoeing: "Canoa", AlpineSki: "Esqui", Snowboard: "Snowboard",
};

export function grupoDe(tipo) {
  for (const [chave, g] of Object.entries(GRUPOS)) if (g.tipos.includes(tipo)) return chave;
  return "outros";
}

export const NOMES_ESFORCO = {
  "400m": "400 m", "1/2 mile": "½ milha", "1K": "1 km", "1 mile": "1 milha", "2 mile": "2 milhas", "5K": "5 km",
  "10K": "10 km", "15K": "15 km", "10 mile": "10 milhas", "20K": "20 km", "Half-Marathon": "Meia maratona",
  "30K": "30 km", "Marathon": "Maratona", "50K": "50 km",
};

export const CONDICOES = [
  ["Céu limpo", (c) => c === 0], ["Poucas nuvens", (c) => c === 1 || c === 2], ["Nublado", (c) => c === 3],
  ["Neblina", (c) => c === 45 || c === 48], ["Garoa", (c) => c >= 51 && c <= 57], ["Chuva", (c) => (c >= 61 && c <= 67) || (c >= 80 && c <= 82)],
  ["Neve", (c) => (c >= 71 && c <= 77) || c === 85 || c === 86], ["Tempestade", (c) => c >= 95],
];
export const nomeCondicao = (c) => (c == null ? "" : CONDICOES.find(([, t]) => t(c))?.[0] || "");

export const nomeTipo = (t) => NOMES_TIPO[t] || t.replace(/([a-z])([A-Z])/g, "$1 $2");
export const corGrupo = (g) => `var(--c-${g})`;

// ------------------------------------------------------------------ datas
export function dataLocal(texto) {
  const [d, h = "00:00"] = texto.split("T");
  const [ano, mes, dia] = d.split("-").map(Number);
  const [hh, mm] = h.split(":").map(Number);
  return new Date(ano, mes - 1, dia, hh, mm);
}

export const chaveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function inicioSemana(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // semana começa na segunda
  return x;
}

const fmtDataCurta = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const fmtDataLonga = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });
const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const limpar = (s) => s.replace(/\./g, "").replace(/ de /g, " ");
export const dataCurta = (d) => limpar(fmtDataCurta.format(d));
export const dataLonga = (d) => limpar(fmtDataLonga.format(d));
export const diaSemana = (d) => fmtDiaSemana.format(d);
export const hora = (d) => fmtHora.format(d);
export const DIAS_CURTOS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function quandoRelativo(d) {
  const hoje = new Date();
  const dias = Math.round((new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (dias === 0) return `hoje, ${hora(d)}`;
  if (dias === 1) return `ontem, ${hora(d)}`;
  if (dias < 7) return `${diaSemana(d)}, ${hora(d)}`;
  return d.getFullYear() === hoje.getFullYear() ? dataCurta(d) : dataLonga(d);
}

// --------------------------------------------------------------- números
const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const num = (n, casas = 0) => (casas === 0 ? nf0.format(n) : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n));
export const num1 = (n) => nf1.format(n);

// -------------------------------------------------------------- unidades
const CHAVE_UNIDADE = "strava-site:unidade";
let unidade = lerPreferencia(CHAVE_UNIDADE, "km");
const ouvintesUnidade = new Set();

export const getUnidade = () => unidade;
export function setUnidade(u) {
  unidade = u;
  gravarPreferencia(CHAVE_UNIDADE, u);
  ouvintesUnidade.forEach((f) => f(u));
}
export const aoMudarUnidade = (f) => ouvintesUnidade.add(f);

const MILHA = 1609.344;
export const rotuloDist = () => (unidade === "mi" ? "mi" : "km");
export const distValor = (m) => (unidade === "mi" ? m / MILHA : m / 1000);

export function dist(m, casas) {
  const v = distValor(m);
  const c = casas ?? (v >= 100 ? 0 : 1);
  return `${num(v, c)} ${rotuloDist()}`;
}

export function elev(m) {
  return unidade === "mi" ? `${num(m * 3.28084)} pés` : `${num(m)} m`;
}

export function duracao(s) {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function relogio(s) {
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}

// pace em s/km (ou s/mi)
export function paceSeg(metros, segundos) {
  if (!metros || !segundos) return null;
  return segundos / distValor(metros);
}

export function pace(metros, segundos) {
  const p = paceSeg(metros, segundos);
  if (!p || !isFinite(p)) return "–";
  return `${relogio(p)} /${rotuloDist()}`;
}

export function velocidade(metros, segundos) {
  if (!metros || !segundos) return "–";
  return `${num1(distValor(metros) / (segundos / 3600))} ${unidade === "mi" ? "mph" : "km/h"}`;
}

// ritmo do jeito que cada esporte fala
export function ritmo(a) {
  const g = a.grupo ?? grupoDe(a.t);
  if (!a.m || !a.s) return "";
  if (g === "pedal") return velocidade(a.m, a.s);
  if (g === "natacao") return `${relogio(a.s / (a.m / 100))} /100 m`;
  return pace(a.m, a.s);
}

// ------------------------------------------------------------------ tema
const CHAVE_TEMA = "strava-site:tema";
const ouvintesTema = new Set();

export function temaAtual() {
  return document.documentElement.dataset.tema;
}

export function iniciarTema() {
  const salvo = lerPreferencia(CHAVE_TEMA, null);
  const sistema = window.matchMedia?.("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
  document.documentElement.dataset.tema = salvo || sistema;
}

export function alternarTema() {
  const novo = temaAtual() === "claro" ? "escuro" : "claro";
  document.documentElement.dataset.tema = novo;
  gravarPreferencia(CHAVE_TEMA, novo);
  ouvintesTema.forEach((f) => f(novo));
}
export const aoMudarTema = (f) => ouvintesTema.add(f);

function lerPreferencia(chave, padrao) {
  try {
    return localStorage.getItem(chave) || padrao;
  } catch {
    return padrao;
  }
}

function gravarPreferencia(chave, valor) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* navegação privada: segue sem lembrar */
  }
}

// ------------------------------------------------------------------ dados
export async function buscarJSON(caminho, opcional = false) {
  try {
    const resp = await fetch(caminho, { cache: "no-cache" });
    if (!resp.ok) throw new Error(`${resp.status}`);
    return await resp.json();
  } catch (erro) {
    if (opcional) return null;
    throw new Error(`Não consegui abrir ${caminho} (${erro.message}).`);
  }
}

export function prepararAtividades(lista) {
  return lista.map((a) => {
    const data = dataLocal(a.d);
    return { ...a, data, dia: chaveDia(data), ano: data.getFullYear(), grupo: grupoDe(a.t) };
  });
}

export async function carregarTudo() {
  const [site, perfil, plano] = await Promise.all([
    buscarJSON("data/site.json"),
    buscarJSON("config/perfil.json", true),
    buscarJSON("config/plano.json", true),
  ]);
  site.atividades = prepararAtividades(site.atividades);
  return { site, perfil: perfil || {}, plano };
}

export function nomeSite(site, perfil) {
  const a = site.atleta || {};
  return perfil.nome_site || [a.nome, a.sobrenome].filter(Boolean).join(" ") || "Meu Strava";
}

// o nome curto do cabeçalho, como "Victor R."
export function nomeTopo(site, perfil) {
  if (perfil.nome_topo) return perfil.nome_topo;
  const a = site.atleta || {};
  if (a.nome) return a.sobrenome ? `${a.nome} ${a.sobrenome[0]}.` : a.nome;
  return nomeSite(site, perfil);
}

export function decodificarRota(texto) {
  const pontos = [];
  let i = 0, lat = 0, lng = 0;
  while (i < texto.length) {
    for (let eixo = 0; eixo < 2; eixo++) {
      let resultado = 0, desloc = 0, b;
      do {
        b = texto.charCodeAt(i++) - 63;
        resultado |= (b & 0x1f) << desloc;
        desloc += 5;
      } while (b >= 0x20);
      const delta = resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
      if (eixo === 0) lat += delta;
      else lng += delta;
    }
    pontos.push([lat / 1e5, lng / 1e5]);
  }
  return pontos;
}

// --------------------------------------------------------------- HTML
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export const linkTreino = (id) => `atividade.html?id=${encodeURIComponent(id)}`;

// abas: [{valor, rotulo}] → botões com aria-pressed
export function abas(el, opcoes, atual, aoEscolher) {
  el.innerHTML = opcoes
    .map((o) => `<button type="button" data-valor="${esc(o.valor)}" aria-pressed="${o.valor === atual}">${o.cor ? `<i class="ponto" style="background:${o.cor}"></i>` : ""}${esc(o.rotulo)}</button>`)
    .join("");
  el.onclick = (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    $$("button", el).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    aoEscolher(b.dataset.valor);
  };
}

// ------------------------------------------------------------------ dicas
export function iniciarDicas() {
  const dica = document.createElement("div");
  dica.className = "dica";
  dica.setAttribute("role", "tooltip");
  document.body.append(dica);
  let alvo = null;
  const posicionar = (x, y) => {
    const r = dica.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 18;
    dica.style.left = `${Math.max(8, left)}px`;
    dica.style.top = `${top}px`;
  };
  document.addEventListener("pointermove", (ev) => {
    const el = ev.target.closest?.("[data-dica]");
    if (!el) {
      if (alvo) dica.classList.remove("visivel");
      alvo = null;
      return;
    }
    if (el !== alvo) {
      alvo = el;
      dica.textContent = el.dataset.dica;
      dica.classList.add("visivel");
    }
    posicionar(ev.clientX, ev.clientY);
  });
  document.addEventListener("pointerleave", () => dica.classList.remove("visivel"));
  document.addEventListener("focusin", (ev) => {
    const el = ev.target.closest?.("[data-dica]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    dica.textContent = el.dataset.dica;
    dica.classList.add("visivel");
    posicionar(r.left + r.width / 2, r.top);
  });
  document.addEventListener("focusout", () => dica.classList.remove("visivel"));
}

// ------------------------------------------------------- cabeçalho comum
const ICONE_SOL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const ICONE_LUA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;

export function montarTopo({ nome, links = [] }) {
  const topo = $(".topo");
  topo.innerHTML = `
    <div class="recipiente">
      <a class="marca" href="./">${esc(nome)}</a>
      <nav class="menu" aria-label="Seções">${links.map(([href, txt]) => `<a href="${href}">${esc(txt)}</a>`).join("")}</nav>
      <div class="ajustes">
        <div class="alternador" role="group" aria-label="Unidade de distância">
          <button type="button" data-u="km" aria-pressed="${unidade === "km"}">km</button>
          <button type="button" data-u="mi" aria-pressed="${unidade === "mi"}">mi</button>
        </div>
        <button type="button" class="botao-icone" id="botao-tema"></button>
      </div>
    </div>`;
  const botaoTema = $("#botao-tema", topo);
  const pintar = () => {
    const claro = temaAtual() === "claro";
    botaoTema.innerHTML = claro ? ICONE_LUA : ICONE_SOL;
    botaoTema.setAttribute("aria-label", claro ? "Usar tema escuro" : "Usar tema claro");
    botaoTema.title = botaoTema.getAttribute("aria-label");
  };
  pintar();
  botaoTema.onclick = () => {
    alternarTema();
    pintar();
  };
  $$(".alternador button", topo).forEach((b) => {
    b.onclick = () => {
      $$(".alternador button", topo).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      setUnidade(b.dataset.u);
    };
  });
}

// a marca do Strava (Simple Icons, domínio público)
const LOGO_STRAVA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>`;

export function montarRodape(site, perfil) {
  const gerado = site?.gerado_em ? new Date(site.gerado_em) : null;
  const links = perfil?.links || {};
  const stravaUrl = links.strava || (site?.atleta?.id ? `https://www.strava.com/athletes/${site.atleta.id}` : "https://www.strava.com");
  const feitoPor = perfil?.feito_por ?? "";
  $(".rodape").innerHTML = `
    <div class="recipiente fim-pagina">
      <p class="powered">${LOGO_STRAVA}<span>Powered by Strava</span></p>
      ${feitoPor ? `<p class="feito-por">Made by: ${esc(feitoPor)}</p>` : ""}
      <a class="seguir-strava" href="${esc(stravaUrl)}" target="_blank" rel="noopener">${LOGO_STRAVA}<span>Follow me on</span><b>Strava</b></a>
      <div class="creditos">
        <p>${gerado ? `Dados atualizados em ${dataLonga(gerado)}, às ${hora(gerado)}. O site se atualiza sozinho a cada treino registrado no Strava.` : ""}</p>
        <p>Mapas © <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>. Clima: <a href="https://open-meteo.com">Open-Meteo</a>.${links.instagram ? ` <a href="${esc(links.instagram)}">Instagram</a>.` : ""}</p>
      </div>
    </div>`;
}

// relógio da próxima prova
const timers = new WeakMap();
export function contagemRegressiva(el, alvo) {
  clearInterval(timers.get(el));
  const pintar = () => {
    let s = Math.max(0, Math.floor((alvo - new Date()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60);
    el.innerHTML = `<span>${d}<small>d</small></span><span>${h}<small>h</small></span><span>${m}<small>min</small></span><span>${s % 60}<small>s</small></span>`;
    el.setAttribute("aria-label", `Faltam ${d} dias, ${h} horas e ${m} minutos`);
    el.setAttribute("role", "timer");
  };
  pintar();
  timers.set(el, setInterval(pintar, 1000));
}

// redesenha gráficos quando a largura muda
const desenhos = new Set();
export function aoRedimensionar(f) {
  desenhos.add(f);
}
let ultimaLargura = innerWidth;
let espera;
addEventListener("resize", () => {
  clearTimeout(espera);
  espera = setTimeout(() => {
    if (Math.abs(innerWidth - ultimaLargura) < 4) return;
    ultimaLargura = innerWidth;
    desenhos.forEach((f) => f());
  }, 150);
});

export const reduzirMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
