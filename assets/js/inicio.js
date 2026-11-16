import {
  $, $$, abas, aoMudarTema, aoMudarUnidade, aoRedimensionar, carregarTudo, chaveDia, corGrupo, dataCurta, dataLonga,
  dist, distValor, duracao, elev, esc, GRUPOS, hora, iniciarDicas, inicioSemana, linkTreino, MESES_CURTOS,
  montarRodape, montarTopo, nomeSite, nomeTopo, nomeTipo, num, num1, pace, paceSeg, quandoRelativo, reduzirMovimento, relogio,
  ritmo, rotuloDist, getUnidade, buscarJSON, diaSemana, NOMES_ESFORCO, CONDICOES, contagemRegressiva,
  DIAS_CURTOS, DIAS_LONGOS, LOCALE, nomePais, plural, t, tr, trechosRota,
} from "./comum.js";
import { barras, barrasH, calendario, dispersao, miniLinha, rosca } from "./graficos.js";
import { globoOrbita, globoVoltas, montanha, muro } from "./capa.js";

let S, P, PLANO, A, PRINCIPAL;
let ROTAS = new Map();
const nTreinos = (n) => plural(n, "{n} treino", "{n} treinos");
const estado = { periodo: "semana", recentesMostrar: 8, destaque: "longos", grupoNumeros: null, ano: "12m", regiao: "todos", viagensTodas: false, provasTodas: false };

const TITULOS = {
  sobre: t("Sobre"),
  alvos: t("Provas alvo"),
  recordes: t("Recordes"),
  recentes: t("Recentes"),
  destaques: t("Destaques"),
  numeros: t("Números"),
  constancia: t("Constância"),
  clima: t("Clima"),
  lugares: t("Lugares"),
  equipamento: t("Equipamento"),
};

const ESFORCOS_PRINCIPAIS = ["400m", "1K", "1 mile", "5K", "10K", "15K", "10 mile", "Half-Marathon", "30K", "Marathon", "50K"];

// ----------------------------------------------------------------- início
iniciarDicas();
iniciar();

async function iniciar() {
  try {
    ({ site: S, perfil: P, plano: PLANO } = await carregarTudo());
  } catch (erro) {
    $("#conteudo").innerHTML = `<div class="recipiente"><section class="secao"><h2>${t("Os dados não carregaram")}</h2>
      <p class="sub">${esc(erro.message)} ${t("Se você abriu o arquivo direto do computador, rode {cmd} na pasta do site e acesse http://localhost:8000.", { cmd: "<code>python -m http.server</code>" })}</p></section></div>`;
    return;
  }
  A = S.atividades;
  PRINCIPAL = grupoPrincipal();
  estado.grupoNumeros = PRINCIPAL;
  const nome = nomeSite(S, P);
  document.title = P.titulo_aba || nome;

  const links = [["#sobre", t("Sobre")], ...(P.provas_alvo?.length ? [["#alvos", t("Alvos")]] : []), ["#recordes", t("Recordes")], ["#recentes", t("Recentes")], ["#destaques", t("Destaques")],
    ["#numeros", t("Números")], ["#constancia", t("Constância")], ["#clima", t("Clima")], ["#lugares", t("Lugares")], ["#equipamento", t("Equipamento")]];
  if (PLANO?.semanas?.length) links.push(["plano.html", t("Plano")]);
  montarTopo({ nome: nomeTopo(S, P), links: links.filter(([h]) => !h.startsWith("#") || document.querySelector(h)) });
  montarRodape(S, P);

  for (const [id, padrao] of Object.entries(TITULOS)) {
    // perfil.json pode trocar o título ("Recordes" ou {"pt", "en", "es"}); uma frase embaixo só aparece
    // se vier de lá, como ["Recordes", "a frase"]
    const doPerfil = tr(P.secoes?.[id]);
    const [titulo, sub] = Array.isArray(doPerfil) ? doPerfil.map((x) => t(x || "")) : [doPerfil ? t(doPerfil) : padrao, ""];
    const cab = $(`#${id} .secao-cabeca`);
    if (cab) cab.insertAdjacentHTML("afterbegin", `<div><h2>${esc(titulo)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div>`);
  }

  if (!A.length) {
    $("#inicio").innerHTML = `<div><h2>${t("Nenhum treino ainda")}</h2><p class="sub">${t("Assim que você registrar uma atividade pública no Strava, ela aparece aqui.")}</p></div>`;
    return;
  }

  ROTAS = new Map((await buscarJSON("data/rotas.json", true)) || []);
  // no começo da semana, enquanto não houver treino do esporte principal, abre na semana passada
  const principal = grupoPrincipal();
  if (!A.some((a) => a.data >= inicioSemana(new Date()) && a.grupo === principal)) estado.periodo = "passada";
  abertura();
  sobre();
  alvos();
  desenharSecoes();
  lugares();
  aoMudarUnidade(() => {
    atualizarCapa();
    alvos();
    desenharSecoes();
    painelLugares();
  });
  aoRedimensionar(() => {
    alvos();
    desenharSecoes();
  });
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
const nomeGrupo = (g) => (g === "tudo" ? t("Tudo") : GRUPOS[g]?.nome || g);

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
  plural: { pt: "Picos da Bandeira", en: "Pico da Bandeira climbs", es: "Picos da Bandeira" },
  altura_m: 2892,
  detalhe: { pt: "do nível do mar ao cume", en: "from sea level to summit", es: "del nivel del mar a la cumbre" },
  lat: -20.4345,
  lng: -41.7973,
};
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

const IDS_CAPA = ["atividades", "distancia", "horas", "subida"];

function abertura() {
  const [linha1, linha2] = partesTitulo(nomeSite(S, P));
  const frase = (P.frase || []).filter(Boolean);
  const fotos = (P.fotos || []).filter((f) => f?.arquivo).slice(0, 2);
  const temContagem = PLANO?.prova?.data && new Date(PLANO.prova.data) > new Date();
  // a versão grande da foto ("grande" no perfil.json) só é baixada em telas largas
  const imagem = (f, tamanhos) =>
    `<img src="${esc(f.arquivo)}"${f.grande ? ` srcset="${esc(f.arquivo)} 1000w, ${esc(f.grande)} 1920w" sizes="${tamanhos}"` : ""} alt="${esc(tr(f.descricao) || t("Foto de {nome}", { nome: nomeSite(S, P) }))}" decoding="async"${tamanhos.includes("60vw") ? ' fetchpriority="high"' : ""}>`;
  const contagem = temContagem
    ? PLANO.semanas?.length
      ? `<a class="contagem" href="plano.html"><p>${t("Próxima prova")}</p><strong>${esc(PLANO.prova.nome)}</strong><div class="relogio" id="relogio-prova"></div><span class="ver">${t("Ver o plano de treino")}</span></a>`
      : `<a class="contagem" href="#alvos"><p>${t("Próxima prova")}</p><strong>${esc(PLANO.prova.nome)}</strong><div class="relogio" id="relogio-prova"></div><span class="ver">${t("Ver as provas da temporada")}</span></a>`
    : "";

  $("#inicio").innerHTML = `
    <div class="capa${fotos.length ? "" : " sem-fotos"}">
      <div class="painel-foto principal">
        ${fotos[0] ? imagem(fotos[0], "(min-width: 900px) 60vw, 100vw") : ""}
        <div class="capa-texto">
          <h1 class="titulo-site"><span>${esc(linha1)}</span>${linha2 ? `<span class="cor">${esc(linha2)}</span>` : ""}</h1>
          ${frase.length ? `<p class="mote">${frase.map(linhaFrase).join("")}</p>` : ""}
        </div>
      </div>
      ${fotos[1] ? `<div class="painel-foto lateral">${imagem(fotos[1], "(min-width: 900px) 40vw, 100vw")}${contagem}</div>` : contagem}
    </div>
    <dl class="faixa-numeros" id="numeros-capa">${IDS_CAPA.map((id) => `<div class="num-capa" id="capa-${id}"><dt class="rotulo"></dt><dd class="valor"></dd></div>`).join("")}</dl>
    <div class="perspectiva">${IDS_CAPA.map((id) => `<article class="cartao-perspectiva" id="persp-${id}"><p class="comparacao"></p><div class="viz" id="viz-${id}"></div></article>`).join("")}</div>`;

  atualizarCapa();

  const { metros } = totais();
  const ref = montanhaRef();
  // os desenhos (e as bibliotecas do globo e do mapa) só carregam quando chegam perto da tela
  quandoVisivel($("#viz-atividades"), (el) => muro(el, { atividades: A, corDe: corGrupo, nomeDe: nomeGrupo }));
  quandoVisivel($("#viz-distancia"), (el) =>
    globoVoltas(el, {
      voltas: metros / 1000 / VOLTA_TERRA_KM,
      rotulo: t("Globo com o pedaço da volta na Terra já percorrido: {feito} de {total} km", { feito: dist(metros, 0), total: num(VOLTA_TERRA_KM) }),
    }),
  );
  quandoVisivel($("#viz-horas"), (el) => globoOrbita(el, { rotulo: t("Globo com a órbita da Estação Espacial Internacional") }));
  quandoVisivel($("#viz-subida"), (el) => {
    mapaMontanha = montanha(el, { ...ref, rotulo: t("Mapa de relevo do {nome}, com {m} m de altitude", { nome: tr(ref.nome), m: num(ref.altura_m) }) });
  });
  if (temContagem) contagemRegressiva($("#relogio-prova"), new Date(PLANO.prova.data));
}

