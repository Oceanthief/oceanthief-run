import {
  $, $$, abas, aoMudarTema, aoMudarUnidade, aoRedimensionar, carregarTudo, chaveDia, corGrupo, dataCurta, dataLonga,
  decodificarRota, dist, distValor, duracao, elev, esc, GRUPOS, hora, iniciarDicas, inicioSemana, linkTreino, MESES_CURTOS,
  montarRodape, montarTopo, nomeSite, nomeTopo, nomeTipo, num, num1, pace, paceSeg, quandoRelativo, reduzirMovimento, relogio,
  ritmo, rotuloDist, getUnidade, buscarJSON, diaSemana, NOMES_ESFORCO, CONDICOES, contagemRegressiva,
} from "./comum.js";
import { barras, barrasH, calendario, dispersao, miniLinha, rosca } from "./graficos.js";
import { globoOrbita, globoVoltas, montanha, muro } from "./capa.js";

let S, P, PLANO, A, PRINCIPAL;
const nTreinos = (n) => `${num(n)} ${n === 1 ? "treino" : "treinos"}`;
const estado = { periodo: "semana", recentesMostrar: 8, destaque: "longos", grupoNumeros: null, ano: "12m", pais: "todos", provasTodas: false };

const TITULOS = {
  sobre: ["Sobre", "Quem está por trás dos números."],
  recordes: ["Recordes", "Os tempos que eu ainda tento bater."],
  recentes: ["Recentes", "O que rolou nos últimos dias."],
  destaques: ["Destaques", "Os treinos que não saem da memória."],
  numeros: ["Números", "Tudo o que o relógio registrou."],
  constancia: ["Constância", "Cada quadrado é um dia. Quanto mais forte, mais longe."],
  clima: ["Clima", "Chuva, frio ou calor: o treino sai igual."],
  lugares: ["Lugares", "Onde já deixei pegadas."],
  equipamento: ["Equipamento", "Quantos quilômetros cada tênis aguentou."],
};

const ESFORCOS_PRINCIPAIS = ["400m", "1K", "1 mile", "5K", "10K", "15K", "10 mile", "Half-Marathon", "30K", "Marathon", "50K"];

// ----------------------------------------------------------------- início
iniciarDicas();
iniciar();

async function iniciar() {
  try {
    ({ site: S, perfil: P, plano: PLANO } = await carregarTudo());
  } catch (erro) {
    $("#conteudo").innerHTML = `<div class="recipiente"><section class="secao"><h2>Os dados não carregaram</h2>
      <p class="sub">${esc(erro.message)} Se você abriu o arquivo direto do computador, rode
      <code>python -m http.server</code> na pasta do site e acesse http://localhost:8000.</p></section></div>`;
    return;
  }
  A = S.atividades;
  PRINCIPAL = grupoPrincipal();
  estado.grupoNumeros = PRINCIPAL;
  const nome = nomeSite(S, P);
  document.title = P.titulo_aba || nome;

  const links = [["#sobre", "Sobre"], ["#recordes", "Recordes"], ["#recentes", "Recentes"], ["#destaques", "Destaques"],
    ["#numeros", "Números"], ["#constancia", "Constância"], ["#clima", "Clima"], ["#lugares", "Lugares"], ["#equipamento", "Equipamento"]];
  if (PLANO?.semanas?.length) links.push(["plano.html", "Plano"]);
  montarTopo({ nome: nomeTopo(S, P), links: links.filter(([h]) => !h.startsWith("#") || document.querySelector(h)) });
  montarRodape(S, P);

  for (const [id, padrao] of Object.entries(TITULOS)) {
    const [titulo, sub] = P.secoes?.[id] || padrao;
    const cab = $(`#${id} .secao-cabeca`);
    if (cab) cab.insertAdjacentHTML("afterbegin", `<div><h2>${esc(titulo)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div>`);
  }

  if (!A.length) {
    $("#inicio").innerHTML = `<div><h2>Nenhum treino ainda</h2><p class="sub">Assim que você registrar uma atividade pública no Strava, ela aparece aqui.</p></div>`;
    return;
  }

  abertura();
  sobre();
  desenharSecoes();
  lugares();
  aoMudarUnidade(() => {
    atualizarCapa();
    desenharSecoes();
    painelLugares();
  });
  aoRedimensionar(desenharSecoes);
}

function desenharSecoes() {
  recordes();
  recentes();
  destaques();
  numeros();
  constancia();
  clima();
  equipamento();
}

// o esporte com mais quilômetros (ou o escolhido em perfil.json)
function grupoPrincipal() {
  if (P.esporte_principal && GRUPOS[P.esporte_principal] && A.some((a) => a.grupo === P.esporte_principal)) return P.esporte_principal;
  const km = {};
  for (const a of A) if (a.m > 0 && a.grupo !== "outros" && a.grupo !== "forca") km[a.grupo] = (km[a.grupo] || 0) + a.m;
  return Object.entries(km).sort((x, y) => y[1] - x[1])[0]?.[0] || "corrida";
}

const soma = (lista, f) => lista.reduce((s, x) => s + (f(x) || 0), 0);
const doGrupo = (g) => (g === "tudo" ? A : A.filter((a) => a.grupo === g));
const nomeGrupo = (g) => (g === "tudo" ? "Tudo" : GRUPOS[g]?.nome || g);

function sequencias(dias) {
  const ordenados = [...dias].sort();
  let maior = 0, fimMaior = null, atual = 0, anterior = null;
  for (const d of ordenados) {
    const data = new Date(`${d}T12:00`);
    atual = anterior && Math.round((data - anterior) / 864e5) === 1 ? atual + 1 : 1;
    if (atual > maior) {
      maior = atual;
      fimMaior = data;
    }
    anterior = data;
  }
  const d = new Date();
  if (!dias.has(chaveDia(d))) d.setDate(d.getDate() - 1);
  let agora = 0;
  while (dias.has(chaveDia(d))) {
    agora++;
    d.setDate(d.getDate() - 1);
  }
  return { maior, fimMaior, agora };
}

