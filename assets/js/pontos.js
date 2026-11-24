// Cada quilômetro, um ponto.
//
// Uma história em capítulos, contada sempre com os mesmos pontos: um por km corrido no ano. Cada capítulo
// arruma os pontos de outro jeito para responder a uma pergunta (a ideia vem de "Land doesn't vote, people
// do", de Karim Douieb, e das versões animadas de David Zumbach e Caio Yamamoto Lellis):
//   1. Rotas: as linhas, uma por cima da outra. Um trecho feito 40 vezes parece igual a um feito uma vez.
//   2. Quilômetros: cada km vira um ponto, juntado num monte perto de onde foi corrido.
//   3. Meta: em ordem de data, os pontos enchem a meta do ano. No ano corrente, anéis mostram onde o ano
//      deve fechar no ritmo das últimas 8 semanas.
//   4. Semanas: uma coluna por semana. A constância: semanas sem corrida, a maior sequência, a média.
//   5. Horários: uma coluna por hora de saída. O hábito.
//   6. Ritmo: cada ponto na altura do ritmo daquele km (a parcial do Strava), com a mediana de 4 semanas
//      e o ritmo da meta da prova A.
//   7. Previsão (só no ano corrente, com prova A, meta e data): 42 pontos por linha, cada linha no ritmo de
//      uma previsão (previsao.js, as mesmas contas da página Evolução), numa corrida contra a meta.
//
// Os capítulos andam com a rolagem: o desenho fica parado (sticky) e o texto passa ao lado (no celular,
// por baixo do desenho). Os pontos vêm de data/pontos.json (scripts/sync_strava.py, montar_pontos). Tudo
// é desenhado num <canvas>: são ~1.300 pontos, leves até no celular. Com "reduzir movimento" ligado no
// sistema, cada capítulo aparece pronto, sem animação.
import {
  $, $$, abas, aoMudarTema, dataCurta, dataLonga, DIAS_LONGOS, distTreino, esc, hora, inicioSemana, linkTreino, LOCALE,
  MESES_CURTOS, NOMES_ESFORCO, num, pace, reduzirMovimento, relogio, t, trechosRota,
} from "./comum.js";
import { previsoes, provaAlvo } from "./previsao.js";

const M_LAT = 110540; // metros por grau de latitude (o mesmo de montar_pontos)
const M_LNG = 111320; // metros por grau de longitude, vezes o cosseno da latitude
const CELULA_MONTE = 450; // metros: os pontos dentro do mesmo quadrado formam um monte
const CELULA_TRECHO = 300; // metros: para contar quantas corridas passaram pelo mesmo trecho
const OURO = Math.PI * (3 - Math.sqrt(5)); // ângulo de ouro: espalha os pontos como sementes de girassol
const DIA = 864e5;
const SEMANA = 7 * DIA;
const CORRIDA_MS = 4600; // quanto dura, na tela, a corrida do capítulo da previsão
const MESES_LONGOS = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(LOCALE, { month: "long" }).format(new Date(2026, i, 15)));

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const misturar = (a, b, e) => a + (b - a) * e;
const soma = (lista, f) => lista.reduce((s, x) => s + f(x), 0);
const nomeDist = (nome) => NOMES_ESFORCO[nome] || nome;
const ritmoTexto = (s) => `${relogio(s)} /km`;
// 6h em português e espanhol, 6am em inglês
const rotuloHora = (h) => (LOCALE.startsWith("en") ? `${h % 12 || 12}${h < 12 ? "am" : "pm"}` : `${h}h`);
const colunasGrade = (largura) => (largura >= 560 ? 50 : 30);
const DIST_M = { "5K": 5000, "10K": 10000, "Half-Marathon": 21097.5 };
const semanaDe = (d, inicio) => Math.round((inicioSemana(d) - inicio) / SEMANA);
function mediana(v) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const quantil = (v, q) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};

// pontos de um monte em espiral de girassol, do mais antigo (no meio) ao mais novo (na borda)
const raioMonte = (n, passo) => passo * 0.56 * Math.sqrt(n) + passo * 0.5;
function girassol(n, cx, cy, passo) {
  const saida = [];
  for (let i = 0; i < n; i++) {
    const r = passo * 0.56 * Math.sqrt(i + 0.5);
    saida.push([cx + r * Math.cos(i * OURO), cy + r * Math.sin(i * OURO)]);
  }
  return saida;
}

// Montes que se encostam se afastam; cada um puxa de volta para onde estava (um cartograma de Dorling).
// Sem sorteio: o mesmo ano dá sempre o mesmo desenho.
function afastar(montes, area, folga) {
  for (let volta = 0; volta < 260; volta++) {
    let mexeu = false;
    for (let i = 0; i < montes.length; i++) {
      const a = montes[i];
      for (let j = i + 1; j < montes.length; j++) {
        const b = montes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) {
          dx = Math.cos(i + j);
          dy = Math.sin(i + j);
          d = 1;
        }
        const minimo = a.r + b.r + folga;
        if (d >= minimo) continue;
        const sobra = minimo - d;
        // o monte maior anda menos
        const pa = b.r / (a.r + b.r);
        a.x -= (dx / d) * sobra * pa;
        a.y -= (dy / d) * sobra * pa;
        b.x += (dx / d) * sobra * (1 - pa);
        b.y += (dy / d) * sobra * (1 - pa);
        mexeu = true;
      }
    }
    for (const m of montes) {
      m.x += (m.x0 - m.x) * 0.03;
      m.y += (m.y0 - m.y) * 0.03;
      m.x = limitar(m.x, area.x + m.r, area.x + area.w - m.r);
      m.y = limitar(m.y, area.y + m.r, area.y + area.h - m.r);
    }
    if (!mexeu && volta > 30) break;
  }
}

// Colunas de pontos empilhados de baixo para cima. Escolhe quantos pontos vão lado a lado em cada fileira
// para a coluna mais alta caber na altura, com os pontos do maior tamanho possível.
function empilhar(maior, largCol, altura, passoMax) {
  let melhor = { porFila: 1, passo: 0 };
  for (let porFila = 1; porFila <= 30; porFila++) {
    const passo = Math.min(passoMax, (largCol * 0.9) / porFila, altura / Math.ceil(Math.max(1, maior) / porFila));
    if (passo > melhor.passo + 0.01) melhor = { porFila, passo };
  }
  return melhor;
}
const naPilha = (j, cx, base, { porFila, passo }) => [cx + ((j % porFila) - (porFila - 1) / 2) * passo, base - (Math.floor(j / porFila) + 0.5) * passo];

function metaDoAno(perfil, ano) {
  const m = perfil?.meta_anual_km;
  return Number(m?.[ano] ?? (typeof m === "number" ? m : 0)) || 0;
}