function quandoVisivel(el, fazer) {
  if (!el) return;
  if (!("IntersectionObserver" in window)) return fazer(el);
  const obs = new IntersectionObserver(
    (itens) => {
      if (itens.some((i) => i.isIntersecting)) {
        obs.disconnect();
        fazer(el);
      }
    },
    { rootMargin: "300px" },
  );
  obs.observe(el);
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
    const c = $(".comparacao", $(`#persp-${id}`) || el);
    c.innerHTML = comparacao;
    if (dica) {
      c.dataset.dica = dica;
      c.tabIndex = 0;
    }
  };
  const info = t("Todas as atividades públicas no Strava desde {data}, de todos os esportes. Os quilômetros, as horas e a subida também somam tudo.", { data: dataLonga(A[0].data) });
  preencher(
    "atividades",
    num(A.length),
    `${t("Atividades")} <button type="button" class="info" data-dica="${esc(info)}" aria-label="${esc(info)}">i</button>`,
    descanso === 1
      ? t("{b} dia de descanso em {ano}", { b: `<b>${num(descanso)}</b>`, ano })
      : t("{b} dias de descanso em {ano}", { b: `<b>${num(descanso)}</b>`, ano }),
  );
  preencher(
    "distancia",
    num(distValor(metros)),
    mi ? t("Milhas") : t("Quilômetros"),
    voltas < 1
      ? t("{b} de uma volta na Terra", { b: `<b>${num(voltas * 100)}%</b>` })
      : t("{b} voltas na Terra", { b: `<b>${num(voltas, 2)}</b>` }),
    t("A volta na Terra, pela linha do Equador, tem {km} km.", { km: num(VOLTA_TERRA_KM) }),
  );
  preencher(
    "horas",
    num(horas),
    t("Horas"),
    t("{b} órbitas da ISS ao redor da Terra", { b: `<b>${num(orbitas)}</b>` }),
    t("A Estação Espacial Internacional dá uma volta na Terra a cada {min} minutos.", { min: num(MINUTOS_ORBITA_ISS, 1) }),
  );
  preencher(
    "subida",
    num(mi ? subida * 3.28084 : subida),
    mi ? t("Pés de subida") : t("Metros de subida"),
    `<b>${num(montanhas, 1)}</b> ${esc(tr(montanhas >= 2 ? ref.plural : ref.nome))}, ${esc(tr(ref.detalhe))}`,
    t("{nome}: {m} m de altitude.", { nome: tr(ref.nome), m: num(ref.altura_m) }),
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
  const local = tr(P.assinatura?.local) ?? [S.casa?.cidade, S.casa?.estado].filter(Boolean).join(", ");
  if (!nome) return "";
  return `<footer class="assinatura"><div><strong>${esc(nome)}</strong>${local ? `<span>${esc(local)}</span>` : ""}</div><span>${new Date().getFullYear()}</span></footer>`;
}

function sobre() {
  const paragrafos = (tr(P.sobre) || []).filter(Boolean);
  if (!paragrafos.length) return $("#sobre").remove();
  $("#texto-sobre").innerHTML = paragrafos.map(paragrafo).join("") + assinatura();
  $("#sobre .secao-cabeca")?.insertAdjacentHTML("beforeend", ficha());
}

// uma ficha curta: desde quando, onde treina, os melhores tempos e as provas
function ficha() {
  const itens = [];
  const primeira = A[0]?.data;
  if (primeira) itens.push([t("No Strava desde"), `${MESES_CURTOS[primeira.getMonth()]} ${primeira.getFullYear()}`]);
  if (S.casa?.cidade) itens.push([t("Treina em"), S.casa.cidade]);
  const recs = recordesComProvas();
  for (const nome of ["5K", "10K", "Half-Marathon", "Marathon"]) {
    const r = recs.find((x) => x.nome === nome && x.top?.length);
    if (r) itens.push([t("Melhor {d}", { d: (NOMES_ESFORCO[nome] || nome).toLowerCase() }), relogio(r.top[0].t)]);
  }
  const provas = A.filter((a) => a.prova).length;
  if (provas) itens.push([t("Provas corridas"), num(provas)]);
  for (const extra of P.ficha || []) if (extra?.rotulo && extra?.valor) itens.push([tr(extra.rotulo), tr(extra.valor)]);
  return `<dl class="ficha">${itens.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join("")}</dl>`;
}

// ----------------------------------------------------------- provas alvo
// o calendário da temporada; a prova A é a principal (a do plano)
const nomePrioridade = (p) => ({ A: t("prioridade|Principal"), B: t("prioridade|Secundária"), C: t("prioridade|Treino") })[p] || p;
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtMesAno = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });

// prova ainda sem data: "previsao" pode ser um mês ("2027-07"), um semestre ("2027-S2") ou só o ano ("2027")
function periodoPrevisto(prev) {
  const texto = String(prev || "").trim();
  let m = /^(\d{4})-(\d{2})$/.exec(texto);
  if (m) {
    const ini = new Date(+m[1], +m[2] - 1, 1);
    const nome = fmtMesAno.format(ini);
    return { ini, fim: new Date(+m[1], +m[2], 1), texto: nome.charAt(0).toLocaleUpperCase(LOCALE) + nome.slice(1), mes: true };
  }
  m = /^(\d{4})-S([12])$/i.exec(texto);
  if (m) {
    const primeiro = m[2] === "1";
    return {
      ini: new Date(+m[1], primeiro ? 0 : 6, 1),
      fim: new Date(+m[1], primeiro ? 6 : 12, 1),
      texto: primeiro ? t("1º semestre de {ano}", { ano: m[1] }) : t("2º semestre de {ano}", { ano: m[1] }),
    };
  }
  m = /^(\d{4})$/.exec(texto);
  if (m) return { ini: new Date(+m[1], 0, 1), fim: new Date(+m[1] + 1, 0, 1), texto: m[1] };
  return null;
}

// as edições anteriores, pelos treinos marcados como prova cujo nome bate com "busca"
function edicoes(p) {
  if (!p.busca) return [];
  let re;
  try {
    re = new RegExp(semAcento(p.busca), "i");
  } catch {
    return [];
  }
  return A.filter((a) => a.prova && a.grupo === "corrida" && re.test(semAcento(a.n))).sort((x, y) => x.data - y.data);
}