// --------------------------------------------------------------- abertura
const MINUTOS_ORBITA_ISS = 92.7;
const VOLTA_TERRA_KM = 40075;
const MONTANHA_PADRAO = {
  nome: "Pico da Bandeira",
  plural: "Picos da Bandeira",
  altura_m: 2892,
  detalhe: "do nível do mar ao cume",
  lat: -20.4345,
  lng: -41.7973,
};
const CHEVRON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`;
let mapaMontanha = null;

const montanhaRef = () => ({ ...MONTANHA_PADRAO, ...(P.altimetria_referencia || {}) });

// "— texto —" vira a linha do meio, em destaque e com traços dos lados
function linhaFrase(l) {
  const m = l.match(/^\s*[—–-]+\s*(.+?)\s*[—–-]+\s*$/);
  return m ? `<span class="meio">${esc(m[1])}</span>` : `<span>${esc(l)}</span>`;
}

// a última palavra do nome vai para a segunda linha, em destaque (ou o que estiver em "titulo")
function partesTitulo(nome) {
  if (Array.isArray(P.titulo) && P.titulo.length) return P.titulo;
  const palavras = nome.trim().split(/\s+/);
  return palavras.length > 1 ? [palavras.slice(0, -1).join(" "), palavras.at(-1)] : [nome];
}

function abertura() {
  const [linha1, linha2] = partesTitulo(nomeSite(S, P));
  const frase = (P.frase || []).filter(Boolean);
  const fotos = (P.fotos || []).filter((f) => f?.arquivo).slice(0, 2);
  const temContagem = PLANO?.prova?.data && new Date(PLANO.prova.data) > new Date();
  const foto = (f, lado) =>
    `<figure class="capa-foto ${lado}"><img src="${esc(f.arquivo)}" alt="${esc(f.descricao || `Foto de ${nomeSite(S, P)}`)}" decoding="async"></figure>`;
  const bloco = (id) => `
    <div class="num-capa" id="capa-${id}">
      <p class="valor"></p>
      <p class="rotulo"></p>
      <p class="comparacao"></p>
      <button type="button" class="abrir" aria-expanded="true" aria-controls="viz-${id}" aria-label="Esconder o desenho">${CHEVRON}</button>
      <div class="viz" id="viz-${id}"></div>
    </div>`;

  $("#inicio").innerHTML = `
    <div class="capa${fotos.length ? "" : " sem-fotos"}">
      ${fotos[0] ? foto(fotos[0], "esquerda") : ""}
      <div class="capa-centro">
        <h1 class="titulo-site"><span>${esc(linha1)}</span>${linha2 ? `<span class="cor">${esc(linha2)}</span>` : ""}</h1>
        ${frase.length ? `<p class="mote">${frase.map(linhaFrase).join("")}</p>` : ""}
      </div>
      ${fotos[1] ? foto(fotos[1], "direita") : ""}
    </div>
    <div class="numeros-capa" id="numeros-capa">${["atividades", "distancia", "horas", "subida"].map(bloco).join("")}</div>
    ${temContagem ? `<a class="contagem" href="plano.html"><div><p>Próxima prova</p><strong>${esc(PLANO.prova.nome)}</strong></div><div class="relogio" id="relogio-prova"></div><span class="ver">Ver o plano de treino</span></a>` : ""}`;

  atualizarCapa();

  const { metros } = totais();
  const ref = montanhaRef();
  muro($("#viz-atividades"), { atividades: A, corDe: corGrupo, nomeDe: nomeGrupo });
  globoVoltas($("#viz-distancia"), {
    voltas: metros / 1000 / VOLTA_TERRA_KM,
    rotulo: `Globo com o pedaço da volta na Terra já percorrido: ${dist(metros, 0)} de ${num(VOLTA_TERRA_KM)} km`,
  });
  globoOrbita($("#viz-horas"), { rotulo: "Globo com a órbita da Estação Espacial Internacional" });
  mapaMontanha = montanha($("#viz-subida"), { ...ref, rotulo: `Mapa de relevo do ${ref.nome}, com ${num(ref.altura_m)} m de altitude` });

  $$("#numeros-capa .abrir").forEach((b) => {
    b.onclick = () => {
      const aberto = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", String(!aberto));
      b.setAttribute("aria-label", aberto ? "Mostrar o desenho" : "Esconder o desenho");
      document.getElementById(b.getAttribute("aria-controls")).hidden = aberto;
      if (!aberto) mapaMontanha?.invalidateSize();
    };
  });
  if (temContagem) contagemRegressiva($("#relogio-prova"), new Date(PLANO.prova.data));
}

function totais() {
  return { metros: soma(A, (a) => a.m), horas: soma(A, (a) => a.s) / 3600, subida: soma(A, (a) => a.el) };
}

// dias sem nenhuma atividade desde 1º de janeiro; hoje só conta se já tiver treino
function diasDeDescanso() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const dias = new Set(A.filter((a) => a.data.getFullYear() === ano).map((a) => a.dia));
  const meiaNoite = new Date(ano, hoje.getMonth(), hoje.getDate());
  let descanso = 0;
  for (const d = new Date(ano, 0, 1); d < meiaNoite; d.setDate(d.getDate() + 1)) if (!dias.has(chaveDia(d))) descanso++;
  return { descanso, ano };
}

// números e comparações (refeitos quando muda km/mi)
function atualizarCapa() {
  const { metros, horas, subida } = totais();
  const { descanso, ano } = diasDeDescanso();
  const voltas = metros / 1000 / VOLTA_TERRA_KM;
  const orbitas = (horas * 60) / MINUTOS_ORBITA_ISS;
  const ref = montanhaRef();
  const montanhas = subida / ref.altura_m;
  const mi = getUnidade() === "mi";
  const preencher = (id, valor, rotulo, comparacao, dica = "") => {
    const el = $(`#capa-${id}`);
    if (!el) return;
    $(".valor", el).textContent = valor;
    $(".rotulo", el).innerHTML = rotulo;
    const c = $(".comparacao", el);
    c.innerHTML = comparacao;
    if (dica) {
      c.dataset.dica = dica;
      c.tabIndex = 0;
    }
  };
  const info = `Todas as atividades públicas no Strava desde ${dataLonga(A[0].data)}, de todos os esportes. Os quilômetros, as horas e a subida também somam tudo.`;
  preencher(
    "atividades",
    num(A.length),
    `Atividades <button type="button" class="info" data-dica="${esc(info)}" aria-label="${esc(info)}">i</button>`,
    `<b>${num(descanso)}</b> ${descanso === 1 ? "dia" : "dias"} de descanso em ${ano}`,
  );
  preencher(
    "distancia",
    num(distValor(metros)),
    mi ? "Milhas" : "Quilômetros",
    voltas < 1 ? `<b>${num(voltas * 100)}%</b> de uma volta na Terra` : `<b>${num(voltas, 2)}</b> voltas na Terra`,
    `A volta na Terra, pela linha do Equador, tem ${num(VOLTA_TERRA_KM)} km.`,
  );
  preencher(
    "horas",
    num(horas),
    "Horas",
    `<b>${num(orbitas)}</b> órbitas da ISS ao redor da Terra`,
    "A Estação Espacial Internacional dá uma volta na Terra a cada 92,7 minutos.",
  );
  preencher(
    "subida",
    num(mi ? subida * 3.28084 : subida),
    mi ? "Pés de subida" : "Metros de subida",
    `<b>${num(montanhas, 1)}</b> ${esc(montanhas >= 2 ? ref.plural : ref.nome)}, ${esc(ref.detalhe)}`,
    `${ref.nome}: ${num(ref.altura_m)} m de altitude.`,
  );
}

// ------------------------------------------------------------------ sobre
// *texto* vira ênfase; um parágrafo inteiro entre asteriscos vira a frase de destaque
function paragrafo(p) {
  const inteiro = /^\*[^*]+\*$/.test(p.trim());
  const html = esc(p)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
  return `<p${inteiro ? ' class="chave"' : ""}>${html}</p>`;
}

function assinatura() {
  const a = S.atleta || {};
  const nome = P.assinatura?.nome ?? [a.nome, a.sobrenome].filter(Boolean).join(" ");
  const local = P.assinatura?.local ?? [S.casa?.cidade, S.casa?.estado].filter(Boolean).join(", ");
  if (!nome) return "";
  return `<footer class="assinatura"><div><strong>${esc(nome)}</strong>${local ? `<span>${esc(local)}</span>` : ""}</div><span>${new Date().getFullYear()}</span></footer>`;
}

