// Página Provas: todas as provas, guardadas ano a ano, com as próximas no topo.
import {
  $, aoMudarUnidade, carregarTudo, dataCurta, dataLonga, dist, esc, iniciarDicas, linkTreino, montarRodape,
  MESES_CURTOS, montarTopo, nomeSite, nomeTopo, num, pace, periodoPrevisto, plural, relogio, semAcento, t, tr,
} from "./comum.js";

let S, P, PL, A;

async function iniciar() {
  try {
    ({ site: S, perfil: P, plano: PL } = await carregarTudo());
  } catch (erro) {
    $("#provas-pagina").innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
    return;
  }
  A = S.atividades;
  document.title = t("Provas: {nome}", { nome: nomeSite(S, P) });
  montarTopo({ nome: nomeTopo(S, P), pagina: "provas", plano: PL?.semanas?.length > 0 });
  montarRodape(S, P);
  desenhar();
  aoMudarUnidade(desenhar);
  iniciarDicas();
}

// "3:05:12" ou "42:10" (como vem do perfil.json) em segundos
function segundos(texto) {
  const partes = String(texto || "").split(":").map(Number);
  if (!partes.length || partes.some(isNaN)) return null;
  return partes.reduce((s, p) => s * 60 + p, 0);
}

// as provas feitas: as marcadas como prova no Strava e as listadas no perfil.json
function provasFeitas() {
  const manuais = (P.provas || [])
    .filter((p) => p.nome && p.data)
    .map((p) => ({
      nome: tr(p.nome),
      data: new Date(`${p.data}T12:00`),
      m: p.distancia_km ? p.distancia_km * 1000 : null,
      distTexto: tr(p.distancia) || "",
      tempo: segundos(p.tempo),
      id: p.strava_id || null,
      nota: tr(p.nota) || "",
    }));
  const idsManuais = new Set(manuais.map((p) => String(p.id)));
  const diasManuais = new Set((P.provas || []).map((p) => p.data));
  const auto = A.filter((a) => a.prova && !idsManuais.has(String(a.id)) && !diasManuais.has(a.dia)).map((a) => ({
    nome: a.n,
    data: a.data,
    m: a.m,
    tempo: a.e || a.s,
    id: a.id,
    hr: a.hr,
    temp: a.cl?.[0],
    cidade: a.l != null ? S.lugares?.[a.l]?.cidade : "",
    pr: a.pr || 0,
  }));
  return agruparEdicoes([...manuais, ...auto].sort((x, y) => x.data - y.data));
}

// A mesma prova em anos diferentes: nomes parecidos (sem números, emojis e palavras comuns),
// na mesma época do ano (até um mês de diferença) e com distância parecida.
const COMUNS = new Set(["corrida", "da", "de", "do", "dos", "das", "e", "a", "o", "em", "the", "run", "race", "prova", "primeira",
  "segunda", "ano", "edicao", "meia", "maratona", "half", "marathon", "km", "k", "internacional", "international"]);
const palavras = (nome) => new Set(semAcento(nome).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((p) => p.length > 1 && !COMUNS.has(p)));

function agruparEdicoes(lista) {
  const grupos = [];
  for (const p of lista) {
    const pp = palavras(p.nome);
    let melhor = null;
    for (const g of grupos) {
      const ultima = g.at(-1);
      if (ultima.data.getFullYear() === p.data.getFullYear()) continue;
      const pu = palavras(ultima.nome);
      const comum = [...pp].filter((x) => pu.has(x)).length;
      const jaccard = comum / (new Set([...pp, ...pu]).size || 1);
      const meses = Math.abs(ultima.data.getMonth() - p.data.getMonth());
      const mesmaEpoca = Math.min(meses, 12 - meses) <= 1;
      const distParecida = !p.m || !ultima.m || Math.min(p.m, ultima.m) / Math.max(p.m, ultima.m) >= 0.6;
      if (pp.size && jaccard >= 0.5 && mesmaEpoca && distParecida && (!melhor || jaccard > melhor.j)) melhor = { g, j: jaccard };
    }
    if (melhor) melhor.g.push(p);
    else grupos.push([p]);
  }
  for (const g of grupos) g.forEach((p, i) => (p.edicoes = g.slice(0, i)));
  return lista;
}