function alvos() {
  const sec = $("#alvos");
  if (!sec) return;
  const lista = (P.provas_alvo || [])
    .filter((p) => p?.nome && (p.data || periodoPrevisto(p.previsao)))
    .map((p) => {
      const prev = p.data ? null : periodoPrevisto(p.previsao);
      // sem data, a prova fica no meio do período previsto (só para a ordem e a linha do tempo)
      const quando = prev ? new Date((prev.ini.getTime() + prev.fim.getTime()) / 2) : new Date(p.data.length <= 10 ? `${p.data}T12:00` : p.data);
      return { ...p, prev, quando, prio: String(p.prioridade || "").toUpperCase(), hist: edicoes(p) };
    })
    .sort((x, y) => x.quando - y.quando);
  if (!lista.length) return sec.remove();
  const agora = new Date();
  const hoje0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const aindaVem = (p) => (p.prev ? p.prev.fim > hoje0 : dia0(p.quando) >= hoje0);
  const futuras = lista.filter(aindaVem);
  const passadas = lista.filter((p) => !aindaVem(p)).reverse();
  const distancia = (p) => (p.distancia_km ? dist(p.distancia_km * 1000, p.distancia_km % 1 ? 1 : 0) : tr(p.distancia) || "");
  const quandoTexto = (p) => (p.prev ? p.prev.texto : dataLonga(p.quando));

  // linha do tempo: de hoje até a última prova com data ou mês previsto (as de semestre ficam só nos cartões)
  const naLinha = futuras.filter((p) => !p.prev || p.prev.mes);
  const ultima = naLinha.at(-1);
  const posicao = (p) => Math.min(100, Math.max(0, ultima.quando > hoje0 ? ((p.quando - hoje0) / (ultima.quando - hoje0)) * 100 : 100));
  // marcos a menos de 32 px um do outro: o seguinte sobe um degrau, para os dois aparecerem
  const larguraTrilho = Math.max(120, ($("#lista-alvos").clientWidth || 900) - 230);
  let anterior = -Infinity;
  let degrau = 0;
  for (const p of naLinha) {
    const pos = posicao(p);
    degrau = ((pos - anterior) / 100) * larguraTrilho < 32 ? 1 - degrau : 0;
    p.acima = degrau === 1;
    anterior = pos;
  }
  const linha = naLinha.length
    ? `<div class="linha-alvos${naLinha.some((p) => p.acima) ? " com-degrau" : ""}">
        <span class="ponta">${t("Hoje")}</span>
        <div class="trilho-alvos" role="img" aria-label="${esc(t("Linha do tempo das próximas provas"))}">${naLinha
          .map((p) => {
            const dica = `${tr(p.nome)}\n${quandoTexto(p)}${p.prev ? ` (${t("data a confirmar")})` : ""}`;
            return `<i class="marco prio-${esc(p.prio || "B")}${p.prev ? " aprox" : ""}${p.acima ? " acima" : ""}" style="left:${posicao(p).toFixed(2)}%" data-dica="${esc(dica)}">${esc(p.prio)}</i>`;
          })
          .join("")}</div>
        <span class="ponta">${esc(quandoTexto(ultima))}</span>
      </div>`
    : "";

  const cartao = (p) => {
    const n = Math.round((dia0(p.quando) - hoje0) / 864e5);
    const meta = tr(p.meta);
    const ultimaVez = p.hist.at(-1);
    // sem distância no perfil, vale a da última edição
    const d = distancia(p) || (ultimaVez ? `≈ ${dist(ultimaVez.m, 1)}` : "");
    const temPlano = p.plano && PLANO?.semanas?.length;
    const faltam = p.prev ? t("Data a confirmar") : n === 0 ? t("É hoje") : plural(n, "em {n} dia", "em {n} dias");
    const quando = p.prev ? p.prev.texto : `${diaSemana(p.quando)}, ${dataLonga(p.quando)}`;
    const historico = p.hist.length
      ? `<div class="historico-alvo"><p>${t("Suas edições")}</p><ol>${p.hist
          .slice(-4)
          .map((a) => `<li><a href="${linkTreino(a.id)}"><span>${a.ano}</span><b>${relogio(a.e || a.s)}</b><small>${esc(dist(a.m, 1))}</small></a></li>`)
          .join("")}</ol></div>`
      : "";
    return `<li class="alvo${p.prio === "A" ? " principal" : ""}">
      <div class="alvo-topo">
        ${p.prio ? `<span class="selo-prio"><b>${esc(p.prio)}</b>${esc(nomePrioridade(p.prio))}</span>` : "<span></span>"}
        <span class="faltam">${faltam}</span>
      </div>
      <h3>${esc(tr(p.nome))}</h3>
      <p class="quando">${esc(quando)}${p.cidade ? `, ${esc(tr(p.cidade))}` : ""}</p>
      ${d || meta ? `<dl>${d ? `<div><dt>${t("Distância")}</dt><dd>${esc(d)}</dd></div>` : ""}${meta ? `<div><dt>${t("Meta")}</dt><dd>${esc(meta)}</dd></div>` : ""}</dl>` : ""}
      ${p.nota ? `<p class="nota-alvo">${esc(tr(p.nota))}</p>` : ""}
      ${historico}
      <div class="acoes">
        ${temPlano ? `<a href="plano.html">${t("Ver o plano de treino")}</a>` : ""}
        ${/^https?:\/\//.test(p.link || "") ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">${t("Página da prova")}</a>` : ""}
      </div>
    </li>`;
  };

  // as que já passaram: o tempo vem do treino do Strava no mesmo dia, com distância parecida;
  // numa prova que estava sem data, vale a edição encontrada dentro do período previsto
  const resultado = (p) => {
    if (p.prev) return p.hist.find((a) => a.data >= p.prev.ini && a.data < p.prev.fim);
    const dia = chaveDia(p.quando);
    const alvo = (p.distancia_km || 0) * 1000;
    return A.find((a) => a.dia === dia && a.grupo === "corrida" && (!alvo || Math.abs(a.m - alvo) / alvo < 0.15));
  };
  const jaCorridas = passadas.length
    ? `<div class="alvos-passadas"><h3 class="bloco-titulo">${t("Já corridas")}</h3><ul class="lista-provas">${passadas
        .map((p) => {
          const a = resultado(p);
          return `<li><span class="nome">${a ? `<a href="${linkTreino(a.id)}">${esc(tr(p.nome))}</a>` : esc(tr(p.nome))}</span>
            <span class="info">${a ? dataLonga(a.data) : esc(quandoTexto(p))}${p.prio ? `, ${esc(nomePrioridade(p.prio)).toLowerCase()}` : ""}</span>
            <span class="tempo">${a ? relogio(a.e || a.s) : "–"}</span></li>`;
        })
        .join("")}</ul></div>`
    : "";

  $("#lista-alvos").innerHTML = `${linha}${futuras.length ? `<ol class="alvos">${futuras.map(cartao).join("")}</ol>` : ""}${jaCorridas}`;
}

// --------------------------------------------------------------- recordes
// Numa prova de meia ou maratona, o GPS costuma medir um pouco menos que a distância oficial,
// e aí o Strava não registra o "melhor esforço". Aqui o tempo da prova também conta.
const DISTANCIAS_OFICIAIS = { "Half-Marathon": [21097.5, 20800, 21400], Marathon: [42195, 41700, 42800] };

function recordesComProvas() {
  const lista = (S.recordes || []).map((r) => ({ ...r, top: [...(r.top || [])], por_ano: { ...(r.por_ano || {}) } }));
  for (const [nome, [oficial, minimo, maximo]] of Object.entries(DISTANCIAS_OFICIAIS)) {
    const provas = A.filter((a) => a.prova && a.grupo === "corrida" && a.m >= minimo && a.m <= maximo);
    if (!provas.length) continue;
    let r = lista.find((x) => x.nome === nome);
    if (!r) lista.push((r = { nome, dist: oficial, top: [], por_ano: {} }));
    for (const a of provas) {
      const tempo = a.e || a.s;
      const mesmo = r.top.find((x) => x.id === a.id);
      if (mesmo) {
        mesmo.oficial = true;
        continue;
      }
      r.top.push({ t: tempo, id: a.id, d: a.dia, n: a.n, oficial: true });
      const ano = String(a.ano);
      if (!r.por_ano[ano] || tempo < r.por_ano[ano]) r.por_ano[ano] = tempo;
    }
    r.top.sort((x, y) => x.t - y.t);
    r.por_ano = Object.fromEntries(Object.entries(r.por_ano).sort());
  }
  return lista.sort((x, y) => x.dist - y.dist);
}

function recordes() {
  // as distâncias em milhas só aparecem para quem escolheu milhas
  const lista = recordesComProvas().filter((r) => ESFORCOS_PRINCIPAIS.includes(r.nome) && r.top?.length && (getUnidade() === "mi" || !/mile/.test(r.nome)));
  const corridas = A.filter((a) => a.grupo === "corrida").length;
  const corpo = $("#tabela-recordes");
  if (!lista.length) {
    corpo.innerHTML = `<p class="vazio">${t("Os recordes aparecem quando os detalhes das corridas forem baixados do Strava.")}</p>`;
  } else {
    corpo.innerHTML = `<div class="tabela-rolagem"><table class="resultados recordes">
      <thead><tr><th>${t("Distância")}</th><th class="num">${t("Tempo")}</th><th class="num">${t("Pace")}</th><th>${t("Quando")}</th><th class="so-largo">${t("Evolução por ano")}</th></tr></thead>
      <tbody>${lista
        .map((r) => {
          const m = r.top[0];
          const anos = Object.values(r.por_ano);
          return `<tr class="clicavel" data-id="${m.id}">
            <td><b>${esc(NOMES_ESFORCO[r.nome] || r.nome)}</b></td>
            <td class="num"><span class="tempo">${relogio(m.t)}</span></td>
            <td class="num">${pace(r.dist, m.t)}</td>
            <td class="treino-rec"><a href="${linkTreino(m.id)}">${esc(m.n)}</a>${m.oficial ? `<span class="selo-pr" style="background:var(--vermelho);color:var(--sobre-destaque)">${t("prova")}</span>` : ""}<div class="secundario">${dataLonga(new Date(`${m.d}T12:00`))}</div></td>
            <td class="so-largo" data-dica="${esc(Object.entries(r.por_ano).map(([a, t]) => `${a}: ${relogio(t)}`).join("\n"))}">${miniLinha(anos)}</td>
          </tr>`;
        })
        .join("")}</tbody></table></div>
      <p class="secundario" style="color:var(--texto-3);font-size:.8125rem;margin:.75rem 0 0">${t("Melhores trechos dentro de qualquer corrida, medidos pelo Strava.")} ${t("Na meia maratona e na maratona, o tempo das provas também conta, mesmo quando o GPS marcou um pouco menos.")}${S.detalhados < corridas ? ` ${t("Ainda faltam detalhes de algumas corridas antigas: eles chegam aos poucos a cada sincronização.")}` : ""}</p>`;
    corpo.querySelector("tbody").onclick = (ev) => {
      const tr = ev.target.closest("tr[data-id]");
      if (tr && !ev.target.closest("a")) location.href = linkTreino(tr.dataset.id);
    };
  }

  // provas: as do perfil.json + as marcadas como prova no Strava
  const manuais = (P.provas || []).filter((p) => p.nome).map((p) => ({ ...p, nome: tr(p.nome), nota: tr(p.nota), distancia: tr(p.distancia), data: new Date(`${p.data}T12:00`), manual: true }));
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
        .join("")}</ul>${provas.length > 7 ? `<button class="mais" id="provas-todas" type="button">${estado.provasTodas ? t("Mostrar menos") : t("Mostrar as {n} provas", { n: num(provas.length) })}</button>` : ""}`
    : `<p class="vazio">${t("Marque suas provas no Strava (tipo de corrida: prova) ou liste-as em config/perfil.json.")}</p>`;
  const botao = $("#provas-todas");
  if (botao) botao.onclick = () => { estado.provasTodas = !estado.provasTodas; recordes(); };

  conquistas();
}

