import {
  $, aoMudarTema, aoMudarUnidade, buscarJSON, corGrupo, dataLonga, decodificarRota, diaSemana, dist, duracao, elev, esc,
  grupoDe, hora, iniciarDicas, linkTreino, montarRodape, montarTopo, nomeCondicao, nomeSite, nomeTipo, nomeTopo, num, num1, pace,
  NOMES_ESFORCO, relogio, ritmo, prepararAtividades, rotuloDist,
} from "./comum.js";
import { barrasH } from "./graficos.js";

iniciarDicas();
const id = new URLSearchParams(location.search).get("id");
let S, P, T, vizinhos;

iniciar();

async function iniciar() {
  try {
    [S, P] = await Promise.all([buscarJSON("data/site.json"), buscarJSON("config/perfil.json", true)]);
  } catch (erro) {
    $("#treino").innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
    return;
  }
  P ||= {};
  montarTopo({ nome: nomeTopo(S, P), links: [["./#recentes", "Recentes"], ["./#destaques", "Destaques"], ["./#numeros", "Números"], ["./#lugares", "Lugares"]] });
  montarRodape(S, P);

  const lista = prepararAtividades(S.atividades);
  const i = lista.findIndex((a) => String(a.id) === id);
  T = id && /^\d+$/.test(id) ? await buscarJSON(`data/atividades/${id}.json`, true) : null;
  if (!T || i === -1) {
    $("#treino").innerHTML = `<a class="voltar" href="./">Voltar para o início</a>
      <section class="secao" style="padding-top:2rem"><h2>Treino não encontrado</h2>
      <p class="sub">Ele pode ter sido apagado, ficado privado no Strava ou ainda não ter sido sincronizado. Os treinos novos aparecem aqui em até 8 horas.</p></section>`;
    return;
  }
  [T] = prepararAtividades([T]);
  vizinhos = [lista[i - 1], lista[i + 1]];
  document.title = `${T.n}: ${nomeSite(S, P)}`;
  desenhar();
  aoMudarUnidade(desenhar);
}