function sobre() {
  const paragrafos = (P.sobre || []).filter(Boolean);
  if (!paragrafos.length) return $("#sobre").remove();
  $("#texto-sobre").innerHTML = paragrafos.map(paragrafo).join("") + assinatura();
}

// --------------------------------------------------------------- recordes
function recordes() {
  const lista = (S.recordes || []).filter((r) => ESFORCOS_PRINCIPAIS.includes(r.nome) && r.top?.length);
  const corridas = A.filter((a) => a.grupo === "corrida").length;
  const corpo = $("#tabela-recordes");
  if (!lista.length) {
    corpo.innerHTML = `<p class="vazio">Os recordes aparecem quando os detalhes das corridas forem baixados do Strava.</p>`;
  } else {
    corpo.innerHTML = `<div class="tabela-rolagem"><table class="resultados">
      <thead><tr><th>Distância</th><th class="num">Tempo</th><th class="num">Pace</th><th>Quando</th><th class="so-largo">Evolução por ano</th></tr></thead>
      <tbody>${lista
        .map((r) => {
          const m = r.top[0];
          const anos = Object.values(r.por_ano);
          return `<tr class="clicavel" data-id="${m.id}">
            <td><b>${esc(NOMES_ESFORCO[r.nome] || r.nome)}</b></td>
            <td class="num"><span class="tempo">${relogio(m.t)}</span></td>
            <td class="num">${pace(r.dist, m.t)}</td>
            <td><a href="${linkTreino(m.id)}">${esc(m.n)}</a><div class="secundario">${dataLonga(new Date(`${m.d}T12:00`))}</div></td>
            <td class="so-largo" data-dica="${esc(Object.entries(r.por_ano).map(([a, t]) => `${a}: ${relogio(t)}`).join("\n"))}">${miniLinha(anos)}</td>
          </tr>`;
        })
        .join("")}</tbody></table></div>
      <p class="secundario" style="color:var(--texto-3);font-size:.8125rem;margin:.75rem 0 0">Melhores trechos dentro de qualquer corrida, medidos pelo Strava.${S.detalhados < corridas ? ` Ainda faltam detalhes de algumas corridas antigas: eles chegam aos poucos a cada sincronização.` : ""}</p>`;
    corpo.querySelector("tbody").onclick = (ev) => {
      const tr = ev.target.closest("tr[data-id]");
      if (tr && !ev.target.closest("a")) location.href = linkTreino(tr.dataset.id);
    };
  }

  // provas: as do perfil.json + as marcadas como prova no Strava
  const manuais = (P.provas || []).filter((p) => p.nome).map((p) => ({ ...p, data: new Date(`${p.data}T12:00`), manual: true }));
  const idsManuais = new Set(manuais.map((p) => String(p.strava_id)));
  const diasManuais = new Set((P.provas || []).map((p) => p.data));
  const auto = A.filter((a) => a.prova && !idsManuais.has(String(a.id)) && !diasManuais.has(a.dia)).map((a) => ({
    nome: a.n, data: a.data, distancia: dist(a.m), tempo: relogio(a.e || a.s), strava_id: a.id,
  }));
  const provas = [...manuais, ...auto].sort((x, y) => y.data - x.data);
  const visiveis = estado.provasTodas ? provas : provas.slice(0, 7);
  $("#provas").innerHTML = provas.length
    ? `<ul class="lista-provas">${visiveis
        .map((p) => `<li>
          <span class="nome">${p.strava_id ? `<a href="${linkTreino(p.strava_id)}">${esc(p.nome)}</a>` : esc(p.nome)}</span>
          <span class="info">${dataLonga(p.data)}${p.distancia ? `, ${esc(p.distancia)}` : ""}${p.nota ? `. ${esc(p.nota)}` : ""}</span>
          <span class="tempo">${esc(p.tempo || "")}</span></li>`)
        .join("")}</ul>${provas.length > 7 ? `<button class="mais" id="provas-todas" type="button">${estado.provasTodas ? "Mostrar menos" : `Mostrar as ${provas.length} provas`}</button>` : ""}`
    : `<p class="vazio">Marque suas provas no Strava (tipo de corrida: prova) ou liste-as em config/perfil.json.</p>`;
  const botao = $("#provas-todas");
  if (botao) botao.onclick = () => { estado.provasTodas = !estado.provasTodas; recordes(); };

  conquistas();
}

function conquistas() {
  const corridas = A.filter((a) => a.grupo === PRINCIPAL);
  const itens = [];
  const longo = corridas.reduce((x, a) => (a.m > (x?.m || 0) ? a : x), null);
  if (longo) itens.push([dist(longo.m), "Treino mais longo", `${longo.n}, em ${dataLonga(longo.data)}.`, longo.id]);

  const porSemana = new Map();
  const porMes = new Map();
  for (const a of corridas) {
    const s = chaveDia(inicioSemana(a.data));
    porSemana.set(s, (porSemana.get(s) || 0) + a.m);
    const m = `${a.ano}-${a.data.getMonth()}`;
    porMes.set(m, (porMes.get(m) || 0) + a.m);
  }
  const [semana, mS] = [...porSemana].sort((x, y) => y[1] - x[1])[0] || [];
  if (semana) itens.push([dist(mS, 0), "Semana mais forte", `Começou em ${dataLonga(new Date(`${semana}T12:00`))}.`]);
  const [mes, mM] = [...porMes].sort((x, y) => y[1] - x[1])[0] || [];
  if (mes) {
    const [ano, mi] = mes.split("-").map(Number);
    itens.push([dist(mM, 0), "Mês mais forte", `${MESES_CURTOS[mi]} de ${ano}.`]);
  }
  if (PRINCIPAL === "corrida") {
    const maratonas = corridas.filter((a) => a.m >= 42000).length;
    const meias = corridas.filter((a) => a.m >= 21000 && a.m < 42000).length;
    if (maratonas) itens.push([num(maratonas), maratonas === 1 ? "Corrida de 42 km ou mais" : "Corridas de 42 km ou mais", "Provas e treinos do tamanho de uma maratona."]);
    if (meias) itens.push([num(meias), "Corridas de 21 a 42 km", "Pelo menos uma meia maratona em cada uma."]);
  }
  const cedo = A.filter((a) => a.data.getHours() < 6).length;
  if (cedo) itens.push([num(cedo), "Antes das 6h", "Treinos que começaram com o dia ainda escuro."]);
  const kudos = soma(A, (a) => a.k);
  if (kudos) itens.push([num(kudos), "Kudos recebidos", "Cada um conta."]);

  const manuais = (P.conquistas || []).filter((c) => c.titulo);
  $("#conquistas").innerHTML =
    itens
      .map(([v, t, txt, id]) => `<div class="conquista"><strong>${esc(v)}</strong><span class="titulo">${id ? `<a href="${linkTreino(id)}">${esc(t)}</a>` : esc(t)}</span><p>${esc(txt)}</p></div>`)
      .join("") +
    manuais.map((c) => `<div class="conquista manual"><strong>${esc(c.titulo)}</strong><p>${esc(c.texto || "")}</p></div>`).join("");
}