function conquistas() {
  const corridas = A.filter((a) => a.grupo === PRINCIPAL);
  const itens = [];
  const longo = corridas.reduce((x, a) => (a.m > (x?.m || 0) ? a : x), null);
  if (longo) itens.push([dist(longo.m), t("Treino mais longo"), t("{nome}, em {data}.", { nome: longo.n, data: dataLonga(longo.data) }), longo.id]);

  const porSemana = new Map();
  const porMes = new Map();
  for (const a of corridas) {
    const s = chaveDia(inicioSemana(a.data));
    porSemana.set(s, (porSemana.get(s) || 0) + a.m);
    const m = `${a.ano}-${a.data.getMonth()}`;
    porMes.set(m, (porMes.get(m) || 0) + a.m);
  }
  const [semana, mS] = [...porSemana].sort((x, y) => y[1] - x[1])[0] || [];
  if (semana) itens.push([dist(mS, 0), t("Semana mais forte"), t("Começou em {data}.", { data: dataLonga(new Date(`${semana}T12:00`)) })]);
  const [mes, mM] = [...porMes].sort((x, y) => y[1] - x[1])[0] || [];
  if (mes) {
    const [ano, mi] = mes.split("-").map(Number);
    itens.push([dist(mM, 0), t("Mês mais forte"), t("{mes} de {ano}.", { mes: MESES_CURTOS[mi], ano })]);
  }
  if (PRINCIPAL === "corrida") {
    const maratonas = corridas.filter((a) => a.m >= 42000).length;
    const meias = corridas.filter((a) => a.m >= 21000 && a.m < 42000).length;
    if (maratonas) itens.push([num(maratonas), maratonas === 1 ? t("Corrida de 42 km ou mais") : t("Corridas de 42 km ou mais"), t("Provas e treinos do tamanho de uma maratona.")]);
    if (meias) itens.push([num(meias), t("Corridas de 21 a 42 km"), t("Pelo menos uma meia maratona em cada uma.")]);
  }
  const cedo = A.filter((a) => a.data.getHours() < 6).length;
  if (cedo) itens.push([num(cedo), t("Antes das 6h"), t("Treinos que começaram com o dia ainda escuro.")]);
  const kudos = soma(A, (a) => a.k);
  if (kudos) itens.push([num(kudos), t("Kudos recebidos"), t("Cada um conta.")]);

  const manuais = (P.conquistas || []).filter((c) => c.titulo);
  $("#conquistas").innerHTML =
    itens
      .map(([v, t, txt, id]) => `<div class="conquista"><strong>${esc(v)}</strong><span class="titulo">${id ? `<a href="${linkTreino(id)}">${esc(t)}</a>` : esc(t)}</span><p>${esc(txt)}</p></div>`)
      .join("") +
    manuais.map((c) => `<div class="conquista manual"><strong>${esc(tr(c.titulo))}</strong><p>${esc(tr(c.texto) || "")}</p></div>`).join("");
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
    { valor: "semana", rotulo: t("Esta semana") }, { valor: "passada", rotulo: t("Semana passada") }, { valor: "mes", rotulo: t("Este mês") },
    { valor: "60", rotulo: t("Últimos 60 dias") }, { valor: "ano", rotulo: t("Este ano") },
  ];
  abas($("#abas-recentes"), opcoes, estado.periodo, (v) => { estado.periodo = v; estado.recentesMostrar = 8; recentes(); });
  const [ini, fim] = periodo(estado.periodo);
  const lista = A.filter((a) => a.data >= ini && (!fim || a.data < fim)).reverse();

  const visiveis = lista.slice(0, estado.recentesMostrar);
  $("#lista-recentes").innerHTML = lista.length
    ? `<ul class="lista-treinos">${visiveis.map(itemTreino).join("")}</ul>${lista.length > visiveis.length ? `<button class="mais" type="button" id="mais-recentes">${t("Mostrar mais {n}", { n: Math.min(8, lista.length - visiveis.length) })}</button>` : ""}`
    : `<p class="vazio">${t("Nenhum treino neste período ainda.")} ${estado.periodo === "semana" ? t("A semana começa na segunda.") : ""}</p>`;
  const mais = $("#mais-recentes");
  if (mais) mais.onclick = () => { estado.recentesMostrar += 8; recentes(); };

  const porGrupo = {};
  for (const a of lista) porGrupo[a.grupo] = (porGrupo[a.grupo] || 0) + a.s;
  const tempo = soma(lista, (a) => a.s);
  const fatias = Object.entries(porGrupo).sort((x, y) => y[1] - x[1]).map(([g, s]) => ({
    rotulo: GRUPOS[g].nome, valor: s, cor: corGrupo(g), dica: `${GRUPOS[g].nome}\n${duracao(s)}`,
  }));
  $("#resumo-recentes").innerHTML = `
    <dl><div><dt>${t("Treinos")}</dt><dd>${num(lista.length)}</dd></div><div><dt>${t("Distância")}</dt><dd>${dist(soma(lista, (a) => a.m), 0)}</dd></div><div><dt>${t("Tempo")}</dt><dd>${duracao(tempo)}</dd></div></dl>
    <h3 class="bloco-titulo" style="font-size:1rem">${t("Tempo por esporte")}</h3>
    <div class="rosca-area"><div id="rosca-recentes"></div><ul class="legenda">${fatias
      .map((f) => `<li><i style="background:${f.cor}"></i><span>${esc(f.rotulo)}</span><span>${duracao(f.valor)}, ${num((f.valor / tempo) * 100)}%</span></li>`)
      .join("") || `<li style="grid-template-columns:1fr;color:var(--texto-3)">${t("Sem treinos no período.")}</li>`}</ul></div>`;
  rosca($("#rosca-recentes"), { fatias, centro: [duracao(tempo), t("no total")], rotulo: t("Tempo por esporte no período") });
}