// as próximas: as provas alvo que ainda não aconteceram
function provasProximas() {
  const hoje = new Date();
  return (P.provas_alvo || [])
    .filter((p) => p?.nome && (p.data || periodoPrevisto(p.previsao)))
    .map((p) => {
      const prev = p.data ? null : periodoPrevisto(p.previsao);
      const data = prev ? new Date((prev.ini.getTime() + prev.fim.getTime()) / 2) : new Date(p.data.length <= 10 ? `${p.data}T12:00` : p.data);
      return { ...p, nome: tr(p.nome), prev, data, fim: prev ? prev.fim : data, prio: String(p.prioridade || "").toUpperCase() };
    })
    .filter((p) => p.fim > hoje)
    .sort((x, y) => x.data - y.data);
}

// a comparação com a edição anterior da mesma prova ([texto, classe])
function notaEdicao(p) {
  const ant = p.edicoes?.at(-1);
  if (!ant) return ["", ""];
  const ano = ant.data.getFullYear();
  if (p.tempo && ant.tempo && p.m && ant.m && Math.abs(p.m - ant.m) / ant.m < 0.05) {
    const dif = p.tempo - ant.tempo;
    if (Math.abs(dif) < 1) return [t("Mesmo tempo de {ano}", { ano }), ""];
    return dif < 0
      ? [t("{d} mais rápido que em {ano}", { d: relogio(-dif), ano }), "melhor"]
      : [t("{d} mais lento que em {ano}", { d: relogio(dif), ano }), ""];
  }
  return [t("Também correu em {anos}", { anos: p.edicoes.map((e) => e.data.getFullYear()).join(", ") }), ""];
}

function linhaFeita(p) {
  const nome = p.id ? `<a href="${linkTreino(p.id)}">${esc(p.nome)}</a>` : esc(p.nome);
  const lugar = [p.cidade, p.temp != null ? `${num(p.temp)} °C` : ""].filter(Boolean).join(", ");
  const [edicao, classeEdicao] = notaEdicao(p);
  const distancia = p.m ? dist(p.m, 1) : p.distTexto;
  return `<tr>
    <td class="pa-data">${esc(dataCurta(p.data))}</td>
    <td class="pa-nome">${nome}${p.pr ? ` <span class="selo-recorde" data-dica="${esc(plural(p.pr, "{n} recorde pessoal nesta prova", "{n} recordes pessoais nesta prova"))}">${t("recorde")}</span>` : ""}
      ${lugar || p.nota ? `<div class="secundario">${esc([lugar, p.nota].filter(Boolean).join(". "))}</div>` : ""}
      ${edicao ? `<div class="pa-edicao${classeEdicao ? ` ${classeEdicao}` : ""}">${esc(edicao)}</div>` : ""}</td>
    <td class="pa-dist num">${esc(distancia || "–")}</td>
    <td class="pa-tempo num"><span class="tempo">${p.tempo ? relogio(p.tempo) : "–"}</span></td>
    <td class="pa-pace num">${p.tempo && p.m ? pace(p.m, p.tempo) : ""}</td>
    <td class="pa-fc num">${p.hr ? `${num(p.hr)} bpm` : ""}</td>
  </tr>`;
}