// --------------------------------------------------------------- recentes
function periodo(chave) {
  const hoje = new Date();
  const zero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const semana = inicioSemana(hoje);
  switch (chave) {
    case "semana": return [semana, null];
    case "passada": { const ini = new Date(semana); ini.setDate(ini.getDate() - 7); return [ini, semana]; }
    case "mes": return [new Date(hoje.getFullYear(), hoje.getMonth(), 1), null];
    case "60": { const ini = new Date(zero); ini.setDate(ini.getDate() - 59); return [ini, null]; }
    default: return [new Date(hoje.getFullYear(), 0, 1), null];
  }
}

function recentes() {
  const opcoes = [
    { valor: "semana", rotulo: "Esta semana" }, { valor: "passada", rotulo: "Semana passada" }, { valor: "mes", rotulo: "Este mês" },
    { valor: "60", rotulo: "Últimos 60 dias" }, { valor: "ano", rotulo: "Este ano" },
  ];
  abas($("#abas-recentes"), opcoes, estado.periodo, (v) => { estado.periodo = v; estado.recentesMostrar = 8; recentes(); });
  const [ini, fim] = periodo(estado.periodo);
  const lista = A.filter((a) => a.data >= ini && (!fim || a.data < fim)).reverse();

  const visiveis = lista.slice(0, estado.recentesMostrar);
  $("#lista-recentes").innerHTML = lista.length
    ? `<ul class="lista-treinos">${visiveis.map(itemTreino).join("")}</ul>${lista.length > visiveis.length ? `<button class="mais" type="button" id="mais-recentes">Mostrar mais ${Math.min(8, lista.length - visiveis.length)}</button>` : ""}`
    : `<p class="vazio">Nenhum treino neste período ainda. ${estado.periodo === "semana" ? "A semana começa na segunda." : ""}</p>`;
  const mais = $("#mais-recentes");
  if (mais) mais.onclick = () => { estado.recentesMostrar += 8; recentes(); };

  const porGrupo = {};
  for (const a of lista) porGrupo[a.grupo] = (porGrupo[a.grupo] || 0) + a.s;
  const tempo = soma(lista, (a) => a.s);
  const fatias = Object.entries(porGrupo).sort((x, y) => y[1] - x[1]).map(([g, s]) => ({
    rotulo: GRUPOS[g].nome, valor: s, cor: corGrupo(g), dica: `${GRUPOS[g].nome}\n${duracao(s)}`,
  }));
  $("#resumo-recentes").innerHTML = `
    <dl><div><dt>Treinos</dt><dd>${num(lista.length)}</dd></div><div><dt>Distância</dt><dd>${dist(soma(lista, (a) => a.m), 0)}</dd></div><div><dt>Tempo</dt><dd>${duracao(tempo)}</dd></div></dl>
    <h3 class="bloco-titulo" style="font-size:1rem">Tempo por esporte</h3>
    <div class="rosca-area"><div id="rosca-recentes"></div><ul class="legenda">${fatias
      .map((f) => `<li><i style="background:${f.cor}"></i><span>${esc(f.rotulo)}</span><span>${duracao(f.valor)}, ${num((f.valor / tempo) * 100)}%</span></li>`)
      .join("") || `<li style="grid-template-columns:1fr;color:var(--texto-3)">Sem treinos no período.</li>`}</ul></div>`;
  rosca($("#rosca-recentes"), { fatias, centro: [duracao(tempo), "no total"], rotulo: "Tempo por esporte no período" });
}

function itemTreino(a) {
  const medida = a.m ? dist(a.m) : duracao(a.s);
  const complemento = a.m ? `${duracao(a.s)}, ${ritmo(a)}` : nomeTipo(a.t);
  return `<li><a href="${linkTreino(a.id)}">
    <span class="cor" style="background:${corGrupo(a.grupo)}"></span>
    <span class="nome">${esc(a.n)}${a.prova ? '<span class="selo-pr" style="background:var(--vermelho);color:var(--sobre-destaque)">prova</span>' : ""}</span>
    <span class="quando">${esc(nomeTipo(a.t))}, ${esc(quandoRelativo(a.data))}</span>
    <span class="medidas"><b>${esc(medida)}</b>${esc(complemento)}</span>
  </a></li>`;
}

// -------------------------------------------------------------- destaques
function destaques() {
  const principal = A.filter((a) => a.grupo === PRINCIPAL && a.m > 0);
  const comClima = principal.filter((a) => a.cl && !a.in);
  const minimoRapido = PRINCIPAL === "corrida" ? 5000 : PRINCIPAL === "pedal" ? 20000 : 1000;
  const categorias = {
    longos: { rotulo: "Mais longos", lista: () => [...principal].sort((x, y) => y.m - x.m), valor: (a) => ritmo(a), col: PRINCIPAL === "pedal" ? "Velocidade" : "Ritmo" },
    rapidos: { rotulo: "Mais rápidos", lista: () => principal.filter((a) => a.m >= minimoRapido && !a.in).sort((x, y) => x.s / x.m - y.s / y.m), valor: (a) => ritmo(a), col: PRINCIPAL === "pedal" ? "Velocidade" : "Ritmo" },
    subida: { rotulo: "Mais subida", lista: () => [...principal].sort((x, y) => y.el - x.el), valor: (a) => elev(a.el), col: "Subida" },
    provas: { rotulo: "Provas", lista: () => A.filter((a) => a.prova).sort((x, y) => y.data - x.data), valor: (a) => ritmo(a), col: "Ritmo" },
    kudos: { rotulo: "Mais kudos", lista: () => A.filter((a) => a.k).sort((x, y) => y.k - x.k), valor: (a) => `${num(a.k)} kudos`, col: "Kudos" },
    quentes: { rotulo: "Mais quentes", lista: () => [...comClima].sort((x, y) => y.cl[0] - x.cl[0]), valor: (a) => `${num1(a.cl[0])} °C`, col: "Temperatura" },
    frios: { rotulo: "Mais frios", lista: () => [...comClima].sort((x, y) => x.cl[0] - y.cl[0]), valor: (a) => `${num1(a.cl[0])} °C`, col: "Temperatura" },
  };
  if (!comClima.length) { delete categorias.quentes; delete categorias.frios; }
  if (!A.some((a) => a.prova)) delete categorias.provas;
  if (!categorias[estado.destaque]) estado.destaque = "longos";
  abas($("#abas-destaques"), Object.entries(categorias).map(([valor, c]) => ({ valor, rotulo: c.rotulo })), estado.destaque, (v) => { estado.destaque = v; destaques(); });
  const cat = categorias[estado.destaque];
  const top = cat.lista().slice(0, 10);
  $("#tabela-destaques").innerHTML = top.length
    ? `<div class="tabela-rolagem"><table class="resultados"><thead><tr><th></th><th>Treino</th><th class="num">Distância</th><th class="num so-largo">Tempo</th><th class="num">${cat.col}</th></tr></thead>
      <tbody>${top
        .map((a, i) => `<tr class="clicavel" data-id="${a.id}"><td class="posicao">${i + 1}</td>
          <td><a href="${linkTreino(a.id)}">${esc(a.n)}</a><div class="secundario">${dataLonga(a.data)}${a.l != null && S.lugares[a.l] ? `, ${esc(S.lugares[a.l].cidade)}` : ""}</div></td>
          <td class="num"><span class="tempo">${esc(dist(a.m))}</span></td><td class="num so-largo">${relogio(a.s)}</td><td class="num">${esc(cat.valor(a))}</td></tr>`)
        .join("")}</tbody></table></div>`
    : `<p class="vazio">Nenhum treino nesta categoria.</p>`;
  const tbody = $("#tabela-destaques tbody");
  if (tbody) tbody.onclick = (ev) => {
    const tr = ev.target.closest("tr[data-id]");
    if (tr && !ev.target.closest("a")) location.href = linkTreino(tr.dataset.id);
  };
}

