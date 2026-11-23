import {
  $, aoMudarTema, aoMudarUnidade, buscarJSON, corGrupo, dataLonga, diaSemana, dist, duracao, elev, esc, trechosRota,
  grupoDe, hora, iniciarDicas, linkTreino, montarRodape, montarTopo, nomeCondicao, nomeSite, nomeTipo, nomeTopo, num, num1, pace,
  NOMES_ESFORCO, relogio, ritmo, prepararAtividades, rotuloDist, nomePais, plural, t, getUnidade, aoRedimensionar,
} from "./comum.js";
import { barrasH } from "./graficos.js";

iniciarDicas();
const id = new URLSearchParams(location.search).get("id");
let S, P, T, vizinhos, PLANO;

iniciar();

async function iniciar() {
  try {
    [S, P, PLANO] = await Promise.all([buscarJSON("data/site.json"), buscarJSON("config/perfil.json", true), buscarJSON("config/plano.json", true)]);
  } catch (erro) {
    $("#treino").innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
    return;
  }
  P ||= {};
  montarTopo({ nome: nomeTopo(S, P), plano: !!(PLANO?.semanas?.length && !PLANO.rascunho) });
  montarRodape(S, P);

  const lista = prepararAtividades(S.atividades);
  const i = lista.findIndex((a) => String(a.id) === id);
  T = id && /^\d+$/.test(id) ? await buscarJSON(`data/atividades/${id}.json`, true) : null;
  if (!T || i === -1) {
    $("#treino").innerHTML = `<a class="voltar" href="./">${t("Voltar para o início")}</a>
      <section class="secao" style="padding-top:2rem"><h2>${t("Treino não encontrado")}</h2>
      <p class="sub">${t("Ele pode ter sido apagado, ficado privado no Strava ou ainda não ter sido sincronizado. Os treinos novos aparecem aqui poucos minutos depois de salvos no Strava.")}</p></section>`;
    return;
  }
  [T] = prepararAtividades([T]);
  vizinhos = [lista[i - 1], lista[i + 1]];
  document.title = `${T.n}: ${nomeSite(S, P)}`;
  desenhar();
  aoMudarUnidade(desenhar);
  aoRedimensionar(() => T.serie && desenharSerie());
}