function itemTreino(a) {
  const medida = a.m ? dist(a.m) : duracao(a.s);
  const complemento = a.m ? `${duracao(a.s)}, ${ritmo(a)}` : nomeTipo(a.t);
  return `<li><a href="${linkTreino(a.id)}">
    <span class="cor" style="background:${corGrupo(a.grupo)}"></span>
    <span class="nome">${esc(a.n)}${a.prova ? `<span class="selo-pr" style="background:var(--vermelho);color:var(--sobre-destaque)">${t("prova")}</span>` : ""}</span>
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
    longos: { rotulo: t("Mais longos"), lista: () => [...principal].sort((x, y) => y.m - x.m), valor: (a) => ritmo(a), col: PRINCIPAL === "pedal" ? t("Velocidade") : t("Ritmo") },
    rapidos: { rotulo: t("Mais rápidos"), lista: () => principal.filter((a) => a.m >= minimoRapido && !a.in).sort((x, y) => x.s / x.m - y.s / y.m), valor: (a) => ritmo(a), col: PRINCIPAL === "pedal" ? t("Velocidade") : t("Ritmo") },
    subida: { rotulo: t("Mais subida"), lista: () => [...principal].sort((x, y) => y.el - x.el), valor: (a) => elev(a.el), col: t("Subida") },
    provas: { rotulo: t("Provas"), lista: () => A.filter((a) => a.prova).sort((x, y) => y.data - x.data), valor: (a) => ritmo(a), col: t("Ritmo") },
    kudos: { rotulo: t("Mais kudos"), lista: () => A.filter((a) => a.k).sort((x, y) => y.k - x.k), valor: (a) => `${num(a.k)} kudos`, col: "Kudos" },
    quentes: { rotulo: t("Mais quentes"), lista: () => [...comClima].sort((x, y) => y.cl[0] - x.cl[0]), valor: (a) => `${num1(a.cl[0])} °C`, col: t("Temperatura") },
    frios: { rotulo: t("Mais frios"), lista: () => [...comClima].sort((x, y) => x.cl[0] - y.cl[0]), valor: (a) => `${num1(a.cl[0])} °C`, col: t("Temperatura") },
  };
  if (!comClima.length) { delete categorias.quentes; delete categorias.frios; }
  if (!A.some((a) => a.prova)) delete categorias.provas;
  if (!categorias[estado.destaque]) estado.destaque = "longos";
  abas($("#abas-destaques"), Object.entries(categorias).map(([valor, c]) => ({ valor, rotulo: c.rotulo })), estado.destaque, (v) => { estado.destaque = v; destaques(); });
  const cat = categorias[estado.destaque];
  const top = cat.lista().slice(0, 10);
  $("#tabela-destaques").innerHTML = top.length
    ? `<ol class="mosaico-rotas">${top
        .map((a, i) => {
          const rota = ROTAS.get(a.id);
          const cidade = a.l != null && S.lugares[a.l] ? `, ${esc(S.lugares[a.l].cidade)}` : "";
          return `<li><a href="${linkTreino(a.id)}">
            <span class="desenho">${rota ? miniRota(rota) : `<span class="sem-rota">${esc(nomeTipo(a.t))}</span>`}</span>
            <span class="posicao">${i + 1}</span>
            <span class="nome">${esc(a.n)}</span>
            <span class="quando">${dataLonga(a.data)}${cidade}</span>
            <span class="medidas"><b>${esc(dist(a.m))}</b><span>${relogio(a.s)}</span><span>${esc(cat.valor(a))}</span></span>
          </a></li>`;
        })
        .join("")}</ol>`
    : `<p class="vazio">${t("Nenhum treino nesta categoria.")}</p>`;
}

// o desenho de uma ou mais rotas encaixado num quadrado (a longitude é corrigida pela latitude)
function desenhoRotas(textos) {
  const linhas = textos.flatMap(trechosRota);
  if (!linhas.length) return "";
  const k = Math.cos((linhas[0][0][0] * Math.PI) / 180);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const proj = linhas.map((pts) =>
    pts.map(([lat, lng]) => {
      const x = lng * k, y = -lat;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      return [x, y];
    }),
  );
  const w = x1 - x0 || 1e-9, h = y1 - y0 || 1e-9;
  const e = 100 / Math.max(w, h);
  const dx = (100 - w * e) / 2, dy = (100 - h * e) / 2;
  const d = proj.map((pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${(dx + (x - x0) * e).toFixed(1)} ${(dy + (y - y0) * e).toFixed(1)}`).join("")).join("");
  return `<svg viewBox="-6 -6 112 112" aria-hidden="true"><path d="${d}"/></svg>`;
}

const miniRota = (texto) => desenhoRotas([texto]);