// ---------------------------------------------------------------- números
function numeros() {
  const presentes = Object.keys(GRUPOS).filter((g) => A.some((a) => a.grupo === g));
  const opcoes = [{ valor: "tudo", rotulo: "Tudo" }, ...presentes.map((g) => ({ valor: g, rotulo: GRUPOS[g].nome, cor: corGrupo(g) }))];
  abas($("#abas-numeros"), opcoes, estado.grupoNumeros, (v) => { estado.grupoNumeros = v; numeros(); });
  const g = estado.grupoNumeros;
  const L = doGrupo(g);
  const porDistancia = soma(L, (a) => a.m) > 0;
  const medida = (a) => (porDistancia ? distValor(a.m) : a.s / 3600);
  const fmtMedida = (v) => (porDistancia ? `${num(v)} ${rotuloDist()}` : `${num1(v)} h`);
  const unidadeEixo = porDistancia ? rotuloDist() : "h";

  const caixas = [];
  const caixa = (id, titulo, nota, largo = false) => caixas.push(`<div class="cartao-grafico${largo ? " largo" : ""}"><h3>${esc(titulo)}</h3><p class="nota">${esc(nota)}</p><div class="grafico" id="${id}"></div></div>`);
  caixa("g-anos", porDistancia ? "Distância por ano" : "Horas por ano", `${nomeGrupo(g)}, em ${unidadeEixo}.`, true);
  caixa("g-horas", "Que horas eu começo", "Quantidade de treinos por hora de início.");
  caixa("g-semana", "Dia da semana", porDistancia ? `Distância média por treino, em ${unidadeEixo}.` : "Quantidade de treinos.");
  if (porDistancia) caixa("g-distancias", "Tamanho dos treinos", "Quantos treinos em cada faixa de distância.");
  const comFC = L.filter((a) => a.hr);
  if (comFC.length) caixa("g-zonas", "Zonas de frequência cardíaca", "Tempo em cada zona, pela FC média de cada treino.");
  const corridas = L.filter((a) => a.grupo === "corrida" && a.m >= 1000 && a.s);
  if (g === "corrida" && corridas.some((a) => a.hr)) caixa("g-pace-fc", "Ritmo e frequência cardíaca", "Cada ponto é uma corrida. Mais à direita, mais rápido.");
  if ((g === "corrida" || g === "pedal") && L.length) caixa("g-ritmos", g === "corrida" ? "Ritmos mais comuns" : "Velocidades mais comuns", "Quantos treinos em cada faixa.");
  caixa("g-ambiente", "Na rua ou dentro de casa", "Esteira, rolo e academia contam como dentro.");
  const aparelhos = L.filter((a) => a.ap);
  if (aparelhos.length) caixa("g-aparelhos", "Aparelhos", "O que registrou os treinos.");
  $("#graficos").innerHTML = caixas.join("");

  if (!L.length) return;

  // por ano
  const anos = {};
  for (const a of L) {
    anos[a.ano] ||= { v: 0, n: 0 };
    anos[a.ano].v += medida(a);
    anos[a.ano].n++;
  }
  barras($("#g-anos"), {
    dados: Object.entries(anos).map(([ano, x]) => ({ rotulo: ano, valor: x.v, dica: `${ano}\n${fmtMedida(x.v)} em ${nTreinos(x.n)}` })),
    mostrarValores: true, fmtValor: (v) => num(v), altura: 240, rotulo: "Volume por ano",
  });

  // horário
  const horas = Array(24).fill(0);
  for (const a of L) horas[a.data.getHours()]++;
  barras($("#g-horas"), {
    dados: horas.map((n, h) => ({ rotulo: `${h}h`, valor: n, dica: `${h}h às ${h + 1}h\n${nTreinos(n)}` })),
    rotuloCada: 3, rotulo: "Treinos por hora de início",
  });

  // dia da semana
  const dias = Array.from({ length: 7 }, () => ({ v: 0, n: 0 }));
  for (const a of L) {
    const d = (a.data.getDay() + 6) % 7;
    dias[d].v += medida(a);
    dias[d].n++;
  }
  const nomesDias = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
  barras($("#g-semana"), {
    dados: dias.map((x, i) => ({
      rotulo: nomesDias[i].slice(0, 3), valor: porDistancia ? (x.n ? x.v / x.n : 0) : x.n,
      dica: `${nomesDias[i]}\n${nTreinos(x.n)}${porDistancia && x.n ? `, média de ${fmtMedida(x.v / x.n)}` : ""}`,
    })),
    mostrarValores: true, fmtValor: (v) => (porDistancia ? num1(v) : num(v)), rotulo: "Treinos por dia da semana",
  });

  // tamanhos
  if (porDistancia) {
    const km = L.filter((a) => a.m > 0).map((a) => distValor(a.m));
    const limites = g === "corrida" ? [0, 5, 10, 15, 21, 30, 42] : g === "pedal" ? [0, 20, 40, 60, 80, 100, 150] : g === "natacao" ? [0, 1, 2, 3, 4] : autoLimites(km);
    const faixas = limites.map((ini, i) => ({ ini, fim: limites[i + 1] ?? Infinity, n: 0 }));
    for (const v of km) faixas.findLast((f) => v >= f.ini).n++;
    barras($("#g-distancias"), {
      dados: faixas.map((f) => ({ rotulo: f.fim === Infinity ? `${f.ini}+` : `${f.ini}–${f.fim}`, valor: f.n, dica: `${f.fim === Infinity ? `${f.ini} ${rotuloDist()} ou mais` : `De ${f.ini} a ${f.fim} ${rotuloDist()}`}\n${nTreinos(f.n)}` })),
      mostrarValores: true, rotulo: "Treinos por faixa de distância",
    });
  }

  // zonas de FC
  if (comFC.length) {
    let zonas = (S.zonas_fc || []).filter((z) => z.max !== 0);
    if (zonas.length < 3) {
      const max = Math.max(...comFC.map((a) => a.hrx || a.hr));
      zonas = [0.6, 0.7, 0.8, 0.9, 2].map((f, i, arr) => ({ min: i ? Math.round(max * arr[i - 1]) : 0, max: f >= 2 ? -1 : Math.round(max * f) }));
    }
    const nomes = ["Recuperação", "Aeróbico", "Ritmo", "Limiar", "Anaeróbico"];
    const tempos = zonas.map(() => 0);
    for (const a of comFC) {
      const i = zonas.findIndex((z) => a.hr >= z.min && (z.max === -1 || a.hr < z.max));
      tempos[i === -1 ? zonas.length - 1 : i] += a.s;
    }
    const total = tempos.reduce((s, v) => s + v, 0);
    barrasH($("#g-zonas"), zonas.map((z, i) => ({
      rotulo: `Z${i + 1} ${nomes[i] || ""}`, valor: tempos[i], texto: `${num((tempos[i] / total) * 100)}%`,
      dica: `${z.max === -1 ? `acima de ${z.min}` : `${z.min} a ${z.max}`} bpm\n${duracao(tempos[i])}`,
      cor: `color-mix(in srgb, var(--destaque) ${35 + i * 16}%, var(--fundo-2))`,
    })));
  }

  // pace x FC
  if ($("#g-pace-fc")) {
    const pontos = corridas.filter((a) => a.hr && !a.in).map((a) => ({
      x: paceSeg(a.m, a.s), y: a.hr, dica: `${a.n}\n${dataLonga(a.data)}\n${pace(a.m, a.s)}, ${a.hr} bpm`,
    }));
    dispersao($("#g-pace-fc"), { pontos, fmtX: (v) => relogio(v), fmtY: (v) => num(v), rotuloX: `ritmo (min/${rotuloDist()})`, rotuloY: "bpm", inverterX: true, rotulo: "Ritmo e frequência cardíaca" });
  }

  // ritmos
  if ($("#g-ritmos")) {
    let dados;
    if (g === "corrida") {
      const ps = corridas.filter((a) => !a.in).map((a) => paceSeg(a.m, a.s)).filter((p) => p > 120 && p < 900).sort((x, y) => x - y);
      const passo = 15;
      const ini = Math.floor(ps[Math.floor(ps.length * 0.02)] / passo) * passo;
      const fim = Math.ceil(ps[Math.floor(ps.length * 0.98)] / passo) * passo;
      dados = [];
      for (let p = ini; p < fim; p += passo) {
        const n = ps.filter((x) => x >= p && x < p + passo).length;
        dados.push({ rotulo: relogio(p), valor: n, dica: `${relogio(p)} a ${relogio(p + passo)} /${rotuloDist()}\n${num(n)} corridas` });
      }
    } else {
      const vs = L.filter((a) => a.m && a.s && !a.in).map((a) => distValor(a.m) / (a.s / 3600));
      dados = [];
      for (let v = 10; v < 45; v += 2.5) {
        const n = vs.filter((x) => x >= v && x < v + 2.5).length;
        if (n || dados.length) dados.push({ rotulo: num(v), valor: n, dica: `${num1(v)} a ${num1(v + 2.5)}\n${num(n)} pedais` });
      }
      while (dados.length && !dados.at(-1).valor) dados.pop();
    }
    barras($("#g-ritmos"), { dados, rotuloCada: Math.ceil(dados.length / 8), rotulo: "Distribuição de ritmo" });
  }

  // ambiente
  const dentro = L.filter((a) => a.in || (!a.ll && !a.m));
  const fora = L.length - dentro.length;
  $("#g-ambiente").innerHTML = `
    <div class="divisao" role="img" aria-label="${num((fora / L.length) * 100)}% na rua">
      <i style="flex:${fora};background:var(--destaque)" data-dica="Na rua\n${nTreinos(fora)}"></i>
      <i style="flex:${dentro.length};background:var(--linha-forte)" data-dica="Dentro de casa\n${nTreinos(dentro.length)}"></i>
    </div>
    <ul class="legenda">
      <li><i style="background:var(--destaque)"></i><span>Na rua</span><span>${nTreinos(fora)}, ${num((fora / L.length) * 100)}%</span></li>
      <li><i style="background:var(--linha-forte)"></i><span>Dentro de casa</span><span>${nTreinos(dentro.length)}, ${num((dentro.length / L.length) * 100)}%</span></li>
      <li><i style="background:transparent;border:1px solid var(--texto-3)"></i><span>Em grupo</span><span>${nTreinos(L.filter((a) => a.pessoas > 1).length)}</span></li>
    </ul>`;

  if (aparelhos.length) {
    const conta = {};
    for (const a of aparelhos) conta[a.ap] = (conta[a.ap] || 0) + 1;
    barrasH($("#g-aparelhos"), Object.entries(conta).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([nome, n]) => ({ rotulo: nome, valor: n, texto: num(n) })));
  }
}

