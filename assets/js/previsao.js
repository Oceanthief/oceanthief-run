// Previsão de prova pela fórmula de Riegel, a partir dos melhores tempos de cada distância.
// Fica num arquivo só para a página Evolução e a animação "cada quilômetro, um ponto" darem
// sempre os mesmos números.
import { NOMES_ESFORCO, tr } from "./comum.js";

// as distâncias que aparecem; meia e maratona também contam o tempo oficial das provas
export const DISTANCIAS = [["1K", 1000], ["5K", 5000], ["10K", 10000], ["15K", 15000], ["Half-Marathon", 21097.5], ["30K", 30000], ["Marathon", 42195]];
const OFICIAIS = { "Half-Marathon": [20800, 21400], Marathon: [41700, 42800] };
// as que servem de base para a previsão (as mais curtas exageram; as mais longas quase não existem)
const BASES = ["5K", "10K", "Half-Marathon"];

const dataDe = (d) => new Date(`${d}T12:00`);

// Todos os esforços numa distância: o melhor trecho de cada corrida (evolucao.json), mais o tempo
// oficial das provas. `corridas` em ordem de data; `porId` acha o treino pelo id.
export function esforcosEm(E, corridas, porId, nome) {
  const lista = (E?.esforcos?.[nome] || []).map(([d, tempo, id]) => ({ data: dataDe(d), t: tempo, id, a: porId.get(id) }));
  const faixa = OFICIAIS[nome];
  if (faixa) {
    for (const a of corridas) {
      if (!a.prova || a.m < faixa[0] || a.m > faixa[1]) continue;
      const tempo = a.e || a.s;
      const mesmo = lista.find((x) => x.id === a.id);
      if (mesmo) {
        mesmo.oficial = true;
        mesmo.t = Math.min(mesmo.t, tempo);
      } else lista.push({ data: a.data, t: tempo, id: a.id, a, oficial: true });
    }
  }
  for (const x of lista) if (x.a?.prova) x.oficial = true;
  return lista.sort((x, y) => x.data - y.data);
}

// tempo2 = tempo1 × (distância2 / distância1) ^ 1,06
export const riegel = (tempo, de, para) => tempo * Math.pow(para / de, 1.06);

// A prova A do perfil.json: nome, distância em metros, data e a meta em segundos ("Sub 3h20" vira 12000).
export function provaAlvo(perfil) {
  const alvo = (perfil?.provas_alvo || []).find((p) => String(p.prioridade || "").toUpperCase() === "A");
  const mm = /(\d{1,2})\s*[h:]\s*(\d{2})(?:\s*[:m]\s*(\d{2}))?/.exec(String(tr(alvo?.meta) || ""));
  return {
    alvo,
    nome: tr(alvo?.nome) || NOMES_ESFORCO.Marathon,
    dist: alvo?.distancia_km ? alvo.distancia_km * 1000 : 42195,
    meta: mm ? +mm[1] * 3600 + +mm[2] * 60 + +(mm[3] || 0) : null,
    data: alvo?.data ? new Date(alvo.data) : null,
  };
}

// A previsão pelo melhor 5K, 10K e 21K dos 12 meses até `ate` (sem `ate`, até hoje).
export function previsoes(E, corridas, porId, distAlvo, ate) {
  const desde = (ate ?? Date.now()) - 365 * 864e5;
  const saida = [];
  for (const [nome, d] of DISTANCIAS) {
    if (d >= distAlvo * 0.9 || !BASES.includes(nome)) continue;
    const recentes = esforcosEm(E, corridas, porId, nome).filter((x) => x.data.getTime() >= desde && (ate == null || x.data.getTime() <= ate));
    if (!recentes.length) continue;
    const melhor = recentes.reduce((a, b) => (b.t < a.t ? b : a));
    saida.push({ nome, d, melhor, previsto: riegel(melhor.t, d, distAlvo) });
  }
  return saida;
}