// ---------------------------------------------------------------- números
function numeros() {
  const presentes = Object.keys(GRUPOS).filter((g) => A.some((a) => a.grupo === g));
  const opcoes = [{ valor: "tudo", rotulo: t("Tudo") }, ...presentes.map((g) => ({ valor: g, rotulo: GRUPOS[g].nome, cor: corGrupo(g) }))];
  abas($("#abas-numeros"), opcoes, estado.grupoNumeros, (v) => { estado.grupoNumeros = v; numeros(); });
  const g = estado.grupoNumeros;
  const L = doGrupo(g);
  const porDistancia = soma(L, (a) => a.m) > 0;
  const medida = (a) => (porDistancia ? distValor(a.m) : a.s / 3600);
  const fmtMedida = (v) => (porDistancia ? `${num(v)} ${rotuloDist()}` : `${num1(v)} h`);
  const unidadeEixo = porDistancia ? rotuloDist() : "h";

  const caixas = [];
  const caixa = (id, titulo, nota, largo = false) => caixas.push(`<div class="cartao-grafico${largo ? " largo" : ""}"><h3>${esc(titulo)}</h3><p class="nota">${esc(nota)}</p><div class="grafico" id="${id}"></div></div>`);
  caixa("g-anos", porDistancia ? t("Distância por ano") : t("Horas por ano"), t("{grupo}, em {unidade}.", { grupo: nomeGrupo(g), unidade: unidadeEixo }), true);
  caixa("g-horas", t("Que horas eu começo"), t("Quantidade de treinos por hora de início."));
  caixa("g-semana", t("Dia da semana"), porDistancia ? t("Distância média por treino, em {unidade}.", { unidade: unidadeEixo }) : t("Quantidade de treinos."));
  if (porDistancia) caixa("g-distancias", t("Tamanho dos treinos"), t("Quantos treinos em cada faixa de distância."));
  const comFC = L.filter((a) => a.hr);
  if (comFC.length) caixa("g-zonas", t("Zonas de frequência cardíaca"), t("Tempo em cada zona, pela FC média de cada treino."));
  const corridas = L.filter((a) => a.grupo === "corrida" && a.m >= 1000 && a.s);
  if (g === "corrida" && corridas.some((a) => a.hr)) caixa("g-pace-fc", t("Ritmo e frequência cardíaca"), t("Cada ponto é uma corrida. Mais à direita, mais rápido."));
  if ((g === "corrida" || g === "pedal") && L.length) caixa("g-ritmos", g === "corrida" ? t("Ritmos mais comuns") : t("Velocidades mais comuns"), t("Quantos treinos em cada faixa."));
  caixa("g-ambiente", t("Na rua ou dentro de casa"), t("Esteira, rolo e academia contam como dentro."));
  const aparelhos = L.filter((a) => a.ap);
  if (aparelhos.length) caixa("g-aparelhos", t("Aparelhos"), t("O que registrou os treinos."));
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
    dados: Object.entries(anos).map(([ano, x]) => ({ rotulo: ano, valor: x.v, dica: `${ano}\n${t("{v} em {treinos}", { v: fmtMedida(x.v), treinos: nTreinos(x.n) })}` })),
    mostrarValores: true, fmtValor: (v) => num(v), altura: 240, rotulo: t("Volume por ano"),
  });

  // horário
  const horas = Array(24).fill(0);
  for (const a of L) horas[a.data.getHours()]++;
  barras($("#g-horas"), {
    dados: horas.map((n, h) => ({ rotulo: `${h}h`, valor: n, dica: `${t("{a}h às {b}h", { a: h, b: h + 1 })}\n${nTreinos(n)}` })),
    rotuloCada: 3, rotulo: t("Treinos por hora de início"),
  });

  // dia da semana
  const dias = Array.from({ length: 7 }, () => ({ v: 0, n: 0 }));
  for (const a of L) {
    const d = (a.data.getDay() + 6) % 7;
    dias[d].v += medida(a);
    dias[d].n++;
  }
  const nomesDias = DIAS_LONGOS;
  barras($("#g-semana"), {
    dados: dias.map((x, i) => ({
      rotulo: DIAS_CURTOS[i], valor: porDistancia ? (x.n ? x.v / x.n : 0) : x.n,
      dica: `${nomesDias[i]}\n${nTreinos(x.n)}${porDistancia && x.n ? t(", média de {v}", { v: fmtMedida(x.v / x.n) }) : ""}`,
    })),
    mostrarValores: true, fmtValor: (v) => (porDistancia ? num1(v) : num(v)), rotulo: t("Treinos por dia da semana"),
  });

  // tamanhos
  if (porDistancia) {
    const km = L.filter((a) => a.m > 0).map((a) => distValor(a.m));
    const limites = g === "corrida" ? [0, 5, 10, 15, 21, 30, 42] : g === "pedal" ? [0, 20, 40, 60, 80, 100, 150] : g === "natacao" ? [0, 1, 2, 3, 4] : autoLimites(km);
    const faixas = limites.map((ini, i) => ({ ini, fim: limites[i + 1] ?? Infinity, n: 0 }));
    for (const v of km) faixas.findLast((f) => v >= f.ini).n++;
    barras($("#g-distancias"), {
      dados: faixas.map((f) => ({ rotulo: f.fim === Infinity ? `${f.ini}+` : `${f.ini}–${f.fim}`, valor: f.n, dica: `${f.fim === Infinity ? t("{v} {u} ou mais", { v: f.ini, u: rotuloDist() }) : t("De {a} a {b} {u}", { a: f.ini, b: f.fim, u: rotuloDist() })}\n${nTreinos(f.n)}` })),
      mostrarValores: true, rotulo: t("Treinos por faixa de distância"),
    });
  }

  // zonas de FC
  if (comFC.length) {
    let zonas = (S.zonas_fc || []).filter((z) => z.max !== 0);
    if (zonas.length < 3) {
      const max = Math.max(...comFC.map((a) => a.hrx || a.hr));
      zonas = [0.6, 0.7, 0.8, 0.9, 2].map((f, i, arr) => ({ min: i ? Math.round(max * arr[i - 1]) : 0, max: f >= 2 ? -1 : Math.round(max * f) }));
    }
    const nomes = [t("zona|Recuperação"), t("zona|Aeróbico"), t("zona|Ritmo"), t("zona|Limiar"), t("zona|Anaeróbico")];
    const tempos = zonas.map(() => 0);
    for (const a of comFC) {
      const i = zonas.findIndex((z) => a.hr >= z.min && (z.max === -1 || a.hr < z.max));
      tempos[i === -1 ? zonas.length - 1 : i] += a.s;
    }
    const total = tempos.reduce((s, v) => s + v, 0);
    barrasH($("#g-zonas"), zonas.map((z, i) => ({
      rotulo: `Z${i + 1} ${nomes[i] || ""}`, valor: tempos[i], texto: `${num((tempos[i] / total) * 100)}%`,
      dica: `${z.max === -1 ? t("acima de {v}", { v: z.min }) : t("{a} a {b}", { a: z.min, b: z.max })} bpm\n${duracao(tempos[i])}`,
      cor: `color-mix(in srgb, var(--destaque) ${35 + i * 16}%, var(--fundo-2))`,
    })));
  }

  // pace x FC
  if ($("#g-pace-fc")) {
    const pontos = corridas.filter((a) => a.hr && !a.in).map((a) => ({
      x: paceSeg(a.m, a.s), y: a.hr, dica: `${a.n}\n${dataLonga(a.data)}\n${pace(a.m, a.s)}, ${a.hr} bpm`,
    }));
    dispersao($("#g-pace-fc"), { pontos, fmtX: (v) => relogio(v), fmtY: (v) => num(v), rotuloX: t("ritmo (min/{u})", { u: rotuloDist() }), rotuloY: "bpm", inverterX: true, rotulo: t("Ritmo e frequência cardíaca") });
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
        dados.push({ rotulo: relogio(p), valor: n, dica: `${t("{a} a {b}", { a: relogio(p), b: relogio(p + passo) })} /${rotuloDist()}\n${plural(n, "{n} corrida", "{n} corridas")}` });
      }
    } else {
      const vs = L.filter((a) => a.m && a.s && !a.in).map((a) => distValor(a.m) / (a.s / 3600));
      dados = [];
      for (let v = 10; v < 45; v += 2.5) {
        const n = vs.filter((x) => x >= v && x < v + 2.5).length;
        if (n || dados.length) dados.push({ rotulo: num(v), valor: n, dica: `${t("{a} a {b}", { a: num1(v), b: num1(v + 2.5) })}\n${plural(n, "{n} pedal", "{n} pedais")}` });
      }
      while (dados.length && !dados.at(-1).valor) dados.pop();
    }
    barras($("#g-ritmos"), { dados, rotuloCada: Math.ceil(dados.length / 8), rotulo: t("Distribuição de ritmo") });
  }

  // ambiente
  const dentro = L.filter((a) => a.in || (!a.ll && !a.m));
  const fora = L.length - dentro.length;
  $("#g-ambiente").innerHTML = `
    <div class="divisao" role="img" aria-label="${esc(t("{p}% na rua", { p: num((fora / L.length) * 100) }))}">
      <i style="flex:${fora};background:var(--destaque)" data-dica="${t("Na rua")}\n${nTreinos(fora)}"></i>
      <i style="flex:${dentro.length};background:var(--linha-forte)" data-dica="${t("Dentro de casa")}\n${nTreinos(dentro.length)}"></i>
    </div>
    <ul class="legenda">
      <li><i style="background:var(--destaque)"></i><span>${t("Na rua")}</span><span>${nTreinos(fora)}, ${num((fora / L.length) * 100)}%</span></li>
      <li><i style="background:var(--linha-forte)"></i><span>${t("Dentro de casa")}</span><span>${nTreinos(dentro.length)}, ${num((dentro.length / L.length) * 100)}%</span></li>
      <li><i style="background:transparent;border:1px solid var(--texto-3)"></i><span>${t("Em grupo")}</span><span>${nTreinos(L.filter((a) => a.pessoas > 1).length)}</span></li>
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
// o ano até agora: quanto já foi, comparado com o mesmo ponto do ano passado,
// a projeção para 31 de dezembro e a meta (ou, sem meta, o total do ano passado)
function anoEmCurso() {
  const el = $("#ano-curso");
  if (!el) return;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const L = A.filter((a) => a.grupo === PRINCIPAL);
  const doAno = (y, ate) => soma(L.filter((a) => a.ano === y && (!ate || a.data <= ate)), (a) => a.m);
  const feito = doAno(ano);
  if (!feito) return (el.hidden = true);
  const inicioAno = new Date(ano, 0, 1);
  const fimAno = new Date(ano + 1, 0, 1);
  const fracao = Math.min(1, (hoje - inicioAno) / (fimAno - inicioAno));
  const projecao = fracao > 0.02 ? feito / fracao : null;
  const mesmaData = new Date(ano - 1, hoje.getMonth(), hoje.getDate(), 23, 59);
  const anterior = doAno(ano - 1, mesmaData);
  const totalAnterior = doAno(ano - 1);
  const metaKm = Number(P.meta_anual_km?.[ano] ?? P.meta_anual_km?.[String(ano)] ?? (typeof P.meta_anual_km === "number" ? P.meta_anual_km : 0));
  const alvo = metaKm ? metaKm * 1000 : totalAnterior;
  const rotuloAlvo = metaKm
    ? t("Meta: {v}", { v: dist(alvo, 0) })
    : totalAnterior
      ? t("Total de {ano}: {v}", { ano: ano - 1, v: dist(alvo, 0) })
      : "";
  const pctReal = alvo ? (feito / alvo) * 100 : 0;
  const pct = Math.min(100, pctReal);
  // o dia em que a soma do ano passou da meta
  let batida = null;
  if (metaKm) {
    let acumulado = 0;
    for (const a of L.filter((x) => x.ano === ano).sort((x, y) => x.data - y.data)) {
      acumulado += a.m;
      if (acumulado >= alvo) {
        batida = a.data;
        break;
      }
    }
  }
  const semanasRestantes = (fimAno - hoje) / (7 * 864e5);
  const esperado = alvo ? Math.min(100, fracao * 100) : null;
  const variacao = anterior ? (feito / anterior - 1) * 100 : null;
  const grupo = GRUPOS[PRINCIPAL].nome.toLowerCase();
  el.hidden = false;
  el.innerHTML = `
    <div class="ano-topo">
      <h3>${t("{ano} até agora", { ano })}</h3>
      <p class="ano-total"><b>${esc(dist(feito, 0))}</b> ${esc(t("de {grupo}", { grupo }))}</p>
    </div>
    ${alvo ? `<div class="barra-ano" role="img" aria-label="${esc(`${num(pct)}% — ${rotuloAlvo}`)}">
      <i class="feito" style="width:${pct.toFixed(1)}%"></i>
      <i class="esperado" style="left:${esperado.toFixed(1)}%" data-dica="${esc(t("Onde a meta pede estar hoje: {v}", { v: dist(alvo * fracao, 0) }))}"></i>
    </div>
    <p class="ano-alvo"><span>${num(Math.floor(pctReal))}%</span><span>${esc(rotuloAlvo)}</span></p>` : ""}
    <ul class="ano-fatos">
      ${batida ? `<li class="meta-batida">${esc(t("Meta batida em {data}.", { data: dataLonga(batida) }))}</li>` : ""}
      ${metaKm && !batida ? `<li>${esc(t("Faltam {v} para a meta.", { v: dist(alvo - feito, 0) }))}${semanasRestantes >= 1 && alvo - feito > alvo * 0.05 ? ` ${esc(t("Dá {v} por semana até o fim do ano.", { v: dist((alvo - feito) / semanasRestantes, 1) }))}` : ""}</li>` : ""}
      ${projecao ? `<li>${esc(t("No ritmo atual, {ano} fecha com {v}.", { ano, v: dist(projecao, 0) }))}</li>` : ""}
      ${variacao != null ? `<li>${esc(variacao >= 0
        ? t("{p}% a mais que no mesmo ponto de {ano} ({v}).", { p: num(Math.abs(variacao)), ano: ano - 1, v: dist(anterior, 0) })
        : t("{p}% a menos que no mesmo ponto de {ano} ({v}).", { p: num(Math.abs(variacao)), ano: ano - 1, v: dist(anterior, 0) }))}</li>` : ""}
    </ul>`;
}

function constancia() {
  anoEmCurso();
  const anos = [...new Set(A.map((a) => a.ano))].sort((x, y) => y - x);
  abas($("#abas-constancia"), [{ valor: "12m", rotulo: t("Últimos 12 meses") }, ...anos.map((a) => ({ valor: String(a), rotulo: String(a) }))], estado.ano, (v) => { estado.ano = v; constancia(); });
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
  calendario($("#calendario"), { inicio: ini, fim, valores, rotulo: t("Calendário de treinos") });

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
    <div><dt>${t("Dias com treino")}</dt><dd>${num(porDia.size)}<small>${t("de {n}", { n: num(totalDias) })}</small></dd></div>
    <div><dt>${t("Dias de descanso")}</dt><dd>${num(((totalDias - porDia.size) / totalDias) * 100)}%</dd></div>
    <div><dt>${t("Maior sequência")}</dt><dd>${num(seq.maior)}<small>${t("dias seguidos")}</small></dd></div>
    <div><dt>${t("Semana mais forte")}</dt><dd>${esc(dist(melhorSemana, 0))}<small>${esc(t("de {grupo}", { grupo: GRUPOS[PRINCIPAL].nome.toLowerCase() }))}</small></dd></div>`;

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
  $("#titulo-mensal").textContent = t("{grupo} por mês", { grupo: GRUPOS[PRINCIPAL].nome });
  barras($("#g-mensal"), {
    dados: meses.map((m) => ({ rotulo: MESES_CURTOS[m.mes], valor: distValor(m.m), dica: `${t("{mes} de {ano}", { mes: MESES_CURTOS[m.mes], ano: m.ano })}\n${t("{v} em {treinos}", { v: dist(m.m), treinos: nTreinos(m.n) })}` })),
    mostrarValores: true, fmtValor: (v) => num(v), altura: 220, rotulo: t("Volume por mês"),
  });
}