function desenhar() {
  const g = grupoDe(T.t);
  const lugar = T.lugar ? [T.lugar.cidade, nomePais(T.lugar)].filter(Boolean).join(", ") : "";
  const clima = T.clima ? `${num1(T.clima.temp)} °C${nomeCondicao(T.clima.cod) ? `, ${nomeCondicao(T.clima.cod).toLowerCase()}` : ""}${T.clima.chuva >= 0.3 ? `, ${t("{v} mm de chuva", { v: num1(T.clima.chuva) })}` : ""}` : "";

  const medidas = [];
  if (T.m) medidas.push([t("Distância"), dist(T.m, 2)]);
  medidas.push([t("Tempo em movimento"), relogio(T.s)]);
  if (T.m && T.s) medidas.push([g === "pedal" ? t("Velocidade média") : t("Ritmo médio"), ritmo(T)]);
  if (T.el) medidas.push([t("Subida"), elev(T.el)]);
  if (T.hr) medidas.push([t("FC média"), `${T.hr} bpm`]);
  if (T.hrx) medidas.push([t("FC máxima"), `${T.hrx} bpm`]);
  if (T.cad) medidas.push([t("Cadência"), g === "corrida" || g === "caminhada" ? `${num(T.cad * 2)} ${t("ppm")}` : `${num(T.cad)} rpm`]);
  if (T.w) medidas.push([t("Potência média"), `${num(T.w)} W`]);
  if (T.cal) medidas.push([t("Calorias"), num(T.cal)]);
  if (T.e && T.e - T.s > 60) medidas.push([t("Tempo total"), relogio(T.e)]);
  if (T.k) medidas.push(["Kudos", num(T.k)]);

  const [ant, prox] = vizinhos;
  $("#treino").innerHTML = `
    <a class="voltar" href="./#recentes">${t("Voltar para o início")}</a>
    <header class="treino-cabeca">
      <span class="tipo"><i style="background:${corGrupo(g)}"></i>${esc(nomeTipo(T.t))}${T.prova ? `, ${t("prova")}` : ""}${T.pessoas > 1 ? plural(T.pessoas - 1, ", com mais {n} pessoa", ", com mais {n} pessoas") : ""}</span>
      <h1>${esc(T.n)}</h1>
      <p class="quando">${esc(t("{dia}, {data}, às {hora}", { dia: diaSemana(T.data), data: dataLonga(T.data), hora: hora(T.data) }))}${lugar ? esc(t(", em {lugar}", { lugar })) : ""}${clima ? `. ${esc(clima)}` : ""}.</p>
    </header>
    <dl class="treino-medidas">${medidas.slice(0, 8).map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join("")}</dl>
    <div class="treino-grade">
      <div>
        ${T.rota ? `<div class="mapa" id="mapa-treino" role="region" aria-label="${esc(t("Mapa da rota"))}"></div><p class="secundario" style="color:var(--texto-3);font-size:.8125rem;margin:.5rem 0 0">${t("O começo, o fim e os trechos perto de casa ficam escondidos, para proteger a privacidade.")}</p>` : `<p class="vazio">${T.oculta ? t("O mapa deste treino fica escondido: ele foi todo perto de casa.") : t("Este treino não tem mapa: foi feito em lugar fechado ou com o GPS desligado.")}</p>`}
        <a class="ver-strava" href="https://www.strava.com/activities/${encodeURIComponent(T.id)}">View on Strava</a>
      </div>
      <div>
        ${T.parciais?.length > 1 ? `<h3 class="bloco-titulo">${t("Parciais")}</h3><p class="nota" style="color:var(--texto-3);font-size:.8125rem;margin:-.5rem 0 .9rem">${t("Barra maior, quilômetro mais rápido.")}</p><div id="parciais"></div>` : ""}
        ${T.esforcos?.length ? `<h3 class="bloco-titulo" style="margin-top:2rem">${t("Melhores trechos")}</h3><div id="esforcos"></div>` : ""}
      </div>
    </div>
    <section class="serie-treino" id="serie-treino"></section>
    <nav class="navegacao-treinos" aria-label="${esc(t("Outros treinos"))}">
      ${ant ? `<a href="${linkTreino(ant.id)}"><small>${t("Treino anterior")}</small>${esc(ant.n)}</a>` : "<span></span>"}
      ${prox ? `<a href="${linkTreino(prox.id)}" style="text-align:right"><small>${t("Próximo treino")}</small>${esc(prox.n)}</a>` : "<span></span>"}
    </nav>`;

  if (T.parciais?.length > 1) {
    const velocidades = T.parciais.map((p) => p.v || 0);
    const maisRapida = Math.max(...velocidades);
    // a barra começa um pouco abaixo da parcial mais lenta, para as diferenças aparecerem
    const base = Math.min(...velocidades.filter(Boolean)) * 0.92;
    barrasH($("#parciais"), T.parciais.map((p, i) => ({
      rotulo: p.m < 950 ? t("Final ({m} m)", { m: num(p.m) }) : t("km {n}", { n: i + 1 }),
      valor: Math.max(0, (p.v || 0) - base),
      texto: g === "pedal" ? `${num1((p.v || 0) * 3.6)} km/h` : pace(p.m, p.s),
      dica: `${p.hr ? `${p.hr} bpm` : t("sem FC")}\n${t("{v} m de desnível", { v: `${p.el > 0 ? "+" : ""}${num1(p.el)}` })}`,
      cor: p.v === maisRapida ? "var(--pr)" : undefined,
    })), { max: maisRapida - base });
  }
  if (T.esforcos?.length) {
    $("#esforcos").innerHTML = `<table class="resultados"><tbody>${T.esforcos
      .map((e) => `<tr><td>${esc(NOMES_ESFORCO[e.nome] || e.nome)}${e.pr === 1 ? `<span class="selo-pr">${t("recorde")}</span>` : e.pr ? `<span class="selo-pr" style="background:var(--linha-forte);color:var(--texto)">${t("{n}º melhor", { n: e.pr })}</span>` : ""}</td>
        <td class="num"><span class="tempo" style="font-size:1.25rem">${relogio(e.t)}</span></td><td class="num secundario">${pace(e.dist, e.t)}</td></tr>`)
      .join("")}</tbody></table>`;
  }
  desenharSerie();
  if (T.rota) desenharMapa();
}

function desenharMapa() {
  if (!window.L) return setTimeout(desenharMapa, 150);
  const L = window.L;
  const trechos = trechosRota(T.rota);
  if (!trechos.length) return;
  const mapa = L.map("mapa-treino", { scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
  }).addTo(mapa);
  const cor = () => getComputedStyle(document.documentElement).getPropertyValue("--destaque-tx").trim();
  const linha = L.polyline(trechos, { color: cor(), weight: 4, opacity: 0.95 }).addTo(mapa);
  const texto = getComputedStyle(document.documentElement).getPropertyValue("--texto").trim();
  L.circleMarker(trechos[0][0], { radius: 6, color: texto, fillColor: texto, fillOpacity: 1, weight: 2 }).bindTooltip(t("Início visível")).addTo(mapa);
  L.circleMarker(trechos.at(-1).at(-1), { radius: 6, color: cor(), fillColor: "#fff", fillOpacity: 1, weight: 3 }).bindTooltip(t("Fim visível")).addTo(mapa);
  mapa.fitBounds(linha.getBounds(), { padding: [24, 24] });
  mapa.on("focus", () => mapa.scrollWheelZoom.enable());
  aoMudarTema(() => linha.setStyle({ color: cor() }));
}