function desenhar() {
  const g = grupoDe(T.t);
  const lugar = T.lugar ? [T.lugar.cidade, T.lugar.pais].filter(Boolean).join(", ") : "";
  const clima = T.clima ? `${num1(T.clima.temp)} °C${nomeCondicao(T.clima.cod) ? `, ${nomeCondicao(T.clima.cod).toLowerCase()}` : ""}${T.clima.chuva >= 0.3 ? `, ${num1(T.clima.chuva)} mm de chuva` : ""}` : "";

  const medidas = [];
  if (T.m) medidas.push(["Distância", dist(T.m, 2)]);
  medidas.push(["Tempo em movimento", relogio(T.s)]);
  if (T.m && T.s) medidas.push([g === "pedal" ? "Velocidade média" : "Ritmo médio", ritmo(T)]);
  if (T.el) medidas.push(["Subida", elev(T.el)]);
  if (T.hr) medidas.push(["FC média", `${T.hr} bpm`]);
  if (T.hrx) medidas.push(["FC máxima", `${T.hrx} bpm`]);
  if (T.cad) medidas.push(["Cadência", g === "corrida" ? `${num(T.cad * 2)} ppm` : `${num(T.cad)} rpm`]);
  if (T.w) medidas.push(["Potência média", `${num(T.w)} W`]);
  if (T.cal) medidas.push(["Calorias", num(T.cal)]);
  if (T.e && T.e - T.s > 60) medidas.push(["Tempo total", relogio(T.e)]);
  if (T.k) medidas.push(["Kudos", num(T.k)]);

  const [ant, prox] = vizinhos;
  $("#treino").innerHTML = `
    <a class="voltar" href="./#recentes">Voltar para o início</a>
    <header class="treino-cabeca">
      <span class="tipo"><i style="background:${corGrupo(g)}"></i>${esc(nomeTipo(T.t))}${T.prova ? ", prova" : ""}${T.pessoas > 1 ? `, com mais ${T.pessoas - 1} ${T.pessoas === 2 ? "pessoa" : "pessoas"}` : ""}</span>
      <h1>${esc(T.n)}</h1>
      <p class="quando">${esc(diaSemana(T.data))}, ${dataLonga(T.data)}, às ${hora(T.data)}${lugar ? `, em ${esc(lugar)}` : ""}${clima ? `. ${esc(clima)}` : ""}.</p>
    </header>
    <dl class="treino-medidas">${medidas.slice(0, 8).map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join("")}</dl>
    <div class="treino-grade">
      <div>
        ${T.rota ? `<div class="mapa" id="mapa-treino" role="region" aria-label="Mapa da rota"></div><p class="secundario" style="color:var(--texto-3);font-size:.8125rem;margin:.5rem 0 0">O começo e o fim da rota ficam escondidos para proteger a privacidade.</p>` : `<p class="vazio">Este treino não tem mapa: foi feito em lugar fechado ou com o GPS desligado.</p>`}
        <a class="ver-strava" href="https://www.strava.com/activities/${encodeURIComponent(T.id)}">View on Strava</a>
      </div>
      <div>
        ${T.parciais?.length > 1 ? `<h3 class="bloco-titulo">Parciais</h3><p class="nota" style="color:var(--texto-3);font-size:.8125rem;margin:-.5rem 0 .9rem">Barra maior, quilômetro mais rápido.</p><div id="parciais"></div>` : ""}
        ${T.esforcos?.length ? `<h3 class="bloco-titulo" style="margin-top:2rem">Melhores trechos</h3><div id="esforcos"></div>` : ""}
      </div>
    </div>
    <nav class="navegacao-treinos" aria-label="Outros treinos">
      ${ant ? `<a href="${linkTreino(ant.id)}"><small>Treino anterior</small>${esc(ant.n)}</a>` : "<span></span>"}
      ${prox ? `<a href="${linkTreino(prox.id)}" style="text-align:right"><small>Próximo treino</small>${esc(prox.n)}</a>` : "<span></span>"}
    </nav>`;

  if (T.parciais?.length > 1) {
    const velocidades = T.parciais.map((p) => p.v || 0);
    const maisRapida = Math.max(...velocidades);
    // a barra começa um pouco abaixo da parcial mais lenta, para as diferenças aparecerem
    const base = Math.min(...velocidades.filter(Boolean)) * 0.92;
    barrasH($("#parciais"), T.parciais.map((p, i) => ({
      rotulo: p.m < 950 ? `Final (${num(p.m)} m)` : `km ${i + 1}`,
      valor: Math.max(0, (p.v || 0) - base),
      texto: g === "pedal" ? `${num1((p.v || 0) * 3.6)} km/h` : pace(p.m, p.s),
      dica: `${p.hr ? `${p.hr} bpm` : "sem FC"}\n${p.el > 0 ? "+" : ""}${num1(p.el)} m de desnível`,
      cor: p.v === maisRapida ? "var(--pr)" : undefined,
    })), { max: maisRapida - base });
  }
  if (T.esforcos?.length) {
    $("#esforcos").innerHTML = `<table class="resultados"><tbody>${T.esforcos
      .map((e) => `<tr><td>${esc(NOMES_ESFORCO[e.nome] || e.nome)}${e.pr === 1 ? '<span class="selo-pr">recorde</span>' : e.pr ? `<span class="selo-pr" style="background:var(--linha-forte);color:var(--texto)">${e.pr}º melhor</span>` : ""}</td>
        <td class="num"><span class="tempo" style="font-size:1.25rem">${relogio(e.t)}</span></td><td class="num secundario">${pace(e.dist, e.t)}</td></tr>`)
      .join("")}</tbody></table>`;
  }
  if (T.rota) desenharMapa();
}

function desenharMapa() {
  if (!window.L) return setTimeout(desenharMapa, 150);
  const L = window.L;
  const pontos = decodificarRota(T.rota);
  const mapa = L.map("mapa-treino", { scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
  }).addTo(mapa);
  const cor = () => getComputedStyle(document.documentElement).getPropertyValue("--destaque-tx").trim();
  const linha = L.polyline(pontos, { color: cor(), weight: 4, opacity: 0.95 }).addTo(mapa);
  const texto = getComputedStyle(document.documentElement).getPropertyValue("--texto").trim();
  L.circleMarker(pontos[0], { radius: 6, color: texto, fillColor: texto, fillOpacity: 1, weight: 2 }).bindTooltip("Início visível").addTo(mapa);
  L.circleMarker(pontos.at(-1), { radius: 6, color: cor(), fillColor: "#fff", fillOpacity: 1, weight: 3 }).bindTooltip("Fim visível").addTo(mapa);
  mapa.fitBounds(linha.getBounds(), { padding: [24, 24] });
  mapa.on("focus", () => mapa.scrollWheelZoom.enable());
  aoMudarTema(() => linha.setStyle({ color: cor() }));
}