// ------------------------------------------------------------------ clima
function clima() {
  const sec = $("#clima");
  const L = A.filter((a) => a.cl);
  if (!L.length) {
    $("#conteudo-clima").innerHTML = `<p class="vazio">${t("O clima de cada treino é calculado depois da sincronização com o Strava.")}</p>`;
    return;
  }
  const chuva = L.filter((a) => a.cl[2] >= 0.3 || (a.cl[1] >= 51 && a.cl[1] < 95) || a.cl[1] >= 95);
  const quente = L.reduce((x, a) => (a.cl[0] > x.cl[0] ? a : x));
  const frio = L.reduce((x, a) => (a.cl[0] < x.cl[0] ? a : x));
  const media = soma(L, (a) => a.cl[0]) / L.length;
  $("#conteudo-clima").innerHTML = `
    <dl class="fatos" style="margin-top:0">
      <div><dt>${t("Treinos com chuva")}</dt><dd>${num(chuva.length)}<small>${t("{p}% dos treinos na rua", { p: num((chuva.length / L.length) * 100) })}</small></dd></div>
      <div><dt>${t("O mais quente")}</dt><dd>${num1(quente.cl[0])} °C</dd><dd style="font:inherit;font-size:.8125rem;color:var(--texto-3)"><a href="${linkTreino(quente.id)}">${esc(quente.n)}</a>, ${dataLonga(quente.data)}</dd></div>
      <div><dt>${t("O mais frio")}</dt><dd>${num1(frio.cl[0])} °C</dd><dd style="font:inherit;font-size:.8125rem;color:var(--texto-3)"><a href="${linkTreino(frio.id)}">${esc(frio.n)}</a>, ${dataLonga(frio.data)}</dd></div>
      <div><dt>${t("Temperatura média")}</dt><dd>${num1(media)} °C</dd></div>
    </dl>
    <div class="grade-graficos">
      <div class="cartao-grafico"><h3>${t("Temperatura na largada")}</h3><p class="nota">${t("Quantos treinos em cada faixa de temperatura.")}</p><div class="grafico" id="g-temperaturas"></div></div>
      <div class="cartao-grafico"><h3>${t("Como estava o céu")}</h3><p class="nota">${t("Pela condição mais fechada durante o treino.")}</p><div class="grafico" id="g-condicoes"></div></div>
    </div>`;
  const faixas = [-Infinity, 0, 5, 10, 15, 20, 25, 30, 35].map((ini, i, arr) => ({ ini, fim: arr[i + 1] ?? Infinity, n: 0 }));
  for (const a of L) faixas.findLast((f) => a.cl[0] >= f.ini).n++;
  while (faixas.length && !faixas[0].n) faixas.shift();
  while (faixas.length && !faixas.at(-1).n) faixas.pop();
  barras($("#g-temperaturas"), {
    dados: faixas.map((f) => ({
      rotulo: f.ini === -Infinity ? `<${f.fim}°` : f.fim === Infinity ? `${f.ini}°+` : `${f.ini}–${f.fim}°`, valor: f.n,
      dica: `${f.ini === -Infinity ? t("abaixo de {v}", { v: f.fim }) : f.fim === Infinity ? t("{v} °C ou mais", { v: f.ini }) : t("{a} a {b} °C", { a: f.ini, b: f.fim })}\n${nTreinos(f.n)}`,
      cor: `color-mix(in srgb, ${f.ini >= 25 ? "var(--destaque)" : f.ini >= 15 ? "var(--neutro)" : "var(--frio)"} 85%, var(--fundo))`,
    })),
    mostrarValores: true, rotulo: t("Treinos por temperatura"),
  });
  const conta = CONDICOES.map(([nome, teste]) => ({ nome, n: L.filter((a) => a.cl[1] != null && teste(a.cl[1])).length })).filter((x) => x.n);
  barrasH($("#g-condicoes"), conta.map((x) => ({ rotulo: x.nome, valor: x.n, texto: num(x.n) })));
  sec.dataset.ok = "1";
}