// Altimetria, ritmo e FC ao longo do treino: três faixas empilhadas com o mesmo eixo de distância
// (em vez de dois eixos no mesmo gráfico). Passar o mouse mostra os valores naquele ponto.
function desenharSerie() {
  const el = $("#serie-treino");
  const s = T.serie;
  if (!el) return;
  if (!s?.d?.length) return el.remove();
  const g = grupoDe(T.t);
  const mi = getUnidade() === "mi";
  const xs = s.d;
  const total = xs.at(-1) || 1;
  // média móvel curta: tira o serrilhado do GPS sem apagar as mudanças de ritmo
  const suavizar = (lista, r = 2) =>
    lista.map((v, i) => {
      if (v == null || v <= 0) return v;
      const janela = lista.slice(Math.max(0, i - r), i + r + 1).filter((n) => n > 0);
      return janela.reduce((a, b) => a + b, 0) / janela.length;
    });
  const faixas = [];
  // "minimo" é a menor faixa de valores da escala: num treino plano, 10 m de subida não viram montanha
  if (s.alt?.some((v) => v != null)) {
    const conv = (v) => (mi ? v * 3.28084 : v);
    faixas.push({ titulo: t("Altimetria"), valores: s.alt.map((v) => (v == null ? null : conv(v))), fmt: (v) => `${num(v)} ${mi ? t("pés") : "m"}`, eixo: (v) => num(v), area: true, classe: "alt", minimo: mi ? 120 : 40 });
  }
  if (s.v?.some((v) => v > 0)) {
    const vel = suavizar(s.v);
    if (g === "pedal") {
      faixas.push({ titulo: t("Velocidade"), valores: vel.map((v) => (v > 0.5 ? (mi ? v * 2.23694 : v * 3.6) : null)), fmt: (v) => `${num1(v)} ${mi ? "mph" : "km/h"}`, eixo: (v) => num(v), classe: "ritmo", minimo: 8 });
    } else {
      const base = mi ? 1609.344 : 1000;
      // parado (menos de 0,8 m/s) não vira ritmo: o gráfico fica com um vão ali
      faixas.push({ titulo: t("Ritmo"), valores: vel.map((v) => (v > 0.8 ? base / v : null)), fmt: (v) => `${relogio(v)} /${rotuloDist()}`, eixo: (v) => relogio(v), inverter: true, classe: "ritmo", minimo: 60 });
    }
  }
  if (s.hr?.some((v) => v > 0)) {
    faixas.push({ titulo: t("Frequência cardíaca"), valores: s.hr.map((v) => (v > 0 ? v : null)), fmt: (v) => `${num(v)} bpm`, eixo: (v) => num(v), classe: "fc", minimo: 30 });
  }
  if (!faixas.length) return el.remove();

  const largura = Math.max(300, el.clientWidth || 800);
  const alto = 118;
  const m = { l: 48, r: 8, t: 24, b: 6 }; // em cima, uma linha só para o nome da faixa
  const w = largura - m.l - m.r;
  const h = alto - m.t - m.b;
  const x = (d) => m.l + (d / total) * w;
  const quantil = (lista, q) => {
    const v = lista.filter((n) => n != null).sort((a, b) => a - b);
    return v[Math.floor(q * (v.length - 1))];
  };

  const svgs = faixas.map((f) => {
    // no ritmo, os 3% mais extremos ficam de fora da escala (paradas e arrancadas)
    let lo = quantil(f.valores, f.inverter ? 0.03 : 0);
    let hi = quantil(f.valores, f.inverter ? 0.97 : 1);
    const falta = (f.minimo || 1e-6) - (hi - lo);
    if (falta > 0) {
      lo -= falta / 2;
      hi += falta / 2;
    }
    const folga = (hi - lo) * 0.08;
    lo -= folga;
    hi += folga;
    f.y = (v) => {
      const p = (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo);
      return m.t + (f.inverter ? p : 1 - p) * h; // ritmo: mais rápido em cima
    };
    let d = "";
    let aberto = false;
    f.valores.forEach((v, j) => {
      if (v == null) { aberto = false; return; }
      d += `${aberto ? "L" : "M"}${x(xs[j]).toFixed(1)} ${f.y(v).toFixed(1)}`;
      aberto = true;
    });
    const area = f.area && d ? `<path class="area" d="${d}L${x(xs.at(-1)).toFixed(1)} ${m.t + h}L${x(xs[0]).toFixed(1)} ${m.t + h}Z"/>` : "";
    const [cima, baixo] = f.inverter ? [lo, hi] : [hi, lo];
    return `<div class="serie-faixa ${f.classe}">
      <span class="serie-titulo">${esc(f.titulo)}</span>
      <svg width="${largura}" height="${alto}" viewBox="0 0 ${largura} ${alto}" aria-hidden="true">
        <line class="grade" x1="${m.l}" x2="${largura - m.r}" y1="${m.t}" y2="${m.t}"/>
        <line class="grade" x1="${m.l}" x2="${largura - m.r}" y1="${m.t + h}" y2="${m.t + h}"/>
        <text x="${m.l - 6}" y="${m.t + 4}" text-anchor="end">${esc(f.eixo(cima))}</text>
        <text x="${m.l - 6}" y="${m.t + h}" text-anchor="end">${esc(f.eixo(baixo))}</text>
        ${area}<path class="linha" d="${d}"/>
        <line class="cursor" x1="0" x2="0" y1="${m.t}" y2="${m.t + h}" visibility="hidden"/>
        <circle class="ponto-cursor" r="3.5" visibility="hidden"/>
      </svg>
    </div>`;
  });

  // marcas de distância embaixo (1, 2, 5 ou 10 km/mi, conforme o tamanho)
  const totalU = total / (mi ? 1609.344 : 1000);
  const passo = [1, 2, 5, 10, 20, 50].find((p) => totalU / p <= 8) || 100;
  let marcas = "";
  for (let k = 0; k <= totalU + 1e-9; k += passo) {
    const px = x(k * (mi ? 1609.344 : 1000));
    marcas += `<text x="${px.toFixed(1)}" y="12" text-anchor="middle">${num(k)}</text>`;
  }

  el.innerHTML = `<h3 class="bloco-titulo">${t("Ao longo do treino")}</h3>
    <div class="serie-graficos" role="img" aria-label="${esc(t("Altimetria, ritmo e frequência cardíaca ao longo do treino"))}">
      ${svgs.join("")}
      <svg class="serie-eixo" width="${largura}" height="18" viewBox="0 0 ${largura} 18" aria-hidden="true">${marcas}<text x="${m.l - 6}" y="12" text-anchor="end">${rotuloDist()}</text></svg>
      <div class="dica serie-dica" hidden></div>
    </div>`;

  const caixa = $(".serie-graficos", el);
  const dica = $(".serie-dica", el);
  const cursores = faixas.map((f, i) => {
    const faixa = caixa.children[i];
    return { f, linha: $(".cursor", faixa), ponto: $(".ponto-cursor", faixa) };
  });
  const mostrar = (ev) => {
    const r = caixa.getBoundingClientRect();
    const px = ev.clientX - r.left;
    if (px < m.l || px > largura - m.r) return esconder();
    const alvo = ((px - m.l) / w) * total;
    let j = 0;
    while (j < xs.length - 1 && Math.abs(xs[j + 1] - alvo) <= Math.abs(xs[j] - alvo)) j++;
    const cx = x(xs[j]);
    const linhas = [dist(xs[j], 1)];
    for (const { f, linha, ponto } of cursores) {
      linha.setAttribute("x1", cx);
      linha.setAttribute("x2", cx);
      linha.setAttribute("visibility", "visible");
      const v = f.valores[j];
      if (v == null) ponto.setAttribute("visibility", "hidden");
      else {
        ponto.setAttribute("cx", cx);
        ponto.setAttribute("cy", f.y(v));
        ponto.setAttribute("visibility", "visible");
      }
      linhas.push(`${f.titulo}: ${v == null ? "–" : f.fmt(v)}`);
    }
    dica.textContent = linhas.join("\n");
    dica.hidden = false;
    dica.classList.add("visivel");
    const lado = cx > largura * 0.6 ? cx - dica.offsetWidth - 14 : cx + 14;
    dica.style.left = `${Math.max(0, lado)}px`;
    dica.style.top = "8px";
  };
  const esconder = () => {
    dica.hidden = true;
    for (const { linha, ponto } of cursores) {
      linha.setAttribute("visibility", "hidden");
      ponto.setAttribute("visibility", "hidden");
    }
  };
  caixa.addEventListener("pointermove", mostrar);
  caixa.addEventListener("pointerleave", esconder);
}
