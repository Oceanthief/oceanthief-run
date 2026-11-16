// Funções usadas por todas as páginas: idioma, dados, formatos, unidades, tema e dicas.
import TRADUCOES from "./traducoes.js";

// ----------------------------------------------------------------- idioma
// O texto em português é a própria chave: t("Recordes") vira "Records" em inglês.
// Sem tradução, aparece o português.
export const IDIOMAS = { pt: "pt-BR", en: "en-US", es: "es-ES" };
const CHAVE_IDIOMA = "strava-site:idioma";
export const idioma = escolherIdioma();
export const LOCALE = IDIOMAS[idioma];
document.documentElement.lang = LOCALE;

// ?lang=en no endereço > a escolha guardada > o idioma do navegador > inglês
function escolherIdioma() {
  const daUrl = new URLSearchParams(location.search).get("lang");
  if (IDIOMAS[daUrl]) {
    gravarPreferencia(CHAVE_IDIOMA, daUrl);
    return daUrl;
  }
  const salvo = lerPreferencia(CHAVE_IDIOMA, null);
  if (IDIOMAS[salvo]) return salvo;
  for (const l of navigator.languages || [navigator.language || ""]) {
    const c = String(l).slice(0, 2).toLowerCase();
    if (IDIOMAS[c]) return c;
  }
  return "en";
}

export function trocarIdioma(novo) {
  if (!IDIOMAS[novo] || novo === idioma) return;
  gravarPreferencia(CHAVE_IDIOMA, novo);
  const url = new URL(location.href);
  url.searchParams.delete("lang");
  location.href = url.href;
}

// "zona|Ritmo": o que vem antes da barra só separa frases iguais em português com traduções diferentes
export function t(texto, vars) {
  let s = idioma === "pt" ? null : TRADUCOES[idioma]?.[texto];
  if (s == null) s = texto.includes("|") ? texto.slice(texto.indexOf("|") + 1) : texto;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

// singular ou plural: plural(3, "{n} treino", "{n} treinos")
export const plural = (n, um, varios) => t(n === 1 ? um : varios, { n: num(n) });

// textos do perfil.json e do plano.json: {"pt": ..., "en": ..., "es": ...} ou só o português
export function tr(v) {
  if (v && typeof v === "object" && !Array.isArray(v) && ("pt" in v || "en" in v || "es" in v)) return v[idioma] ?? v.pt ?? v.en ?? v.es;
  return v;
}
// o mesmo, e o português que estiver no dicionário também é traduzido
export const tx = (v) => {
  const x = tr(v);
  return typeof x === "string" ? t(x) : x;
};

// textos fixos do HTML: data-t traduz o texto do elemento; data-t-aria, o aria-label
for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t || el.textContent.trim());
for (const el of document.querySelectorAll("[data-t-aria]")) el.setAttribute("aria-label", t(el.getAttribute("aria-label")));

// ---------------------------------------------------------------- esportes
export const GRUPOS = {
  corrida: { nome: t("Corrida"), tipos: ["Run", "TrailRun", "VirtualRun"] },
  pedal: { nome: t("Pedal"), tipos: ["Ride", "GravelRide", "MountainBikeRide", "VirtualRide", "EBikeRide", "EMountainBikeRide", "Velomobile", "Handcycle"] },
  natacao: { nome: t("Natação"), tipos: ["Swim"] },
  caminhada: { nome: t("Caminhada"), tipos: ["Walk", "Hike", "Snowshoe"] },
  forca: { nome: t("Força e outros treinos"), tipos: ["WeightTraining", "Workout", "Crossfit", "HighIntensityIntervalTraining", "Yoga", "Pilates", "StairStepper", "Elliptical", "Rowing", "VirtualRow"] },
  outros: { nome: t("Outros"), tipos: [] },
};

const NOMES_TIPO = {
  Run: t("Corrida"), TrailRun: t("Trail"), VirtualRun: t("Esteira"), Ride: t("Pedal"), GravelRide: t("Gravel"),
  MountainBikeRide: t("Mountain bike"), VirtualRide: t("Rolo"), EBikeRide: t("Bike elétrica"), Swim: t("Natação"),
  Walk: t("Caminhada"), Hike: t("Trilha"), WeightTraining: t("Musculação"), Workout: t("Treino"), Crossfit: t("Crossfit"),
  HighIntensityIntervalTraining: t("HIIT"), Yoga: t("Yoga"), Pilates: t("Pilates"), Rowing: t("Remo"), VirtualRow: t("Remo indoor"),
  Elliptical: t("Elíptico"), StairStepper: t("Escada"), Soccer: t("Futebol"), Tennis: t("Tênis"), Surfing: t("Surfe"),
  StandUpPaddling: t("Stand up paddle"), Kayaking: t("Caiaque"), Canoeing: t("Canoa"), AlpineSki: t("Esqui"), Snowboard: t("Snowboard"),
};

export function grupoDe(tipo) {
  for (const [chave, g] of Object.entries(GRUPOS)) if (g.tipos.includes(tipo)) return chave;
  return "outros";
}

export const NOMES_ESFORCO = {
  "400m": "400 m", "1/2 mile": t("½ milha"), "1K": "1 km", "1 mile": t("1 milha"), "2 mile": t("2 milhas"), "5K": "5 km",
  "10K": "10 km", "15K": "15 km", "10 mile": t("10 milhas"), "20K": "20 km", "Half-Marathon": t("Meia maratona"),
  "30K": "30 km", "Marathon": t("Maratona"), "50K": "50 km",
};