export function montarPontos(el, { atividades, pontos, rotas, perfil, evolucao }) {
  if (!el || !pontos?.mapa || !Object.keys(pontos.anos || {}).length) {
    if (el) el.hidden = true;
    return;
  }
  const corridas = [...atividades].sort((a, b) => a.data - b.data);
  const porId = new Map(corridas.map((a) => [a.id, a]));
  const anos = Object.keys(pontos.anos).sort((a, b) => b - a);
  const hoje = new Date();
  const anoAtual = String(hoje.getFullYear());
  const temPontos = (a) => pontos.anos[a].pontos.length >= 50;
  const alvo = provaAlvo(perfil);
  const estado = {
    ano: (temPontos(anoAtual) && anoAtual) || anos.find(temPontos) || anos[0],
    cap: 0,
    sessao: 0, // cada ordem nova (rolagem, clique, troca de ano) aumenta; animações antigas param sozinhas
  };

  el.innerHTML = `
    <div class="historia">
      <div class="historia-figura">
        <div class="historia-barra">
          <div class="abas pontos-anos" role="group" aria-label="${esc(t("Ano"))}"></div>
          <ol class="historia-marcas" aria-label="${esc(t("Capítulos"))}"></ol>
        </div>
        <div class="pontos-tela"><canvas aria-hidden="true"></canvas></div>
      </div>
      <div class="historia-capitulos"></div>
    </div>
    <details class="pontos-tabela"><summary>${esc(t("Ver os números mês a mês"))}</summary><div></div></details>`;
  const figura = $(".historia-figura", el);
  const tela = $(".pontos-tela", el);
  const canvas = $("canvas", el);
  const ctx = canvas.getContext("2d");
  const dica = document.createElement("div");
  dica.className = "dica";
  dica.setAttribute("role", "tooltip");
  document.body.append(dica);

  let M; // o ano escolhido
  let L; // medidas e posições no tamanho atual
  let cores;
  let camadaRotas;
  const camadas = { linhas: 1, montes: 0, meta: 0, semanas: 0, horas: 0, ritmo: 0, maratona: 0 };

  // ------------------------------------------------------------ dados do ano
  // km de corrida em cada semana (segunda a domingo) de um ano; "ate" é a última que já começou
  function semanasDoAno(ano) {
    const inicio = inicioSemana(new Date(ano, 0, 1));
    const total = semanaDe(new Date(ano, 11, 31), inicio) + 1;
    const ate = String(ano) === anoAtual ? semanaDe(hoje, inicio) : total - 1;
    const km = Array(total).fill(0);
    const doAno = corridas.filter((a) => a.ano === ano);
    for (const a of doAno) km[semanaDe(a.data, inicio)] += a.m / 1000;
    // no primeiro ano com corridas, as semanas contam a partir da primeira
    const primeira = String(ano) === anos.at(-1) && doAno.length ? semanaDe(doAno[0].data, inicio) : 0;
    return { inicio, total, ate, km, primeira };
  }

  function prepararAno() {
    const d = pontos.anos[estado.ano];
    const ano = Number(estado.ano);
    const S = semanasDoAno(ano);
    const lista = [];
    d.pontos.forEach((p, i) => {
      const a = porId.get(d.ids[p[0]]);
      if (!a) return;
      lista.push({
        k: lista.length, a, mes: a.data.getMonth(), prova: !!a.prova,
        tipo: p.length === 3 ? "mapa" : p.length === 2 ? "fora" : "sem", mx: p[1], my: p[2],
        ritmo: d.ritmo?.[i] || a.s / (a.m / 1000),
        semana: limitar(semanaDe(a.data, S.inicio), 0, S.total - 1),
        hora: a.data.getHours(),
        x: 0, y: 0, r: 0, al: 0,
      });
    });
    const doAno = corridas.filter((a) => a.ano === ano);
    const meta = metaDoAno(perfil, estado.ano);
    M = {
      ano,
      atual: estado.ano === anoAtual,
      pontos: lista,
      extra: [], // os pontos das linhas da previsão
      corridas: doAno,
      km: soma(doAno, (a) => a.m) / 1000,
      comRota: doAno.filter((a) => rotas.has(a.id)),
      meta,
      sem: lista.filter((p) => p.tipo === "sem").length,
      fora: lista.filter((p) => p.tipo === "fora").length,
      batida: meta && lista.length >= meta ? lista[meta - 1].a.data : null,
      S,
      relogio: 0,
    };
    M.repetido = trechoMaisRepetido(M.comRota);
    M.semanas = resumoSemanas(S, semanasDoAno(ano - 1));
    M.horas = resumoHoras();
    M.ritmo = resumoRitmo();
    M.projecao = M.atual ? projecaoDoAno() : null;
    M.previsao = M.atual ? montarPrevisao() : null;
    M.caps = ["rotas", "montes", "meta", "semanas", "horas", "ritmo", ...(M.previsao ? ["maratona"] : [])];
    estado.cap = Math.min(estado.cap, M.caps.length - 1);
  }

  // quantas corridas passaram pelo trecho mais usado (quadrados de 300 m, um ponto a cada ~100 m da rota)
  function trechoMaisRepetido(lista) {
    const mp = pontos.mapa;
    const contagem = new Map();
    for (const a of lista) {
      const vistos = new Set();
      for (const tr of trechosRota(rotas.get(a.id))) {
        for (let i = 1; i < tr.length; i++) {
          const [la1, lo1] = tr[i - 1];
          const [la2, lo2] = tr[i];
          const passos = Math.max(1, Math.ceil(Math.hypot((la2 - la1) * M_LAT, (lo2 - lo1) * mp.cos_lat * M_LNG) / 100));
          for (let s = 0; s <= passos; s++) {
            const la = misturar(la1, la2, s / passos);
            const lo = misturar(lo1, lo2, s / passos);
            vistos.add(`${Math.floor((lo * mp.cos_lat * M_LNG) / CELULA_TRECHO)},${Math.floor((la * M_LAT) / CELULA_TRECHO)}`);
          }
        }
      }
      for (const c of vistos) contagem.set(c, (contagem.get(c) || 0) + 1);
    }
    return Math.max(0, ...contagem.values());
  }

  // a constância: semanas com corrida, a maior sequência, a média, a semana mais forte
  function resumoSemanas(S, antes) {
    const contadas = S.km.slice(S.primeira, S.ate + 1);
    // no ano corrente, a semana que acabou de começar ainda não quebra a sequência
    const ultima = M.atual && !S.km[S.ate] ? S.ate - 1 : S.ate;
    let maior = { n: 0, ate: -1 };
    let atual = 0;
    for (let w = S.primeira; w <= ultima; w++) {
      atual = S.km[w] > 0 ? atual + 1 : 0;
      if (atual > maior.n) maior = { n: atual, ate: w };
    }
    const forte = S.km.reduce((b, v, w) => (v > S.km[b] ? w : b), 0);
    const acima40 = (lista) => lista.filter((v) => v >= 40).length;
    return {
      com: contadas.filter((v) => v > 0).length,
      total: contadas.length,
      media: soma(contadas, (v) => v) / Math.max(1, contadas.length),
      maior,
      continua: M.atual && maior.n > 1 && maior.ate === ultima,
      forte: { km: S.km[forte], data: new Date(S.inicio.getTime() + forte * SEMANA) },
      acima40: acima40(contadas),
      acima40Antes: corridas.some((a) => a.ano === M.ano - 1) ? acima40(antes.km.slice(antes.primeira, antes.ate + 1)) : null,
    };
  }

  // o hábito: a hora de saída e o dia da semana
  function resumoHoras() {
    const parte = (lista, f) => soma(lista.filter(f), (a) => a.m) / Math.max(1, soma(lista, (a) => a.m));
    const cedo = (a) => a.data.getHours() < 7;
    const anterior = corridas.filter((a) => a.ano === M.ano - 1);
    const porHora = new Map();
    for (const p of M.pontos) porHora.set(p.hora, (porHora.get(p.hora) || 0) + 1);
    const pico = [...porHora].reduce((b, x) => (x[1] > b[1] ? x : b), [0, 0]);
    if (!porHora.size) porHora.set(6, 0);
    const porDia = Array(7).fill(0);
    for (const a of M.corridas) porDia[(a.data.getDay() + 6) % 7] += a.m / 1000;
    const dia = porDia.indexOf(Math.max(...porDia));
    return {
      de: Math.min(...porHora.keys()),
      ate: Math.max(...porHora.keys()),
      porHora,
      pico: { hora: pico[0], n: pico[1] },
      cedo: parte(M.corridas, cedo),
      cedoAntes: anterior.length ? parte(anterior, cedo) : null,
      dia: { nome: DIAS_LONGOS[dia], km: porDia[dia] },
    };
  }

  // o ritmo de cada km: a mediana de cada mês, a de 4 semanas e o ritmo da meta da prova A
  function resumoRitmo() {
    const ritmos = M.pontos.length ? M.pontos.map((p) => p.ritmo) : [300];
    const porMes = Array.from({ length: 12 }, () => []);
    for (const p of M.pontos) porMes[p.mes].push(p.ritmo);
    const meses = porMes.map((v, mes) => ({ mes, n: v.length, mediana: mediana(v), lista: v })).filter((m) => m.n >= 30);
    const metaRitmo = alvo.meta ? alvo.meta / (alvo.dist / 1000) : null;
    const ult = meses.at(-1);
    const movel = [];
    for (let w = 0; w < M.S.total; w++) {
      const v = M.pontos.filter((p) => p.semana > w - 4 && p.semana <= w).map((p) => p.ritmo);
      if (v.length >= 8) movel.push([w, mediana(v)]);
    }
    return {
      rapido: Math.min(quantil(ritmos, 0.01), metaRitmo ? metaRitmo - 12 : Infinity),
      lento: quantil(ritmos, 0.98),
      primeiro: meses[0],
      ultimo: ult,
      metaRitmo,
      // quantos km do último mês saíram mais rápido que o ritmo da meta
      naMeta: ult && metaRitmo ? ult.lista.filter((r) => r <= metaRitmo).length / ult.n : null,
      movel,
    };
  }

  // no ano corrente: onde o ano fecha no ritmo das últimas 8 semanas
  function projecaoDoAno() {
    const porDia = soma(corridas.filter((a) => a.data > hoje - 56 * DIA && a.data <= hoje), (a) => a.m) / 1000 / 56;
    const fim = new Date(M.ano, 11, 31, 23, 59);
    const total = M.km + porDia * Math.max(0, (fim - hoje) / DIA);
    let chegada = null;
    if (M.meta && M.km < M.meta && porDia > 0) {
      const quando = new Date(hoje.getTime() + ((M.meta - M.km) / porDia) * DIA);
      if (quando <= fim) chegada = quando;
    }
    return { porSemana: porDia * 7, total, pontos: Math.floor(total), chegada };
  }

  // a corrida contra a meta: uma linha para a meta e uma para cada previsão de Riegel
  function montarPrevisao() {
    if (!alvo.meta || !alvo.data || alvo.data <= hoje || !evolucao) return null;
    const lista = previsoes(evolucao, corridas, porId, alvo.dist);
    if (!lista.length) return null;
    const km = alvo.dist / 1000;
    const raias = [
      { meta: true, tempo: alvo.meta, rotulo: t("Meta: {t}", { t: relogio(alvo.meta) }) },
      ...lista.map((x) => ({
        nome: x.nome,
        tempo: x.previsto,
        base: x.melhor,
        rotulo: t("{d} em {base}: previsão de {t}", { d: nomeDist(x.nome), base: relogio(x.melhor.t), t: relogio(x.previsto) }),
      })),
    ].map((r) => {
      const ritmo = r.tempo / km;
      const naMeta = Math.min(km, alvo.meta / ritmo);
      return { ...r, ritmo, naMeta, feitos: r.tempo <= alvo.meta + 0.5 ? Math.floor(km) : Math.floor(naMeta) };
    });
    const antes = previsoes(evolucao, corridas, porId, alvo.dist, hoje.getTime() - 365 * DIA);
    const porSemana = soma(corridas.filter((a) => a.data > hoje - 84 * DIA && a.data <= hoje), (a) => a.m) / 1000 / 12;
    const semanas = Math.ceil((alvo.data - hoje) / SEMANA);
    return {
      raias,
      meta: alvo.meta,
      km,
      semanas,
      porSemana,
      ateLargada: porSemana * semanas,
      melhorAgora: Math.min(...lista.map((x) => x.previsto)),
      melhorAntes: antes.length ? Math.min(...antes.map((x) => x.previsto)) : null,
    };
  }

  // os pontos das linhas da previsão: cada um sai do lugar de um ponto do ano (os mais recentes)
  function prepararExtras() {
    M.extra = [];
    if (!M.previsao || !M.pontos.length) return;
    const n = M.pontos.length;
    let i = 0;
    M.previsao.raias.forEach((r, raia) => {
      for (let j = 1; j <= r.feitos; j++) {
        M.extra.push({ raia, j, ritmo: r.ritmo, fonte: M.pontos[n - 1 - (i++ % n)], x: 0, y: 0, r: 0, al: 0 });
      }
    });
  }

  // --------------------------------------------------------------- medidas
  function lerCores() {
    const s = getComputedStyle(el);
    const v = (n) => s.getPropertyValue(n).trim();
    cores = {
      a: v("--ponto-a"), b: v("--ponto-b"), prova: v("--ponto-prova"), linha: v("--texto-3"), trilha: v("--linha-forte"),
      grade: v("--linha"), texto: v("--texto"), texto2: v("--texto-2"), fraco: v("--texto-3"), fundo: v("--fundo"),
      fonte: getComputedStyle(document.body).fontFamily,
    };
  }
  const corDe = (p) => (p.raia != null ? (p.raia === 0 ? cores.prova : cores.a) : p.prova ? cores.prova : p.mes % 2 ? cores.b : cores.a);

  function calcular() {
    const W = Math.round(tela.clientWidth);
    const H = Math.round(tela.clientHeight);
    if (!W || !H) return false;
    const largo = W >= 560;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = { W, H, largo, dpr, rotulosLado: [] };
    const n = Math.max(1, M.pontos.length);

    // ---- 1 e 2: o mapa, e os montes sem lugar ao lado (embaixo, se a tela for estreita)
    const deLado = W / H >= 1.15;
    const faixa = deLado ? 0 : Math.round(limitar(H * 0.27, 90, 130));
    const areaMapa = deLado ? { x: 0, y: 0, w: W * 0.72, h: H } : { x: 0, y: 0, w: W, h: H - faixa };
    const areaLado = deLado ? { x: W * 0.74, y: 0, w: W * 0.26, h: H } : { x: 0, y: H - faixa, w: W, h: faixa };
    const mp = pontos.mapa;
    const escala = Math.min(areaMapa.w / mp.w, areaMapa.h / mp.h) * 0.96;
    const ox = areaMapa.x + (areaMapa.w - mp.w * escala) / 2;
    const oy = areaMapa.y + (areaMapa.h - mp.h * escala) / 2;
    const proj = (mx, my) => [ox + mx * escala, oy + my * escala];
    L.projLL = ([lat, lng]) => proj((lng - mp.lng_esq) * mp.cos_lat * M_LNG, (mp.lat_topo - lat) * M_LAT);
    // o tamanho dos pontos no mapa: juntos, cobrem ~14% da área (fica legível sem virar uma mancha)
    const passoMapa = limitar(Math.sqrt((0.14 * areaMapa.w * areaMapa.h) / n), 3, 7);
    L.rMapa = passoMapa * 0.42;
    for (const p of M.pontos) if (p.tipo === "mapa") p.rota = proj(p.mx, p.my);
    const grupos = new Map();
    for (const p of M.pontos) {
      if (p.tipo !== "mapa") continue;
      const chave = `${Math.floor(p.mx / CELULA_MONTE)},${Math.floor(p.my / CELULA_MONTE)}`;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(p);
    }
    const montes = [...grupos.values()].map((ps) => {
      const x0 = soma(ps, (p) => p.rota[0]) / ps.length;
      const y0 = soma(ps, (p) => p.rota[1]) / ps.length;
      return { ps, x0, y0, x: x0, y: y0, r: raioMonte(ps.length, passoMapa) };
    });
    afastar(montes, areaMapa, passoMapa * 0.5);
    for (const m of montes) girassol(m.ps.length, m.x, m.y, passoMapa).forEach((xy, i) => (m.ps[i].monte = xy));
    const lados = [["sem", M.sem], ["fora", M.fora]].filter(([, q]) => q);
    lados.forEach(([tipo, q], i) => {
      const cx = deLado ? areaLado.x + areaLado.w / 2 : areaLado.w * (lados.length === 1 ? 0.5 : i === 0 ? 0.3 : 0.75);
      const cy = deLado ? areaLado.y + areaLado.h * (lados.length === 1 ? 0.5 : i === 0 ? 0.38 : 0.74) : areaLado.y + faixa / 2 + 8;
      const ps = M.pontos.filter((p) => p.tipo === tipo);
      girassol(ps.length, cx, cy, passoMapa).forEach((xy, j) => {
        ps[j].monte = xy;
        ps[j].rota = xy;
      });
      L.rotulosLado.push({
        x: cx,
        y: cy - raioMonte(ps.length, passoMapa) - 8,
        texto: tipo === "sem" ? t("sem mapa: {km} km", { km: num(q) }) : t("outras cidades: {km} km", { km: num(q) }),
      });
    });

    // margens dos gráficos (semanas, horários, ritmo)
    const g = { l: largo ? 46 : 36, r: largo ? 18 : 10, t: largo ? 40 : 34, b: 26 };
    const area = { x: g.l, y: g.t, w: W - g.l - g.r, h: H - g.t - g.b };
    L.area = area;

    // ---- 3: a grade da meta, uma linha a cada 50 km (30 na tela estreita)
    const colunas = colunasGrade(W);
    const margem = largo ? 44 : 36;
    const topo = 22;
    const nGrade = Math.max(M.meta, n, M.projecao?.pontos || 0);
    const linhas = Math.ceil(nGrade / colunas);
    const pg = Math.min(14, (W - margem - 8) / colunas, (H - topo - 16) / linhas);
    const x0 = (W - (margem + colunas * pg)) / 2 + margem;
    const y0 = topo + Math.max(0, (H - topo - 16 - linhas * pg) / 2);
    L.grade = { colunas, pg, x0, y0, naGrade: (k) => [x0 + ((k % colunas) + 0.5) * pg, y0 + (Math.floor(k / colunas) + 0.5) * pg] };
    L.rGrade = pg * 0.38;
    for (const p of M.pontos) p.grade = L.grade.naGrade(p.k);
    // o nome do mês na linha onde ele começa; pula o mês que cairia colado no anterior
    L.meses = [];
    let ultimaLinha = -1;
    for (const p of M.pontos) {
      if (L.meses.length && L.meses.at(-1).mes === p.mes) continue;
      const linha = Math.floor(p.k / colunas);
      const mostrar = ultimaLinha < 0 || (linha > ultimaLinha && (linha - ultimaLinha) * pg >= 12);
      L.meses.push({ mes: p.mes, linha, mostrar });
      if (mostrar) ultimaLinha = linha;
    }

    // ---- 4: uma coluna por semana, os km empilhados em ordem de data
    {
      const S = M.S;
      const largCol = area.w / S.total;
      const porSemana = Array(S.total).fill(0);
      for (const p of M.pontos) porSemana[p.semana]++;
      const pilha = empilhar(Math.max(...porSemana), largCol, area.h, 10);
      const base = area.y + area.h;
      const cx = (w) => area.x + (w + 0.5) * largCol;
      const vistos = Array(S.total).fill(0);
      for (const p of M.pontos) p.sem7 = naPilha(vistos[p.semana]++, cx(p.semana), base, pilha);
      L.semanas = { largCol, pilha, base, cx, kmAltura: pilha.passo / pilha.porFila, porSemana };
      L.rSemanas = Math.min(pilha.passo * 0.4, 4.5);
    }

    // ---- 5: uma coluna por hora de saída
    {
      const { de, ate } = M.horas;
      const nCol = ate - de + 1;
      const largCol = area.w / nCol;
      const pilha = empilhar(Math.max(...M.horas.porHora.values()), largCol, area.h, 10);
      const base = area.y + area.h;
      const cx = (h) => area.x + (h - de + 0.5) * largCol;
      const vistos = new Map();
      for (const p of M.pontos) {
        const j = vistos.get(p.hora) || 0;
        vistos.set(p.hora, j + 1);
        p.hora7 = naPilha(j, cx(p.hora), base, pilha);
      }
      L.horas = { largCol, pilha, base, cx };
      L.rHoras = Math.min(pilha.passo * 0.4, 4.5);
    }

    // ---- 6: cada km na altura do seu ritmo (mais rápido em cima), ao longo do ano
    {
      const R = M.ritmo;
      const lo = R.rapido;
      const hi = Math.max(R.lento, lo + 60);
      const inicioAno = new Date(M.ano, 0, 1).getTime();
      const diasAno = (new Date(M.ano + 1, 0, 1) - inicioAno) / DIA;
      const x = (d) => area.x + ((d - inicioAno) / DIA / diasAno) * area.w;
      const y = (s) => area.y + ((limitar(s, lo, hi) - lo) / (hi - lo)) * area.h;
      for (const p of M.pontos) {
        // os km do mesmo treino se espalham um pouco na horizontal, para não virarem uma fila só
        const espalhar = (((p.k * 0.618) % 1) - 0.5) * (largo ? 4 : 3);
        p.ritmo7 = [x(p.a.data.getTime()) + espalhar, y(p.ritmo)];
      }
      L.ritmo = { lo, hi, x, y, xSemana: (w) => x(M.S.inicio.getTime() + (w + 0.5) * SEMANA) };
      L.rRitmo = largo ? 2.3 : 1.9;
    }

    // ---- 7: as linhas da previsão, 42 pontos cada
    if (M.previsao) {
      const P = M.previsao;
      const nR = P.raias.length;
      const alturaR = Math.min(largo ? 96 : 78, (H - 62) / nR);
      // as linhas ficam no meio da altura, com espaço em cima para o relógio e a palavra "chegada"
      const topoR = Math.max(largo ? 54 : 46, (H - nR * alturaR) / 2);
      const xi = largo ? 16 : 6;
      const xf = W - (largo ? 28 : 16);
      const passo = (xf - xi) / P.km;
      L.raias = P.raias.map((r, i) => ({ ...r, y: topoR + i * alturaR + alturaR * 0.62, yRotulo: topoR + i * alturaR + alturaR * 0.28 }));
      L.maratona = { xi, xf, passo, xKm: (km) => xi + km * passo, topoR, alturaR };
      L.rRaia = Math.min(passo * 0.36, 4.6);
    }
    prepararExtras();
    desenharRotas();
    return true;
  }

  // as linhas de todas as corridas do ano, num canvas à parte (desenhadas uma vez por tamanho e tema)
  function desenharRotas() {
    camadaRotas = document.createElement("canvas");
    camadaRotas.width = L.W * L.dpr;
    camadaRotas.height = L.H * L.dpr;
    const c = camadaRotas.getContext("2d");
    c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    c.strokeStyle = cores.linha;
    c.lineWidth = 1;
    c.lineJoin = "round";
    c.lineCap = "round";
    for (const a of M.comRota) {
      for (const tr of trechosRota(rotas.get(a.id))) {
        c.beginPath();
        tr.forEach((ll, i) => {
          const [x, y] = L.projLL(ll);
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        });
        c.stroke();
      }
    }
  }

  // --------------------------------------------------------------- capítulos
  // onde cada ponto fica em cada capítulo, e quanto aparece de cada camada de desenho
  const so = (nome, valor = 1) => ({ linhas: 0, montes: 0, meta: 0, semanas: 0, horas: 0, ritmo: 0, maratona: 0, [nome]: valor });
  const PASSOS = {
    rotas: { camadas: so("linhas"), ponto: (p) => ({ x: p.rota[0], y: p.rota[1], r: L.rMapa, al: 0 }) },
    nascer: { camadas: so("linhas", 0.35), ponto: (p) => ({ x: p.rota[0], y: p.rota[1], r: L.rMapa, al: 1 }) },
    montes: { camadas: { ...so("montes"), linhas: 0.12 }, ponto: (p) => ({ x: p.monte[0], y: p.monte[1], r: L.rMapa, al: 1 }) },
    meta: { camadas: so("meta"), ponto: (p) => ({ x: p.grade[0], y: p.grade[1], r: L.rGrade, al: 1 }) },
    semanas: { camadas: so("semanas"), ponto: (p) => ({ x: p.sem7[0], y: p.sem7[1], r: L.rSemanas, al: 1 }) },
    horas: { camadas: so("horas"), ponto: (p) => ({ x: p.hora7[0], y: p.hora7[1], r: L.rHoras, al: 1 }) },
    ritmo: { camadas: so("ritmo"), ponto: (p) => ({ x: p.ritmo7[0], y: p.ritmo7[1], r: L.rRitmo, al: 0.85 }) },
    // os pontos do ano somem onde estão; os das linhas chegam no ritmo de cada previsão
    maratona: { camadas: so("maratona"), ponto: (p) => ({ x: p.x, y: p.y, r: p.r, al: 0 }) },
  };
  // os pontos das linhas, fora do capítulo da previsão, ficam escondidos embaixo do ponto de onde saem
  function alvoExtra(nome, q) {
    if (nome === "maratona") return { x: L.maratona.xKm(q.j - 0.5), y: L.raias[q.raia].y, r: L.rRaia, al: 1 };
    return { ...PASSOS[nome].ponto(q.fonte), al: 0 };
  }

  function aplicar(nome) {
    Object.assign(camadas, PASSOS[nome].camadas);
    for (const p of M.pontos) Object.assign(p, PASSOS[nome].ponto(p));
    for (const q of M.extra) Object.assign(q, alvoExtra(nome, q));
    if (nome === "maratona") M.relogio = M.previsao.meta;
  }

  function animar(sessao, nome, { duracao, atraso = () => 0, minimo = 0, aoQuadro }) {
    const alvo = PASSOS[nome];
    const de = { ...camadas };
    let fim = Math.max(duracao, minimo);
    const todos = [...M.pontos, ...M.extra];
    for (const p of todos) {
      p.de = [p.x, p.y, p.r, p.al];
      p.para = p.raia != null ? alvoExtra(nome, p) : alvo.ponto(p);
      // os pontos das linhas só têm atraso próprio na corrida; nos outros capítulos eles só se escondem
      // (um atraso NaN deixaria a posição NaN para sempre)
      p.atraso = p.raia != null && nome !== "maratona" ? 0 : atraso(p) || 0;
      fim = Math.max(fim, p.atraso + duracao);
    }
    if (!Number.isFinite(fim)) fim = Math.max(duracao, minimo);
    const t0 = performance.now();
    return new Promise((resolver) => {
      const quadro = (agora) => {
        if (sessao !== estado.sessao) return resolver(false);
        const dt = agora - t0;
        const eg = suave(limitar(dt / duracao, 0, 1));
        for (const k in alvo.camadas) camadas[k] = misturar(de[k], alvo.camadas[k], eg);
        for (const p of todos) {
          const e = suave(limitar((dt - p.atraso) / duracao, 0, 1));
          p.x = misturar(p.de[0], p.para.x, e);
          p.y = misturar(p.de[1], p.para.y, e);
          p.r = misturar(p.de[2], p.para.r, e);
          p.al = misturar(p.de[3], p.para.al, e);
        }
        aoQuadro?.(dt);
        desenhar();
        if (dt >= fim) resolver(true);
        else requestAnimationFrame(quadro);
      };
      requestAnimationFrame(quadro);
    });
  }

  async function irPara(cap, { instantaneo = false } = {}) {
    const sessao = ++estado.sessao;
    const antes = estado.cap;
    estado.cap = cap;
    marcarCapitulo();
    const nome = M.caps[cap];
    if (instantaneo || reduzirMovimento()) {
      aplicar(nome);
      desenhar();
      return true;
    }
    const n = Math.max(1, M.pontos.length);
    const frente = cap > antes;
    if (nome === "montes" && M.caps[antes] === "rotas") {
      // os pontos nascem em cima das linhas, em ordem de data, e depois se juntam nos montes
      if (!(await animar(sessao, "nascer", { duracao: 700, atraso: (p) => (p.k / n) * 600 }))) return false;
      return animar(sessao, "montes", { duracao: 1400 });
    }
    if (nome === "meta") return animar(sessao, "meta", { duracao: 900, atraso: (p) => (p.k / n) * (frente ? 1900 : 500) });
    if (nome === "semanas" || nome === "horas" || nome === "ritmo") {
      return animar(sessao, nome, { duracao: 900, atraso: (p) => (p.k / n) * (frente ? 1100 : 400) });
    }
    if (nome === "maratona") {
      // a corrida: cada ponto chega à sua linha quando aquela previsão completa o km; o relógio vai até a meta
      const P = M.previsao;
      const voo = 650;
      M.relogio = 0;
      return animar(sessao, "maratona", {
        duracao: voo,
        minimo: CORRIDA_MS,
        atraso: (p) => (p.raia == null ? 0 : Math.max(0, ((p.j * p.ritmo) / P.meta) * CORRIDA_MS - voo)),
        aoQuadro: (dt) => (M.relogio = Math.min(P.meta, (dt / CORRIDA_MS) * P.meta)),
      });
    }
    return animar(sessao, nome, { duracao: 1000 });
  }

  // ---------------------------------------------------------------- desenho
  function texto(str, x, y, { cor = cores.fraco, peso = 500, tam = 11, alinhar = "left", base = "middle" } = {}) {
    ctx.font = `${peso} ${tam}px ${cores.fonte}`;
    ctx.fillStyle = cor;
    ctx.textAlign = alinhar;
    ctx.textBaseline = base;
    ctx.fillText(str, x, y);
  }
  function linhaH(x1, x2, y, { cor = cores.grade, larg = 1, traco = null } = {}) {
    ctx.strokeStyle = cor;
    ctx.lineWidth = larg;
    ctx.setLineDash(traco || []);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // texto por cima dos pontos, com um fundo para não se perder no meio deles
  function rotuloComFundo(str, x, y, { cor = cores.texto, alinhar = "right" } = {}) {
    ctx.font = `700 11px ${cores.fonte}`;
    const larg = ctx.measureText(str).width;
    const x0 = alinhar === "right" ? x - larg : alinhar === "center" ? x - larg / 2 : x;
    const al = ctx.globalAlpha;
    ctx.globalAlpha = al * 0.85;
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(x0 - 4, y - 8, larg + 8, 16);
    ctx.globalAlpha = al;
    texto(str, x, y, { cor, peso: 700, alinhar });
  }
  function anel(x, y, r, cor, larg = 1) {
    ctx.strokeStyle = cor;
    ctx.lineWidth = larg;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.stroke();
  }

  function desenhar() {
    ctx.clearRect(0, 0, L.W, L.H);
    if (camadas.linhas > 0.01) {
      ctx.globalAlpha = camadas.linhas;
      ctx.drawImage(camadaRotas, 0, 0, L.W, L.H);
    }
    const fundos = { meta: desenharGrade, semanas: desenharSemanas, horas: desenharHoras, ritmo: desenharEixosRitmo, maratona: desenharRaias };
    for (const [k, f] of Object.entries(fundos)) {
      if (camadas[k] > 0.01) {
        ctx.globalAlpha = camadas[k];
        f();
      }
    }
    if (camadas.montes > 0.01) {
      ctx.globalAlpha = camadas.montes;
      for (const r of L.rotulosLado) texto(r.texto, r.x, r.y, { cor: cores.texto2, peso: 600, tam: 12, alinhar: "center", base: "alphabetic" });
    }
    for (const p of M.pontos) desenharPonto(p);
    for (const q of M.extra) desenharPonto(q);
    // o que fica por cima dos pontos
    if (camadas.semanas > 0.01) {
      ctx.globalAlpha = camadas.semanas;
      desenharMediaSemanas();
    }
    if (camadas.ritmo > 0.01) {
      ctx.globalAlpha = camadas.ritmo;
      desenharLinhasRitmo();
    }
    if (camadas.maratona > 0.01) {
      ctx.globalAlpha = camadas.maratona;
      desenharChegada();
    }
    ctx.globalAlpha = 1;
  }

  function desenharPonto(p) {
    if (p.al < 0.02 || p.r < 0.2) return;
    ctx.globalAlpha = p.al;
    ctx.fillStyle = corDe(p);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // altura da linha da meta na margem esquerda (no degrau, é a parte de baixo)
  const yMeta = () => L.grade.y0 + (Math.floor(M.meta / L.grade.colunas) + (M.meta % L.grade.colunas ? 1 : 0)) * L.grade.pg;

  // capítulo 3: os círculos que faltam para a meta, a projeção do ano, a linha da meta e os meses
  function desenharGrade() {
    const { pg, colunas, x0, y0, naGrade } = L.grade;
    const n = M.pontos.length;
    for (let k = n; k < M.meta; k++) anel(...naGrade(k), L.rGrade - 0.5, cores.trilha);
    if (M.projecao) {
      // a projeção: anéis na cor dos pontos, mais fracos
      const al = ctx.globalAlpha;
      ctx.globalAlpha = al * 0.75;
      for (let k = n; k < M.projecao.pontos; k++) anel(...naGrade(k), L.rGrade - 0.6, cores.a, 1.2);
      ctx.globalAlpha = al;
    }
    if (M.meta) {
      // degrau entre o último ponto da meta e o primeiro além dela
      const q = Math.floor(M.meta / colunas);
      const resto = M.meta % colunas;
      ctx.strokeStyle = cores.texto2;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      if (resto === 0) {
        ctx.moveTo(x0, y0 + q * pg);
        ctx.lineTo(x0 + colunas * pg, y0 + q * pg);
      } else {
        ctx.moveTo(x0, y0 + (q + 1) * pg);
        ctx.lineTo(x0 + resto * pg, y0 + (q + 1) * pg);
        ctx.lineTo(x0 + resto * pg, y0 + q * pg);
        ctx.lineTo(x0 + colunas * pg, y0 + q * pg);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // o rótulo vai na margem, na altura da linha: dentro da grade, os pontos o cobririam
      texto(t("grade|meta"), x0 - 8, yMeta(), { cor: cores.texto2, peso: 700, alinhar: "right" });
    }
    for (const m of L.meses) {
      const y = y0 + (m.linha + 0.5) * pg;
      if (m.mostrar && !(M.meta && Math.abs(y - yMeta()) < pg * 0.9)) texto(MESES_CURTOS[m.mes], x0 - 8, y, { alinhar: "right" });
    }
  }

  // marcas dos meses embaixo de um gráfico que vai de janeiro a dezembro
  function mesesEmbaixo(xDoDia) {
    const { area } = L;
    const cada = L.largo ? 1 : 2;
    for (let m = 0; m < 12; m += cada) {
      const x = xDoDia(new Date(M.ano, m, 1).getTime());
      texto(MESES_CURTOS[m], x, area.y + area.h + 14, { alinhar: "left" });
    }
  }
  // linhas de grade horizontais em km (10 em 10, ou 20 em 20), com o rótulo na margem esquerda
  function gradeKm(base, kmAltura, maxKm) {
    const { area } = L;
    const passo = maxKm > 60 ? 20 : 10;
    for (let v = passo; v <= maxKm; v += passo) {
      const y = base - v * kmAltura;
      if (y < area.y - 4) break;
      linhaH(area.x, area.x + area.w, y);
      texto(`${v} km`, area.x - 6, y, { alinhar: "right" });
    }
  }

  // capítulo 4: a grade em km, as semanas sem corrida, a média e a maior sequência
  function desenharSemanas() {
    const { area } = L;
    const { largCol, base, cx, kmAltura } = L.semanas;
    const S = M.S;
    const R = M.semanas;
    gradeKm(base, kmAltura, Math.max(...S.km));
    linhaH(area.x, area.x + area.w, base, { cor: cores.trilha });
    mesesEmbaixo((d) => area.x + ((d - S.inicio.getTime()) / SEMANA) * largCol);
    // semana sem corrida: um anel vazio no chão
    for (let w = S.primeira; w <= S.ate; w++) if (!S.km[w]) anel(cx(w), base - L.rSemanas - 1.5, L.rSemanas - 0.3, cores.trilha);
    // a maior sequência: um colchete logo acima da coluna mais alta dela
    if (R.maior.n > 1) {
      const de = R.maior.ate - R.maior.n + 1;
      const x1 = cx(de) - largCol * 0.4;
      const x2 = cx(R.maior.ate) + largCol * 0.4;
      const { pilha, porSemana } = L.semanas;
      const filas = Math.max(...porSemana.slice(de, R.maior.ate + 1).map((q) => Math.ceil(q / pilha.porFila)));
      const y = Math.max(area.y - 14, base - filas * pilha.passo - 14);
      ctx.strokeStyle = cores.texto2;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y + 5);
      ctx.lineTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.lineTo(x2, y + 5);
      ctx.stroke();
      const rot = t("{n} semanas seguidas", { n: R.maior.n });
      ctx.font = `700 11px ${cores.fonte}`;
      const larg = ctx.measureText(rot).width;
      const meio = limitar((x1 + x2) / 2, larg / 2 + 2, L.W - larg / 2 - 2);
      texto(rot, meio, y - 9, { cor: cores.texto2, peso: 700, alinhar: "center" });
    }
  }

  // capítulo 4, por cima dos pontos: a média por semana
  function desenharMediaSemanas() {
    const { area } = L;
    const y = L.semanas.base - M.semanas.media * L.semanas.kmAltura;
    linhaH(area.x, area.x + area.w, y, { cor: cores.texto, larg: 1.5, traco: [5, 4] });
    rotuloComFundo(t("média: {km} km", { km: num(M.semanas.media) }), area.x + 6, y - 11, { alinhar: "left" });
  }

  // capítulo 5: as horas embaixo e o horário que mais rende
  function desenharHoras() {
    const { area } = L;
    const { largCol, base, cx, pilha } = L.horas;
    const { de, ate, porHora, pico } = M.horas;
    linhaH(area.x, area.x + area.w, base, { cor: cores.trilha });
    const cada = largCol >= 26 ? 1 : largCol >= 13 ? 2 : 3;
    for (let h = de; h <= ate; h++) {
      if ((h - de) % cada && h !== pico.hora) continue;
      // a hora vizinha do pico some, para os dois rótulos não se encostarem
      if (h !== pico.hora && Math.abs(h - pico.hora) < cada) continue;
      texto(rotuloHora(h), cx(h), base + 14, { alinhar: "center", peso: h === pico.hora ? 700 : 500, cor: h === pico.hora ? cores.texto2 : cores.fraco });
    }
    const filas = Math.ceil((porHora.get(pico.hora) || 0) / pilha.porFila);
    texto(`${num(pico.n)} km`, cx(pico.hora), base - filas * pilha.passo - 10, { cor: cores.texto2, peso: 700, alinhar: "center" });
  }

  // capítulo 6, por baixo dos pontos: o eixo do ritmo e os meses
  function desenharEixosRitmo() {
    const { area } = L;
    const { lo, hi, y } = L.ritmo;
    const passo = hi - lo > 200 ? 60 : 30;
    for (let s = Math.ceil(lo / passo) * passo; s <= hi; s += passo) {
      linhaH(area.x, area.x + area.w, y(s));
      texto(relogio(s), area.x - 6, y(s), { alinhar: "right" });
    }
    texto(`↑ ${t("mais rápido")}`, 4, area.y - 20, { peso: 600 });
    linhaH(area.x, area.x + area.w, area.y + area.h, { cor: cores.trilha });
    mesesEmbaixo(L.ritmo.x);
  }

  // capítulo 6, por cima dos pontos: a mediana de 4 semanas e o ritmo da meta
  function desenharLinhasRitmo() {
    const { area } = L;
    const R = M.ritmo;
    if (R.metaRitmo && R.metaRitmo >= L.ritmo.lo && R.metaRitmo <= L.ritmo.hi) {
      const y = L.ritmo.y(R.metaRitmo);
      linhaH(area.x, area.x + area.w, y, { cor: cores.prova, larg: 1.5, traco: [6, 4] });
    }
    if (R.movel.length > 1) {
      // uma borda da cor do fundo por baixo, para a linha não se perder no meio dos pontos
      for (const [cor, larg] of [[cores.fundo, 5], [cores.texto, 2]]) {
        ctx.strokeStyle = cor;
        ctx.lineWidth = larg;
        ctx.lineJoin = "round";
        ctx.beginPath();
        R.movel.forEach(([w, s], i) => {
          const x = L.ritmo.xSemana(w);
          if (i) ctx.lineTo(x, L.ritmo.y(s));
          else ctx.moveTo(x, L.ritmo.y(s));
        });
        ctx.stroke();
      }
    }
    if (R.metaRitmo && R.metaRitmo >= L.ritmo.lo && R.metaRitmo <= L.ritmo.hi) {
      rotuloComFundo(t("meta {r}", { r: relogio(R.metaRitmo) }), area.x + area.w - 2, L.ritmo.y(R.metaRitmo) - 11);
    }
  }

  // capítulo 7, por baixo dos pontos: os rótulos de cada linha, os 42 anéis e a chegada
  function desenharRaias() {
    const { xKm } = L.maratona;
    const P = M.previsao;
    for (const r of L.raias) {
      texto(r.rotulo, L.maratona.xi, r.yRotulo, { cor: r.meta ? cores.texto : cores.texto2, peso: r.meta ? 700 : 600, tam: L.largo ? 12 : 11 });
      for (let j = 1; j <= Math.floor(P.km); j++) anel(xKm(j - 0.5), r.y, L.rRaia - 0.4, cores.trilha);
    }
    // a chegada
    const xc = xKm(P.km);
    ctx.strokeStyle = cores.texto2;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xc, L.maratona.topoR + 4);
    ctx.lineTo(xc, L.raias.at(-1).y + 10);
    ctx.stroke();
    texto(t("chegada"), xc + 1, L.maratona.topoR - 6, { cor: cores.texto2, peso: 600, alinhar: "right" });
    // o relógio da prova, em cima da chegada
    texto(relogio(M.relogio), xc + 1, L.maratona.topoR - 26, { cor: cores.texto, peso: 700, tam: L.largo ? 15 : 13, alinhar: "right" });
  }

  // capítulo 7, por cima: onde cada previsão está quando a meta cruza a chegada
  function desenharChegada() {
    const P = M.previsao;
    if (M.relogio < P.meta - 0.5) return;
    for (const r of L.raias) {
      if (r.meta) continue;
      if (r.tempo <= P.meta + 0.5) {
        texto(t("{t} antes da meta", { t: relogio(P.meta - r.tempo) }), L.maratona.xKm(P.km), r.y + 18, { cor: cores.texto2, peso: 700, alinhar: "right" });
      } else {
        const x = L.maratona.xKm(r.naMeta);
        ctx.strokeStyle = cores.texto;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, r.y - 9);
        ctx.lineTo(x, r.y + 9);
        ctx.stroke();
        texto(t("km {km}", { km: num(r.naMeta, 1) }), x, r.y + 18, { cor: cores.texto, peso: 700, alinhar: "center" });
      }
    }
  }

  // ------------------------------------------------------------------ textos
  const TITULOS = {
    rotas: () => t("Rotas"),
    montes: () => t("Quilômetros"),
    meta: () => (M.meta ? t("Meta") : t("O ano")),
    semanas: () => t("Semanas"),
    horas: () => t("Horários"),
    ritmo: () => t("Ritmo"),
    maratona: () => t("Previsão"),
  };

  function textos(nome) {
    const ano = estado.ano;
    const n = M.pontos.length;
    if (nome === "rotas") {
      return [t("{n} corridas com GPS em {ano}, desenhadas uma por cima da outra. O trecho mais repetido aparece em {r} delas, mas no mapa de linhas parece igual a um trecho feito uma vez.", { n: num(M.comRota.length), ano, r: num(M.repetido) })];
    }
    if (nome === "montes") {
      return [
        [
          t("Cada ponto é 1 km, juntado perto de onde foi corrido: quanto maior o monte, mais vezes o trecho foi corrido."),
          M.sem ? t("{n} km não têm mapa: esteira ou treino sem GPS.", { n: num(M.sem) }) : "",
          M.fora ? t("{n} km foram em outras cidades.", { n: num(M.fora) }) : "",
        ].filter(Boolean).join(" "),
      ];
    }
    if (nome === "meta") {
      const linha = t("Cada linha tem {n} km.", { n: colunasGrade(tela.clientWidth) });
      let base;
      if (!M.meta) base = t("Em ordem de data, os {n} km de {ano}.", { n: num(n), ano });
      else if (M.batida) base = t("Em ordem de data, os pontos enchem a meta de {meta} km, batida em {data}. Já são {extra} km além dela.", { meta: num(M.meta), data: dataLonga(M.batida), extra: num(n - M.meta) });
      else base = t("Em ordem de data, os pontos já enchem {p}% da meta de {meta} km. Os círculos vazios são os {faltam} km que faltam.", { p: num(Math.floor((n / M.meta) * 100)), meta: num(M.meta), faltam: num(M.meta - n) });
      const saida = [`${base} ${linha}`];
      const P = M.projecao;
      if (P && P.porSemana > 0) {
        if (P.chegada) saida.push(t("No ritmo das últimas 8 semanas ({s} km por semana), a meta chega em {data}, e o ano fecha perto de {km} km: são os anéis laranja.", { s: num(P.porSemana), data: dataCurta(P.chegada), km: num(Math.round(P.total / 10) * 10) }));
        else saida.push(t("No ritmo das últimas 8 semanas ({s} km por semana), {ano} fecha perto de {km} km: são os anéis laranja.", { s: num(P.porSemana), ano, km: num(Math.round(P.total / 10) * 10) }));
      }
      return saida;
    }
    if (nome === "semanas") {
      const R = M.semanas;
      const frases = [
        t("Agora cada coluna é uma semana, de segunda a domingo."),
        M.S.primeira > 0
          ? t("Desde a primeira corrida, você correu em {com} de {total} semanas.", { com: num(R.com), total: num(R.total) })
          : M.atual
            ? t("Você correu em {com} das {total} semanas de {ano} até agora.", { com: num(R.com), total: num(R.total), ano })
            : t("Você correu em {com} das {total} semanas de {ano}.", { com: num(R.com), total: num(R.total), ano }),
      ];
      if (R.maior.n > 1) frases.push(R.continua ? t("A maior sequência é a de agora: {n} semanas seguidas.", { n: R.maior.n }) : t("A maior sequência foi de {n} semanas seguidas.", { n: R.maior.n }));
      const saida = [frases.join(" ")];
      const segunda = [t("A média é de {m} km por semana; a mais forte, a de {data}, teve {km} km.", { m: num(R.media), data: dataCurta(R.forte.data), km: num(R.forte.km) })];
      if (R.acima40 && R.acima40Antes != null) segunda.push(t("Foram {n} semanas acima de 40 km, contra {m} em {antes}.", { n: num(R.acima40), m: num(R.acima40Antes), antes: M.ano - 1 }));
      saida.push(segunda.join(" "));
      return saida;
    }
    if (nome === "horas") {
      const H = M.horas;
      const frases = [t("Cada coluna é a hora em que a corrida começou. O horário que mais rende é {h}, com {km} km.", { h: rotuloHora(H.pico.hora), km: num(H.pico.n) })];
      const p = Math.round(H.cedo * 100);
      if (p > 0) {
        frases.push(H.cedoAntes != null
          ? t("{p}% dos km de {ano} saíram antes das 7h; em {antes}, foram {q}%.", { p, ano, antes: M.ano - 1, q: Math.round(H.cedoAntes * 100) })
          : t("{p}% dos km de {ano} saíram antes das 7h.", { p, ano }));
      }
      frases.push(t("O dia que mais rende é {dia}: {km} km no ano.", { dia: H.dia.nome, km: num(H.dia.km) }));
      return [frases.join(" ")];
    }
    if (nome === "ritmo") {
      const R = M.ritmo;
      const saida = [t("Cada ponto sobe conforme o ritmo daquele km: quanto mais alto, mais rápido. A linha cheia é a mediana das últimas 4 semanas.")];
      if (R.primeiro && R.ultimo && R.primeiro !== R.ultimo) {
        let s = t("O km típico de {m1} saiu a {r1}; o de {m2}, a {r2}.", { m1: MESES_LONGOS[R.primeiro.mes], r1: ritmoTexto(R.primeiro.mediana), m2: MESES_LONGOS[R.ultimo.mes], r2: ritmoTexto(R.ultimo.mediana) });
        if (R.metaRitmo && R.naMeta != null) s += ` ${t("A linha tracejada é o ritmo da meta da {prova} ({r}): em {m2}, {p}% dos km já foram mais rápidos que ela.", { prova: alvo.nome, r: ritmoTexto(R.metaRitmo), m2: MESES_LONGOS[R.ultimo.mes], p: Math.round(R.naMeta * 100) })}`;
        saida.push(s);
      }
      return saida;
    }
    if (nome === "maratona") {
      const P = M.previsao;
      const nomeR = (r) => nomeDist(r.nome).toLowerCase();
      const previsoesR = P.raias.filter((r) => !r.meta);
      const dentro = previsoesR.filter((r) => r.tempo <= P.meta + 0.5);
      const fora = previsoesR.filter((r) => r.tempo > P.meta + 0.5);
      const juntar = (lista) => new Intl.ListFormat(LOCALE, { type: "conjunction" }).format(lista.map(nomeR));
      const saida = [t("Faltam {s} semanas para a {prova}. Cada linha tem um ponto por km e corre no ritmo de uma previsão: a meta e o que a fórmula de Riegel tira dos seus melhores tempos dos últimos 12 meses.", { s: num(P.semanas), prova: alvo.nome })];
      let resultado;
      if (fora.length && dentro.length) {
        const lenta = fora.reduce((a, b) => (b.naMeta < a.naMeta ? b : a));
        resultado = [
          dentro.length > 1 ? t("Com os seus tempos de {d}, a chegada vem antes da meta.", { d: juntar(dentro) }) : t("Com o seu tempo de {d}, a chegada vem antes da meta.", { d: juntar(dentro) }),
          fora.length > 1
            ? t("Com os de {d}, ainda não: quando a meta cruza a chegada, a mais lenta está no km {km}.", { d: juntar(fora), km: num(lenta.naMeta, 1) })
            : t("Com o de {d}, ainda não: quando a meta cruza a chegada, essa linha está no km {km}.", { d: juntar(fora), km: num(lenta.naMeta, 1) }),
        ].join(" ");
        // as distâncias curtas dentro da meta e as longas fora: falta resistência, não velocidade
        if (Math.max(...dentro.map((r) => DIST_M[r.nome])) < Math.min(...fora.map((r) => DIST_M[r.nome]))) resultado += ` ${t("A velocidade já existe; falta ela durar 42 km. A conta fica mais confiável quanto mais longa a distância de partida.")}`;
      } else if (dentro.length) {
        resultado = t("Todas as previsões chegam antes da meta, a melhor com {d} de folga. A fórmula costuma ser otimista na maratona: vale como tendência, não como promessa.", { d: relogio(P.meta - P.melhorAgora) });
      }
      else resultado = t("Quando a meta cruza a chegada, a melhor previsão ainda está no km {km}.", { km: num(Math.max(...fora.map((r) => r.naMeta)), 1) });
      saida.push(resultado);
      const fim = [];
      if (P.melhorAntes) fim.push(t("Há um ano, a melhor previsão era {antes}; hoje é {agora}.", { antes: relogio(P.melhorAntes), agora: relogio(P.melhorAgora) }));
      if (P.porSemana > 0) fim.push(t("No ritmo das últimas 12 semanas ({s} km por semana), são mais uns {km} km até a largada.", { s: num(P.porSemana), km: num(Math.round(P.ateLargada / 10) * 10) }));
      if (fim.length) saida.push(fim.join(" "));
      return saida;
    }
    return [];
  }

  // a legenda de cada capítulo fica junto do texto que a explica
  function chave(nome) {
    const bola = (cor, extra = "") => `<i style="background:${cor}${extra}"></i>`;
    const itens = [];
    const treino = `<li>${bola(cores.a)}${bola(cores.b, ";margin-left:-.25rem")}${esc(t("treino (os meses alternam o tom)"))}</li>`;
    const prova = M.pontos.some((p) => p.prova) ? `<li>${bola(cores.prova)}${esc(t("prova"))}</li>` : "";
    if (nome === "montes" || nome === "meta") itens.push(treino, prova);
    if (nome === "meta") {
      if (M.meta && M.pontos.length < M.meta) itens.push(`<li><i class="anel"></i>${esc(t("falta para a meta"))}</li>`);
      if (M.projecao?.porSemana > 0) itens.push(`<li><i class="anel" style="border-color:${cores.a}"></i>${esc(t("projeção até 31 dez"))}</li>`);
    }
    if (nome === "semanas") itens.push(`<li><i class="traco"></i>${esc(t("média por semana"))}</li>`, `<li><i class="anel"></i>${esc(t("semana sem corrida"))}</li>`);
    if (nome === "ritmo") {
      itens.push(`<li><i class="linha"></i>${esc(t("mediana de 4 semanas"))}</li>`);
      if (M.ritmo.metaRitmo) itens.push(`<li><i class="traco" style="border-color:${cores.prova}"></i>${esc(t("ritmo da meta"))}</li>`);
    }
    if (nome === "maratona") itens.push(`<li>${bola(cores.prova)}${esc(t("meta"))}</li>`, `<li>${bola(cores.a)}${esc(t("previsão"))}</li>`, `<li><i class="anel"></i>${esc(t("km que ainda falta"))}</li>`);
    return itens.filter(Boolean).length ? `<ul class="pontos-chave">${itens.join("")}</ul>` : "";
  }

  function montarCapitulos() {
    $(".historia-capitulos", el).innerHTML = M.caps
      .map((nome, i) => `
        <section class="capitulo" data-cap="${i}" aria-labelledby="cap-${i}">
          <h3 id="cap-${i}"><span class="numero">${i + 1}</span>${esc(TITULOS[nome]())}</h3>
          ${textos(nome).map((p) => `<p>${esc(p)}</p>`).join("")}
          ${chave(nome)}
        </section>`)
      .join("");
    $(".historia-marcas", el).innerHTML = M.caps
      .map((nome, i) => `<li><button type="button" data-cap="${i}" aria-label="${esc(`${i + 1}. ${TITULOS[nome]()}`)}"></button></li>`)
      .join("");
    marcarCapitulo();
  }

  function marcarCapitulo() {
    $$(".capitulo", el).forEach((c) => c.classList.toggle("ativo", Number(c.dataset.cap) === estado.cap));
    $$(".historia-marcas button", el).forEach((b) => b.setAttribute("aria-current", Number(b.dataset.cap) === estado.cap ? "step" : "false"));
  }

  function montarAnos() {
    abas($(".pontos-anos", el), anos.map((a) => ({ valor: a, rotulo: a })), estado.ano, (v) => {
      estado.ano = v;
      prepararAno();
      montarCapitulos();
      preencherTabela();
      if (calcular()) {
        medirLinha();
        estado.cap = capituloNaLinha();
        irPara(estado.cap, { instantaneo: true });
      }
    });
  }

  // a mesma informação em tabela, para quem não vê o desenho
  function preencherTabela() {
    const meses = Array.from({ length: 12 }, () => ({ n: 0, m: 0 }));
    for (const a of M.corridas) {
      meses[a.data.getMonth()].n += 1;
      meses[a.data.getMonth()].m += a.m;
    }
    let acumulado = 0;
    const linhas = meses
      .map((g, i) => {
        if (!g.n) return "";
        acumulado += g.m;
        const ritmo = M.ritmo && mediana(M.pontos.filter((p) => p.mes === i).map((p) => p.ritmo));
        return `<tr><td>${MESES_CURTOS[i]}</td><td class="num">${num(g.n)}</td><td class="num">${num(g.m / 1000, 1)}</td><td class="num">${num(acumulado / 1000, 1)}</td><td class="num">${ritmo ? relogio(ritmo) : "–"}</td></tr>`;
      })
      .join("");
    $(".pontos-tabela div", el).innerHTML = `<table class="resultados"><thead><tr><th>${esc(t("Mês"))}</th><th class="num">${esc(t("Corridas"))}</th><th class="num">km</th><th class="num">${esc(t("Acumulado (km)"))}</th><th class="num">${esc(t("Km típico (/km)"))}</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }

  // ------------------------------------------------------------ rolagem
  // O capítulo ativo é o último cujo topo já passou de uma linha imaginária: no meio da tela no
  // computador; no celular, logo abaixo do desenho, que fica parado em cima.
  let linhaY = 0;
  const empilhado = () => matchMedia("(max-width: 900px)").matches;
  function medirLinha() {
    const topo = $(".topo");
    el.style.setProperty("--historia-topo", `${(topo?.offsetHeight || 0) + (empilhado() ? 0 : 16)}px`);
    if (empilhado()) {
      const fundo = (parseFloat(getComputedStyle(figura).top) || 0) + figura.offsetHeight;
      linhaY = fundo + (innerHeight - fundo) * 0.35;
    } else linhaY = innerHeight * 0.45;
  }
  function capituloNaLinha() {
    let ativo = 0;
    $$(".capitulo", el).forEach((c, i) => {
      if (c.getBoundingClientRect().top <= linhaY) ativo = i;
    });
    return ativo;
  }
  let pedido = 0;
  addEventListener("scroll", () => {
    if (naDica) mostrarDica(null);
    if (pedido || !L) return;
    pedido = requestAnimationFrame(() => {
      pedido = 0;
      const cap = capituloNaLinha();
      if (cap !== estado.cap) irPara(cap);
    });
  }, { passive: true });

  // os botõezinhos levam ao capítulo: rola até ele passar da linha
  el.addEventListener("click", (ev) => {
    const b = ev.target.closest(".historia-marcas button");
    if (!b) return;
    const c = $(`.capitulo[data-cap="${b.dataset.cap}"]`, el);
    scrollTo({ top: scrollY + c.getBoundingClientRect().top - linhaY + 4, behavior: reduzirMovimento() ? "instant" : "smooth" });
  });

  // ------------------------------------------------------------ interação
  function pontoEm(ev) {
    const caixa = canvas.getBoundingClientRect();
    const x = ev.clientX - caixa.left;
    const y = ev.clientY - caixa.top;
    let melhor = null;
    let menor = Infinity;
    for (const p of [...M.pontos, ...M.extra]) {
      if (p.al < 0.5) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < menor) {
        menor = d;
        melhor = p;
      }
    }
    return melhor && menor <= Math.max(9, melhor.r * 2.2) ? melhor : null;
  }

  function linhasDaDica(p) {
    if (p.raia != null) {
      const r = M.previsao.raias[p.raia];
      return [r.rotulo, t("km {km} em {t}", { km: p.j, t: relogio(p.j * r.ritmo) }), ritmoTexto(r.ritmo)];
    }
    const a = p.a;
    const linhas = [a.prova ? `${a.n} (${t("prova")})` : a.n, dataLonga(a.data), `${distTreino(a.m)}, ${pace(a.m, a.s)}`];
    const nome = M.caps[estado.cap];
    if (nome === "ritmo") linhas.push(t("este km: {r}", { r: ritmoTexto(p.ritmo) }));
    else if (nome === "semanas") linhas.push(t("semana de {data}: {km} km", { data: dataCurta(new Date(M.S.inicio.getTime() + p.semana * SEMANA)), km: num(M.S.km[p.semana]) }));
    else if (nome === "horas") linhas.push(t("saiu às {h}", { h: hora(a.data) }));
    else linhas.push(t("{k}º km de {ano}", { k: num(p.k + 1), ano: estado.ano }));
    return linhas;
  }

  let naDica = null;
  function mostrarDica(p, ev) {
    naDica = p;
    if (!p) {
      dica.classList.remove("visivel");
      return;
    }
    dica.textContent = linhasDaDica(p).join("\n");
    dica.classList.add("visivel");
    const r = dica.getBoundingClientRect();
    let left = ev.clientX + 14;
    let top = ev.clientY - r.height - 12;
    if (left + r.width > innerWidth - 8) left = ev.clientX - r.width - 14;
    if (top < 8) top = ev.clientY + 18;
    dica.style.left = `${Math.max(8, left)}px`;
    dica.style.top = `${top}px`;
  }

  let jaMostrava = false;
  canvas.addEventListener("pointermove", (ev) => {
    if (ev.pointerType === "touch") return;
    const p = pontoEm(ev);
    canvas.style.cursor = p && p.raia == null ? "pointer" : "";
    mostrarDica(p, ev);
  });
  canvas.addEventListener("pointerleave", () => mostrarDica(null));
  canvas.addEventListener("pointerdown", (ev) => {
    const p = pontoEm(ev);
    jaMostrava = !!p && p === naDica;
    if (ev.pointerType === "touch") mostrarDica(p, ev);
  });
  // no mouse, um clique abre o treino; no toque, o primeiro mostra a dica e o segundo abre
  canvas.addEventListener("click", (ev) => {
    const p = pontoEm(ev);
    if (!p || p.raia != null) return;
    if (ev.pointerType === "touch" && !jaMostrava) return;
    location.href = linkTreino(p.a.id);
  });

  // ----------------------------------------------------------------- início
  lerCores();
  prepararAno();
  montarAnos();
  montarCapitulos();
  preencherTabela();
  let medida = "";
  const refazer = () => {
    medirLinha();
    const nova = `${tela.clientWidth}x${tela.clientHeight}`;
    if (nova === medida || !calcular()) return;
    medida = nova;
    estado.cap = capituloNaLinha();
    irPara(estado.cap, { instantaneo: true });
  };
  (document.fonts?.ready || Promise.resolve()).then(() => {
    refazer();
    new ResizeObserver(refazer).observe(tela);
    addEventListener("resize", medirLinha);
  });
  aoMudarTema(() => {
    lerCores();
    montarCapitulos();
    if (calcular()) irPara(estado.cap, { instantaneo: true });
  });
}