// ------------------------------------------------------------ equipamento
function equipamento() {
  const lista = (S.equipamento || []).filter((g) => g.m > 0).sort((x, y) => (x.aposentado - y.aposentado) || y.m - x.m);
  if (!lista.length) return $("#equipamento")?.remove();
  // quanto mais quilômetros, mais forte a cor (os aposentados ficam em cinza)
  const maior = Math.max(...lista.map((g) => g.m));
  const forca = (g) => Math.round(30 + 70 * (g.m / maior));
  barrasH($("#lista-equipamento"), lista.map((g) => ({
    rotulo: g.nome,
    extra: `${g.tipo === "bike" ? t("bike") : t("tênis")}${g.aposentado ? t(", aposentado") : g.principal ? t(", o principal") : ""}`,
    valor: g.m, texto: dist(g.m, 0),
    dica: t("{treinos} registrados", { treinos: nTreinos(g.usos) }),
    cor: g.aposentado
      ? "var(--linha-forte)"
      : `color-mix(in oklab, ${g.tipo === "bike" ? "var(--c-pedal)" : "var(--destaque)"} ${forca(g)}%, var(--painel-2))`,
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
  const faixa = $("#geo-faixa");
  const viagens = $("#painel-lugares");
  if (!faixa || !viagens) return;
  const lista = S.lugares || [];
  const porLugar = lista.map((l, i) => ({ ...l, i, pais: nomePais(l), n: 0, m: 0, ids: [], ini: null, fim: null }));
  for (const a of A) {
    const l = a.l != null ? porLugar[a.l] : null;
    if (!l) continue;
    l.n++;
    l.m += a.m;
    l.ids.push(a.id);
    if (!l.ini || a.data < l.ini) l.ini = a.data;
    if (!l.fim || a.data > l.fim) l.fim = a.data;
  }
  const usados = porLugar.filter((l) => l.n).sort((x, y) => y.n - x.n);
  const casa = usados.find((l) => S.casa && l.cidade === S.casa.cidade) || usados[0];
  const fora = usados.filter((l) => l !== casa);
  const paises = new Set(usados.map((l) => l.pais));
  const estados = new Set(usados.map((l) => `${l.estado}|${l.pais}`));
  const treinosFora = fora.reduce((s, l) => s + l.n, 0);
  const longe = A.filter((a) => a.casa != null).reduce((x, a) => (a.casa > (x?.casa ?? -1) ? a : x), null);
  const ir = (l) => `data-lat="${l.lat}" data-lng="${l.lng}"`;

  // a faixa presa ao mapa: onde mais treino e o resumo
  faixa.innerHTML = `
    <div class="geo-linha"><span class="geo-rotulo">${t("Onde mais treino")}</span>
      <ul>${usados
        .slice(0, 4)
        .map((l) => `<li><button type="button" ${ir(l)}><b>${num(l.n)}</b> ${esc(t("em {lugar}", { lugar: [l.cidade, l.pais].join(", ") }))}</button></li>`)
        .join("")}</ul></div>
    <div class="geo-linha"><span class="geo-rotulo">${t("Em resumo")}</span>
      <ul>
        <li>${plural(usados.length, "{n} cidade", "{n} cidades")}</li>
        <li>${paises.size > 1 ? plural(paises.size, "{n} país", "{n} países") : plural(estados.size, "{n} estado", "{n} estados")}</li>
        <li>${plural(treinosFora, "{n} treino fora de casa", "{n} treinos fora de casa")}</li>
        ${longe ? `<li><button type="button" id="ir-longe" title="${esc(`${longe.n}, ${dataLonga(longe.data)}`)}">${esc(t("Mais longe: {d}", { d: `${num(distValor(longe.casa * 1000))} ${rotuloDist()}` }))}</button></li>` : ""}
      </ul></div>`;

  // as viagens, filtradas por estado (um país só) ou por país
  const porPais = paises.size > 1;
  const regiao = (l) => (porPais ? l.pais : l.estado || l.pais);
  const contagem = {};
  for (const l of fora) contagem[regiao(l)] = (contagem[regiao(l)] || 0) + 1;
  if (estado.regiao !== "todos" && !contagem[estado.regiao]) estado.regiao = "todos";
  const filtrados = fora.filter((l) => estado.regiao === "todos" || regiao(l) === estado.regiao);
  const visiveis = estado.viagensTodas ? filtrados : filtrados.slice(0, 8);
  const cartao = (l) => {
    const rotas = l.ids.map((id) => ROTAS.get(id)).filter(Boolean);
    const periodo = l.ini && chaveDia(l.ini) !== chaveDia(l.fim) ? `${dataLonga(l.ini)} – ${dataLonga(l.fim)}` : dataLonga(l.ini);
    return `<li><button type="button" ${ir(l)}>
      <span class="desenho">${rotas.length ? desenhoRotas(rotas) : ""}</span>
      <span class="cidade">${esc(l.cidade)}</span>
      <span class="regiao">${esc([l.estado !== l.cidade ? l.estado : "", l.pais].filter(Boolean).join(", "))}</span>
      <span class="periodo">${periodo}</span>
      <span class="conta"><b>${nTreinos(l.n)}</b>${dist(l.m, 0)}</span>
    </button></li>`;
  };
  viagens.innerHTML = fora.length
    ? `<div class="geo-cabeca"><h3>${t("Por onde passei")}</h3><div class="abas" id="abas-regioes"></div></div>
      <ul class="viagens">${visiveis.map(cartao).join("")}</ul>
      ${filtrados.length > visiveis.length ? `<button class="mais" type="button" id="mais-viagens">${t("Mostrar mais {n}", { n: filtrados.length - visiveis.length })}</button>` : ""}`
    : `<p class="vazio">${esc(t("Todos os treinos até agora foram em {cidade}.", { cidade: casa?.cidade || "" }))}</p>`;
  if (fora.length) {
    abas($("#abas-regioes"), [{ valor: "todos", rotulo: t("Todos ({n})", { n: num(fora.length) }) }, ...Object.entries(contagem).sort((x, y) => y[1] - x[1]).map(([r, n]) => ({ valor: r, rotulo: `${r} (${n})` }))], estado.regiao, (v) => {
      estado.regiao = v;
      estado.viagensTodas = false;
      painelLugares();
    });
  }
  const mais = $("#mais-viagens");
  if (mais) mais.onclick = () => { estado.viagensTodas = true; painelLugares(); };

  // qualquer cidade clicada leva o mapa até ela
  $("#lugares").onclick = (ev) => {
    const b = ev.target.closest("button[data-lat]");
    if (b && mapa) voar([+b.dataset.lat, +b.dataset.lng]);
  };
  const botaoLonge = $("#ir-longe");
  if (botaoLonge) botaoLonge.onclick = () => mapa && voar(longe.ll);
}

function voar(ponto) {
  mapa.flyTo(ponto, 12, { duration: reduzirMovimento() ? 0 : 1.4 });
  $("#mapa").scrollIntoView({ behavior: reduzirMovimento() ? "auto" : "smooth", block: "center" });
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
  const rotas = [...ROTAS];
  const renderer = L.canvas({ padding: 0.3, tolerance: 6 });
  camadaRotas = L.layerGroup().addTo(mapa);
  const cor = corDestaque();
  for (const [id, texto] of rotas) {
    const a = porId.get(id);
    if (!a) continue;
    const linha = L.polyline(trechosRota(texto), { renderer, color: cor, weight: 1.6, opacity: 0.32, interactive: true });
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
    div.innerHTML = `<a href="#" role="button" title="${esc(t("Ver todos os lugares"))}" aria-label="${esc(t("Ver todos os lugares"))}" style="width:auto;padding:0 .6rem;font-size:.8125rem;font-weight:600">${t("Ver tudo")}</a>`;
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
  return `<strong>${esc(a.n)}</strong><br>${dataLonga(a.data)}, ${hora(a.data)}<br>${esc(t("{d} em {t}", { d: dist(a.m), t: relogio(a.s) }))}${a.m ? `, ${esc(ritmo(a))}` : ""}<br><a href="${linkTreino(a.id)}">${t("Abrir o treino")}</a>`;
}