function autoLimites(valores) {
  const max = Math.max(...valores, 1);
  const passo = [1, 2, 5, 10, 20, 25, 50, 100].find((p) => max / p <= 7) || 200;
  return Array.from({ length: Math.ceil(max / passo) }, (_, i) => i * passo);
}

// ------------------------------------------------------------- constância
function constancia() {
  const anos = [...new Set(A.map((a) => a.ano))].sort((x, y) => y - x);
  abas($("#abas-constancia"), [{ valor: "12m", rotulo: "Últimos 12 meses" }, ...anos.map((a) => ({ valor: String(a), rotulo: String(a) }))], estado.ano, (v) => { estado.ano = v; constancia(); });
  const hoje = new Date();
  let ini, fim;
  if (estado.ano === "12m") {
    fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    ini = new Date(fim);
    ini.setDate(ini.getDate() - 364);
  } else {
    ini = new Date(+estado.ano, 0, 1);
    fim = new Date(+estado.ano, 11, 31);
    if (fim > hoje) fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  }
  const L = A.filter((a) => a.data >= ini && a.data < new Date(fim.getTime() + 864e5));
  const porDia = new Map();
  for (const a of L) {
    const d = porDia.get(a.dia) || { m: 0, s: 0, nomes: [] };
    d.m += a.m;
    d.s += a.s;
    d.nomes.push(a.n);
    porDia.set(a.dia, d);
  }
  const ms = [...porDia.values()].map((d) => d.m).filter(Boolean).sort((x, y) => x - y);
  const q = (f) => ms[Math.floor(f * (ms.length - 1))] || 0;
  const cortes = [q(0.25), q(0.5), q(0.8)];
  const valores = new Map();
  for (const [dia, d] of porDia) {
    const nivel = !d.m ? 1 : d.m <= cortes[0] ? 1 : d.m <= cortes[1] ? 2 : d.m <= cortes[2] ? 3 : 4;
    const data = new Date(`${dia}T12:00`);
    valores.set(dia, { nivel, dica: `${diaSemana(data)}, ${dataLonga(data)}\n${d.m ? dist(d.m) : duracao(d.s)}\n${d.nomes.slice(0, 3).join("\n")}` });
  }
  calendario($("#calendario"), { inicio: ini, fim, valores, rotulo: "Calendário de treinos" });

  const totalDias = Math.round((fim - ini) / 864e5) + 1;
  const seq = sequencias(new Set(porDia.keys()));
  const porSemana = new Map();
  for (const a of L) {
    if (a.grupo !== PRINCIPAL) continue;
    const s = chaveDia(inicioSemana(a.data));
    porSemana.set(s, (porSemana.get(s) || 0) + a.m);
  }
  const melhorSemana = Math.max(0, ...porSemana.values());
  $("#fatos-constancia").innerHTML = `
    <div><dt>Dias com treino</dt><dd>${num(porDia.size)}<small>de ${num(totalDias)}</small></dd></div>
    <div><dt>Dias de descanso</dt><dd>${num(((totalDias - porDia.size) / totalDias) * 100)}%</dd></div>
    <div><dt>Maior sequência</dt><dd>${num(seq.maior)}<small>dias seguidos</small></dd></div>
    <div><dt>Semana mais forte</dt><dd>${esc(dist(melhorSemana, 0))}<small>de ${esc(GRUPOS[PRINCIPAL].nome.toLowerCase())}</small></dd></div>`;

  // volume mensal
  const meses = [];
  const cursor = new Date(ini.getFullYear(), ini.getMonth(), 1);
  while (cursor <= fim) {
    meses.push({ ano: cursor.getFullYear(), mes: cursor.getMonth(), m: 0, n: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const a of L) {
    if (a.grupo !== PRINCIPAL) continue;
    const x = meses.find((m) => m.ano === a.ano && m.mes === a.data.getMonth());
    if (x) { x.m += a.m; x.n++; }
  }
  $("#titulo-mensal").textContent = `${GRUPOS[PRINCIPAL].nome} por mês`;
  barras($("#g-mensal"), {
    dados: meses.map((m) => ({ rotulo: MESES_CURTOS[m.mes], valor: distValor(m.m), dica: `${MESES_CURTOS[m.mes]} de ${m.ano}\n${dist(m.m)} em ${nTreinos(m.n)}` })),
    mostrarValores: true, fmtValor: (v) => num(v), altura: 220, rotulo: "Volume por mês",
  });
}

// ------------------------------------------------------------------ clima
function clima() {
  const sec = $("#clima");
  const L = A.filter((a) => a.cl);
  if (!L.length) {
    $("#conteudo-clima").innerHTML = `<p class="vazio">O clima de cada treino é calculado depois da sincronização com o Strava.</p>`;
    return;
  }
  const chuva = L.filter((a) => a.cl[2] >= 0.3 || (a.cl[1] >= 51 && a.cl[1] < 95) || a.cl[1] >= 95);
  const quente = L.reduce((x, a) => (a.cl[0] > x.cl[0] ? a : x));
  const frio = L.reduce((x, a) => (a.cl[0] < x.cl[0] ? a : x));
  const media = soma(L, (a) => a.cl[0]) / L.length;
  $("#conteudo-clima").innerHTML = `
    <dl class="fatos" style="margin-top:0">
      <div><dt>Treinos com chuva</dt><dd>${num(chuva.length)}<small>${num((chuva.length / L.length) * 100)}% dos treinos na rua</small></dd></div>
      <div><dt>O mais quente</dt><dd>${num1(quente.cl[0])} °C</dd><dd style="font:inherit;font-size:.8125rem;color:var(--texto-3)"><a href="${linkTreino(quente.id)}">${esc(quente.n)}</a>, ${dataLonga(quente.data)}</dd></div>
      <div><dt>O mais frio</dt><dd>${num1(frio.cl[0])} °C</dd><dd style="font:inherit;font-size:.8125rem;color:var(--texto-3)"><a href="${linkTreino(frio.id)}">${esc(frio.n)}</a>, ${dataLonga(frio.data)}</dd></div>
      <div><dt>Temperatura média</dt><dd>${num1(media)} °C</dd></div>
    </dl>
    <div class="grade-graficos">
      <div class="cartao-grafico"><h3>Temperatura na largada</h3><p class="nota">Quantos treinos em cada faixa de temperatura.</p><div class="grafico" id="g-temperaturas"></div></div>
      <div class="cartao-grafico"><h3>Como estava o céu</h3><p class="nota">Pela condição mais fechada durante o treino.</p><div class="grafico" id="g-condicoes"></div></div>
    </div>`;
  const faixas = [-Infinity, 0, 5, 10, 15, 20, 25, 30, 35].map((ini, i, arr) => ({ ini, fim: arr[i + 1] ?? Infinity, n: 0 }));
  for (const a of L) faixas.findLast((f) => a.cl[0] >= f.ini).n++;
  while (faixas.length && !faixas[0].n) faixas.shift();
  while (faixas.length && !faixas.at(-1).n) faixas.pop();
  barras($("#g-temperaturas"), {
    dados: faixas.map((f) => ({
      rotulo: f.ini === -Infinity ? `<${f.fim}°` : f.fim === Infinity ? `${f.ini}°+` : `${f.ini}–${f.fim}°`, valor: f.n,
      dica: `${f.ini === -Infinity ? `abaixo de ${f.fim}` : f.fim === Infinity ? `${f.ini} °C ou mais` : `${f.ini} a ${f.fim} °C`}\n${nTreinos(f.n)}`,
      cor: `color-mix(in srgb, ${f.ini >= 25 ? "var(--destaque)" : f.ini >= 15 ? "var(--neutro)" : "var(--frio)"} 85%, var(--fundo))`,
    })),
    mostrarValores: true, rotulo: "Treinos por temperatura",
  });
  const conta = CONDICOES.map(([nome, teste]) => ({ nome, n: L.filter((a) => a.cl[1] != null && teste(a.cl[1])).length })).filter((x) => x.n);
  barrasH($("#g-condicoes"), conta.map((x) => ({ rotulo: x.nome, valor: x.n, texto: num(x.n) })));
  sec.dataset.ok = "1";
}

// ------------------------------------------------------------ equipamento
function equipamento() {
  const lista = (S.equipamento || []).filter((g) => g.m > 0).sort((x, y) => (x.aposentado - y.aposentado) || y.m - x.m);
  if (!lista.length) return $("#equipamento")?.remove();
  barrasH($("#lista-equipamento"), lista.map((g) => ({
    rotulo: g.nome, extra: `${g.tipo === "bike" ? "bike" : "tênis"}${g.aposentado ? ", aposentado" : g.principal ? ", o principal" : ""}`,
    valor: g.m, texto: dist(g.m, 0), dica: `${nTreinos(g.usos)} registrados`,
    cor: g.aposentado ? "var(--linha-forte)" : g.tipo === "bike" ? "var(--c-pedal)" : "var(--destaque)",
  })));
}

// ---------------------------------------------------------------- lugares
let mapa, camadaBase, camadaRotas, camadaCidades;

function lugares() {
  if (!S.lugares?.length && !A.some((a) => a.ll)) return $("#lugares")?.remove();
  painelLugares();
  const alvo = $("#mapa");
  const iniciarMapa = () => {
    if (!window.L) return setTimeout(iniciarMapa, 200);
    criarMapa(alvo);
  };
  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver((itens) => {
      if (itens.some((i) => i.isIntersecting)) {
        obs.disconnect();
        iniciarMapa();
      }
    }, { rootMargin: "400px" });
    obs.observe(alvo);
  } else iniciarMapa();
}

function painelLugares() {
  if (!$("#painel-lugares")) return;
  const lugaresLista = S.lugares || [];
  const porLugar = lugaresLista.map((l, i) => ({ ...l, i, n: 0, m: 0 }));
  for (const a of A) if (a.l != null && porLugar[a.l]) { porLugar[a.l].n++; porLugar[a.l].m += a.m; }
  const paises = {};
  for (const l of porLugar) {
    paises[l.pais] ||= { n: 0, cidades: 0 };
    paises[l.pais].n += l.n;
    paises[l.pais].cidades++;
  }
  const longe = A.filter((a) => a.casa != null).reduce((x, a) => (a.casa > (x?.casa ?? -1) ? a : x), null);
  const listaPaises = Object.entries(paises).sort((x, y) => y[1].n - x[1].n);
  if (estado.pais !== "todos" && !paises[estado.pais]) estado.pais = "todos";
  const cidades = porLugar.filter((l) => estado.pais === "todos" || l.pais === estado.pais).sort((x, y) => y.n - x.n);

  $("#painel-lugares").innerHTML = `
    <dl class="fatos" style="margin:0 0 1.25rem;grid-template-columns:repeat(3,minmax(0,1fr))">
      <div><dt>Países</dt><dd>${num(listaPaises.length)}</dd></div>
      <div><dt>Cidades</dt><dd>${num(porLugar.length)}</dd></div>
      <div><dt>Mais longe de casa</dt><dd>${longe ? `${num(distValor(longe.casa * 1000))}<small>${rotuloDist()}</small>` : "–"}</dd></div>
    </dl>
    ${longe ? `<p style="margin:0 0 1.25rem;color:var(--texto-2);font-size:.9375rem">O mais distante foi <button type="button" class="botao-texto" id="ir-longe">${esc(longe.n)}</button>, em ${dataLonga(longe.data)}${longe.l != null && lugaresLista[longe.l] ? `, ${esc(lugaresLista[longe.l].cidade)}` : ""}.</p>` : ""}
    <div class="abas" id="abas-paises"></div>
    <ul class="lista-lugares">${cidades
      .map((l) => `<li><button type="button" data-lat="${l.lat}" data-lng="${l.lng}">
        <span class="cidade">${esc(l.cidade)}</span><span class="regiao">${esc([l.estado !== l.cidade ? l.estado : "", l.pais].filter(Boolean).join(", "))}</span>
        <span class="conta">${nTreinos(l.n)}<br>${dist(l.m, 0)}</span></button></li>`)
      .join("")}</ul>`;
  abas($("#abas-paises"), [{ valor: "todos", rotulo: `Todos (${num(porLugar.length)})` }, ...listaPaises.map(([p, x]) => ({ valor: p, rotulo: `${p} (${x.cidades})` }))], estado.pais, (v) => {
    estado.pais = v;
    painelLugares();
  });
  $(".lista-lugares").onclick = (ev) => {
    const b = ev.target.closest("button[data-lat]");
    if (b && mapa) {
      mapa.flyTo([+b.dataset.lat, +b.dataset.lng], 12, { duration: reduzirMovimento() ? 0 : 1.2 });
      $("#mapa").scrollIntoView({ behavior: reduzirMovimento() ? "auto" : "smooth", block: "center" });
    }
  };
  const ir = $("#ir-longe");
  if (ir) ir.onclick = () => {
    if (!mapa) return;
    mapa.flyTo(longe.ll, 12, { duration: reduzirMovimento() ? 0 : 1.6 });
    $("#mapa").scrollIntoView({ behavior: reduzirMovimento() ? "auto" : "smooth", block: "center" });
  };
}

// no mapa, o tom de texto do destaque: mais claro no tema escuro e mais escuro no claro, para a rota aparecer
const corDestaque = () => getComputedStyle(document.documentElement).getPropertyValue("--destaque-tx").trim();

async function criarMapa(el) {
  const L = window.L;
  mapa = L.map(el, { preferCanvas: true, scrollWheelZoom: false, worldCopyJump: true });
  // o filtro de cor que deixa o mapa cinza (e escuro no tema escuro) fica no CSS
  camadaBase = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapa);
  mapa.on("focus", () => mapa.scrollWheelZoom.enable());
  mapa.on("blur", () => mapa.scrollWheelZoom.disable());

  // começa onde há mais treinos (a "casa"); sem cidades ainda, usa os próprios pontos
  const conta = new Map();
  for (const a of A) {
    if (!a.ll) continue;
    const chave = `${a.ll[0].toFixed(1)},${a.ll[1].toFixed(1)}`;
    conta.set(chave, (conta.get(chave) || 0) + 1);
  }
  const maisComum = [...conta].sort((x, y) => y[1] - x[1])[0]?.[0];
  if (S.casa) mapa.setView([S.casa.lat, S.casa.lng], 12);
  else if (maisComum) mapa.setView(maisComum.split(",").map(Number), 12);
  else if (S.lugares.length) mapa.fitBounds(S.lugares.map((l) => [l.lat, l.lng]), { padding: [30, 30] });
  else mapa.setView([0, 0], 2);

  const porId = new Map(A.map((a) => [a.id, a]));
  const rotas = (await buscarJSON("data/rotas.json", true)) || [];
  const renderer = L.canvas({ padding: 0.3, tolerance: 6 });
  camadaRotas = L.layerGroup().addTo(mapa);
  const cor = corDestaque();
  for (const [id, texto] of rotas) {
    const a = porId.get(id);
    if (!a) continue;
    const linha = L.polyline(decodificarRota(texto), { renderer, color: cor, weight: 1.6, opacity: 0.32, interactive: true });
    linha.on("click", (ev) => L.popup().setLatLng(ev.latlng).setContent(popupTreino(a)).openOn(mapa));
    linha.on("mouseover", () => linha.setStyle({ opacity: 1, weight: 3 }));
    linha.on("mouseout", () => linha.setStyle({ opacity: 0.32, weight: 1.6 }));
    camadaRotas.addLayer(linha);
  }

  // cidades: círculos que aparecem no zoom afastado
  camadaCidades = L.layerGroup();
  const porCidade = new Map();
  for (const a of A) if (a.l != null) porCidade.set(a.l, (porCidade.get(a.l) || 0) + 1);
  (S.lugares || []).forEach((l, i) => {
    const n = porCidade.get(i) || 0;
    if (!n) return;
    const lado = Math.round(18 + Math.min(26, Math.sqrt(n) * 2));
    const icone = L.divIcon({ className: "", html: `<div class="marcador-cidade" style="width:${lado}px;height:${lado}px">${n}</div>`, iconSize: [lado, lado] });
    L.marker([l.lat, l.lng], { icon: icone, title: `${l.cidade}: ${nTreinos(n)}`, keyboard: true })
      .on("click", () => mapa.flyTo([l.lat, l.lng], 12, { duration: reduzirMovimento() ? 0 : 1.2 }))
      .addTo(camadaCidades);
  });
  const ajustarCamadas = () => {
    if (mapa.getZoom() <= 8) camadaCidades.addTo(mapa);
    else camadaCidades.remove();
  };
  mapa.on("zoomend", ajustarCamadas);
  ajustarCamadas();

  const botaoMundo = L.control({ position: "topright" });
  botaoMundo.onAdd = () => {
    const div = L.DomUtil.create("div", "leaflet-bar");
    div.innerHTML = `<a href="#" role="button" title="Ver todos os lugares" aria-label="Ver todos os lugares" style="width:auto;padding:0 .6rem;font-size:.8125rem;font-weight:600">Ver tudo</a>`;
    L.DomEvent.on(div, "click", (ev) => {
      L.DomEvent.preventDefault(ev);
      if (S.lugares.length) mapa.flyToBounds(S.lugares.map((l) => [l.lat, l.lng]), { padding: [40, 40], duration: reduzirMovimento() ? 0 : 1.4 });
    });
    return div;
  };
  botaoMundo.addTo(mapa);

  aoMudarTema(() => {
    const nova = corDestaque();
    camadaRotas.eachLayer((l) => l.setStyle({ color: nova }));
  });
}

function popupTreino(a) {
  return `<strong>${esc(a.n)}</strong><br>${dataLonga(a.data)}, ${hora(a.data)}<br>${esc(dist(a.m))} em ${relogio(a.s)}${a.m ? `, ${esc(ritmo(a))}` : ""}<br><a href="${linkTreino(a.id)}">Abrir o treino</a>`;
}