function linhaProxima(p) {
  const quando = p.prev ? p.prev.texto : dataLonga(p.data);
  const distancia = p.distancia_km ? dist(p.distancia_km * 1000, p.distancia_km % 1 ? 1 : 0) : "";
  const meta = tr(p.meta);
  return `<tr class="proxima">
    <td class="pa-data">${esc(quando)}</td>
    <td class="pa-nome"><a href="./#alvos">${esc(p.nome)}</a>${p.prio ? ` <span class="selo-prio-mini prio-${esc(p.prio)}">${esc(p.prio)}</span>` : ""}
      ${p.cidade ? `<div class="secundario">${esc(tr(p.cidade))}</div>` : ""}</td>
    <td class="pa-dist num">${esc(distancia || "–")}</td>
    <td class="pa-tempo num">${meta ? `<span class="pa-meta">${t("Meta")}: ${esc(meta)}</span>` : ""}</td>
    <td class="pa-pace num"></td>
    <td class="pa-fc num"></td>
  </tr>`;
}

function tabela(linhas) {
  return `<div class="tabela-rolagem"><table class="resultados provas-ano">
    <thead><tr><th>${t("Data")}</th><th>${t("Prova")}</th><th class="num">${t("Distância")}</th><th class="num">${t("Tempo")}</th><th class="num">${t("Pace")}</th><th class="num">${t("FC média")}</th></tr></thead>
    <tbody>${linhas.join("")}</tbody></table></div>`;
}

function desenhar() {
  const feitas = provasFeitas();
  const proximas = provasProximas();
  const km = feitas.reduce((s, p) => s + (p.m || 0), 0);
  const horas = feitas.reduce((s, p) => s + (p.tempo || 0), 0);
  const anos = [...new Set(feitas.map((p) => p.data.getFullYear()))].sort((x, y) => y - x);
  const primeira = feitas[0];

  const faixa = [
    [t("Provas"), num(feitas.length)],
    [t("Distância em provas"), dist(km, 0)],
    [t("Tempo em provas"), `${num(Math.floor(horas / 3600))} h ${String(Math.round((horas % 3600) / 60)).padStart(2, "0")}`],
    [t("Primeira prova"), primeira ? `${MESES_CURTOS[primeira.data.getMonth()]} ${primeira.data.getFullYear()}` : "–"],
  ];

  const blocoProximas = proximas.length
    ? `<section class="ano-provas proximas" aria-labelledby="ano-proximas">
        <header class="ano-provas-cabeca"><h2 id="ano-proximas">${t("Próximas")}</h2>
          <p>${esc(plural(proximas.length, "{n} prova marcada", "{n} provas marcadas"))}</p></header>
        ${tabela(proximas.map(linhaProxima))}
      </section>`
    : "";

  const blocosAnos = anos
    .map((ano) => {
      const doAno = feitas.filter((p) => p.data.getFullYear() === ano).reverse();
      const kmAno = doAno.reduce((s, p) => s + (p.m || 0), 0);
      return `<section class="ano-provas" aria-labelledby="ano-${ano}">
        <header class="ano-provas-cabeca"><h2 id="ano-${ano}">${ano}</h2>
          <p>${esc(plural(doAno.length, "{n} prova", "{n} provas"))}${kmAno ? `, ${esc(dist(kmAno, 0))}` : ""}</p></header>
        ${tabela(doAno.map(linhaFeita))}
      </section>`;
    })
    .join("");

  $("#provas-pagina").innerHTML = `
    <header class="pagina-cabeca">
      <h1>${t("Provas")}</h1>
    </header>
    <dl class="faixa-numeros faixa-pagina">${faixa.map(([dt, dd]) => `<div class="num-capa"><dt class="rotulo">${esc(dt)}</dt><dd class="valor">${esc(dd)}</dd></div>`).join("")}</dl>
    ${blocoProximas}
    ${blocosAnos || `<p class="vazio">${t("Marque suas provas no Strava (tipo de corrida: prova) ou liste-as em config/perfil.json.")}</p>`}
    <p class="nota-pagina">${t("Entram aqui os treinos marcados como prova no Strava e as provas listadas no perfil. O tempo é o do relógio, do início ao fim.")}</p>`;
}

iniciar();