export const CONDICOES = [
  [t("Céu limpo"), (c) => c === 0], [t("Poucas nuvens"), (c) => c === 1 || c === 2], [t("Nublado"), (c) => c === 3],
  [t("Neblina"), (c) => c === 45 || c === 48], [t("Garoa"), (c) => c >= 51 && c <= 57], [t("Chuva"), (c) => (c >= 61 && c <= 67) || (c >= 80 && c <= 82)],
  [t("Neve"), (c) => (c >= 71 && c <= 77) || c === 85 || c === 86], [t("Tempestade"), (c) => c >= 95],
];
export const nomeCondicao = (c) => (c == null ? "" : CONDICOES.find(([, f]) => f(c))?.[0] || "");

export const nomeTipo = (tipo) => NOMES_TIPO[tipo] || tipo.replace(/([a-z])([A-Z])/g, "$1 $2");
export const corGrupo = (g) => `var(--c-${g})`;

// o país no idioma da página, pelo código ("BR" vira Brasil, Brazil ou Brasil)
const fmtRegiao = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([LOCALE], { type: "region" }) : null;
export function nomePais(lugar) {
  if (lugar?.cc && fmtRegiao) {
    try {
      return fmtRegiao.of(String(lugar.cc).toUpperCase());
    } catch {
      /* código desconhecido: usa o nome guardado */
    }
  }
  return lugar?.pais || "";
}

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

const fmtDataCurta = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const fmtDataLonga = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const fmtDiaSemana = new Intl.DateTimeFormat(LOCALE, { weekday: "long" });
const fmtHora = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
const fmtDiaCurto = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
const fmtMesCurto = new Intl.DateTimeFormat(LOCALE, { month: "short" });

const limpar = (s) => s.replace(/\./g, "").replace(/ de /g, " ");
export const dataCurta = (d) => limpar(fmtDataCurta.format(d));
export const dataLonga = (d) => limpar(fmtDataLonga.format(d));
export const diaSemana = (d) => fmtDiaSemana.format(d);
export const hora = (d) => fmtHora.format(d);
// de segunda a domingo (5 de janeiro de 2026 foi uma segunda-feira)
const semanaBase = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i));
export const DIAS_CURTOS = semanaBase.map((d) => fmtDiaCurto.format(d).replace(/\./g, ""));
export const DIAS_LONGOS = semanaBase.map((d) => fmtDiaSemana.format(d).replace(/-feira$/, ""));
export const MESES_CURTOS = Array.from({ length: 12 }, (_, i) => fmtMesCurto.format(new Date(2026, i, 15)).replace(/\./g, ""));

export function quandoRelativo(d) {
  const hoje = new Date();
  const dias = Math.round((new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (dias === 0) return t("hoje, {hora}", { hora: hora(d) });
  if (dias === 1) return t("ontem, {hora}", { hora: hora(d) });
  if (dias < 7) return `${diaSemana(d)}, ${hora(d)}`;
  return d.getFullYear() === hoje.getFullYear() ? dataCurta(d) : dataLonga(d);
}

// --------------------------------------------------------------- números
// "always": em espanhol, 3658 também vira 3.658, como 21.245
const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0, useGrouping: "always" });
const nf1 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: "always" });
export const num = (n, casas = 0) =>
  casas === 0 ? nf0.format(n) : new Intl.NumberFormat(LOCALE, { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: "always" }).format(n);
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
  return unidade === "mi" ? `${num(m * 3.28084)} ${t("pés")}` : `${num(m)} m`;
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
    throw new Error(t("Não consegui abrir {caminho} ({erro}).", { caminho, erro: erro.message }));
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
      <nav class="menu" aria-label="${esc(t("Seções"))}">${links.map(([href, txt]) => `<a href="${href}">${esc(txt)}</a>`).join("")}</nav>
      <div class="ajustes">
        <div class="alternador idiomas" role="group" aria-label="${esc(t("Idioma"))}">
          ${Object.keys(IDIOMAS).map((l) => `<button type="button" data-lang="${l}" lang="${IDIOMAS[l]}" aria-pressed="${l === idioma}" title="${NOMES_IDIOMA[l]}">${l.toUpperCase()}</button>`).join("")}
        </div>
        <div class="alternador" role="group" aria-label="${esc(t("Unidade de distância"))}">
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
    botaoTema.setAttribute("aria-label", claro ? t("Usar tema escuro") : t("Usar tema claro"));
    botaoTema.title = botaoTema.getAttribute("aria-label");
  };
  pintar();
  botaoTema.onclick = () => {
    alternarTema();
    pintar();
  };
  $$("[data-u]", topo).forEach((b) => {
    b.onclick = () => {
      $$("[data-u]", topo).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      setUnidade(b.dataset.u);
    };
  });
  $$("[data-lang]", topo).forEach((b) => {
    b.onclick = () => trocarIdioma(b.dataset.lang);
  });
}

const NOMES_IDIOMA = { pt: "Português", en: "English", es: "Español" };

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
        <p>${gerado ? esc(t("Dados atualizados em {data}, às {hora}. O site se atualiza sozinho a cada treino registrado no Strava.", { data: dataLonga(gerado), hora: hora(gerado) })) : ""}</p>
        <p>${t("Mapas ©")} <a href="https://www.openstreetmap.org/copyright">${t("colaboradores do OpenStreetMap")}</a>. ${t("Clima:")} <a href="https://open-meteo.com">Open-Meteo</a>.${links.instagram ? ` <a href="${esc(links.instagram)}">Instagram</a>.` : ""}</p>
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
    el.setAttribute("aria-label", t("Faltam {d} dias, {h} horas e {m} minutos", { d, h, m }));
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
