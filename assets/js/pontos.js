// Cada quilômetro, um ponto.
//
// As corridas de um ano viram um ponto por km, e a animação mostra em três passos o que um mapa de
// linhas esconde (a ideia vem de "Land doesn't vote, people do", de Karim Douieb, e das versões
// animadas de David Zumbach e Caio Yamamoto Lellis):
//   1. Rotas: as linhas, uma por cima da outra. Um trecho feito 40 vezes parece igual a um feito uma vez.
//   2. Quilômetros: cada km vira um ponto, juntado num monte perto de onde foi corrido. O tamanho do
//      monte mostra a repetição. Os km sem mapa (esteira, sem GPS, perto de casa) ficam num monte à parte.
//   3. Meta: em ordem de data, os pontos enchem a meta do ano (perfil.json, meta_anual_km).
//
// Os pontos vêm de data/pontos.json (scripts/sync_strava.py, montar_pontos); as linhas, de data/rotas.json,
// que já vêm sem as pontas e sem as zonas de privacidade. Tudo é desenhado num <canvas>: são ~1.300
// pontos, leves até no celular. Com "reduzir movimento" ligado no sistema não há animação: cada passo
// aparece pronto e a seção abre no último.
import {
  $, $$, abas, aoMudarTema, aoRedimensionar, dataLonga, distTreino, esc, linkTreino, MESES_CURTOS, num, pace,
  reduzirMovimento, t, trechosRota,
} from "./comum.js";

const M_LAT = 110540; // metros por grau de latitude (o mesmo de montar_pontos)
const M_LNG = 111320; // metros por grau de longitude, vezes o cosseno da latitude
const CELULA_MONTE = 450; // metros: os pontos dentro do mesmo quadrado formam um monte
const CELULA_TRECHO = 300; // metros: para contar quantas corridas passaram pelo mesmo trecho
const OURO = Math.PI * (3 - Math.sqrt(5)); // ângulo de ouro: espalha os pontos como sementes de girassol

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const misturar = (a, b, e) => a + (b - a) * e;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

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

function metaDoAno(perfil, ano) {
  const m = perfil?.meta_anual_km;
  return Number(m?.[ano] ?? (typeof m === "number" ? m : 0)) || 0;
}

export function montarPontos(el, { atividades, pontos, rotas, perfil }) {
  if (!el || !pontos?.mapa || !Object.keys(pontos.anos || {}).length) {
    if (el) el.hidden = true;
    return;
  }
  const porId = new Map(atividades.map((a) => [a.id, a]));
  const anos = Object.keys(pontos.anos).sort((a, b) => b - a);
  const anoAtual = String(new Date().getFullYear());
  const temPontos = (a) => pontos.anos[a].pontos.length >= 50;
  const estado = {
    ano: (temPontos(anoAtual) && anoAtual) || anos.find(temPontos) || anos[0],
    passo: reduzirMovimento() ? 2 : 0,
    sessao: 0, // cada ordem nova (clique, troca de ano) aumenta; animações antigas param sozinhas
    jaTocou: false,
  };

  el.innerHTML = `
    <div class="pontos">
      <div class="pontos-lado">
        <div class="abas pontos-anos" role="group" aria-label="${esc(t("Ano"))}"></div>
        <ol class="pontos-passos"></ol>
        <p class="pontos-texto" aria-live="polite"></p>
        <ul class="pontos-chave"></ul>
        <button type="button" class="mais pontos-repetir">${esc(t("Ver de novo"))}</button>
      </div>
      <div class="pontos-tela"><canvas></canvas></div>
    </div>
    <details class="pontos-tabela"><summary>${esc(t("Ver os números mês a mês"))}</summary><div></div></details>`;
  const tela = $(".pontos-tela", el);
  const canvas = $("canvas", el);
  const ctx = canvas.getContext("2d");
  const dica = document.createElement("div");
  dica.className = "dica";
  dica.setAttribute("role", "tooltip");
  document.body.append(dica);

  let M; // o ano escolhido
  let L; // medidas e posições na largura atual
  let cores;
  let camadaRotas;
  const camadas = { linhas: 1, montes: 0, grade: 0 };

  // ------------------------------------------------------------ dados do ano
  function prepararAno() {
    const d = pontos.anos[estado.ano];
    const lista = [];
    d.pontos.forEach((p, k) => {
      const a = porId.get(d.ids[p[0]]);
      if (!a) return;
      lista.push({ k, a, mes: a.data.getMonth(), prova: !!a.prova, tipo: p.length === 3 ? "mapa" : p.length === 2 ? "fora" : "sem", mx: p[1], my: p[2], x: 0, y: 0, r: 0, al: 0 });
    });
    const corridas = atividades.filter((a) => String(a.ano) === estado.ano);
    const comRota = corridas.filter((a) => rotas.has(a.id));
    const meta = metaDoAno(perfil, estado.ano);
    M = {
      pontos: lista,
      corridas,
      comRota,
      meta,
      sem: lista.filter((p) => p.tipo === "sem").length,
      fora: lista.filter((p) => p.tipo === "fora").length,
      batida: meta && lista.length >= meta ? lista[meta - 1].a.data : null,
      repetido: trechoMaisRepetido(comRota),
    };
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

  // --------------------------------------------------------------- medidas
  function lerCores() {
    const s = getComputedStyle(el);
    const v = (n) => s.getPropertyValue(n).trim();
    cores = { a: v("--ponto-a"), b: v("--ponto-b"), prova: v("--ponto-prova"), linha: v("--texto-3"), trilha: v("--linha-forte"), texto: v("--texto-2"), fraco: v("--texto-3"), fonte: getComputedStyle(document.body).fontFamily };
  }
  const corDe = (p) => (p.prova ? cores.prova : p.mes % 2 ? cores.b : cores.a);

  function calcular() {
    const W = Math.round(tela.clientWidth);
    if (!W) return false;
    const largo = W >= 560;
    const H = largo ? Math.round(limitar(W * 0.8, 460, 620)) : Math.round(Math.min(560, W * 1.35));
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // passos 1 e 2: o mapa à esquerda e os montes sem lugar à direita (embaixo, no celular)
    const faixa = largo ? 0 : 118;
    const areaMapa = largo ? { x: 0, y: 0, w: W * 0.72, h: H } : { x: 0, y: 0, w: W, h: H - faixa };
    const areaLado = largo ? { x: W * 0.74, y: 0, w: W * 0.26, h: H } : { x: 0, y: H - faixa, w: W, h: faixa };
    const mp = pontos.mapa;
    const escala = Math.min(areaMapa.w / mp.w, areaMapa.h / mp.h) * 0.96;
    const ox = areaMapa.x + (areaMapa.w - mp.w * escala) / 2;
    const oy = areaMapa.y + (areaMapa.h - mp.h * escala) / 2;
    const proj = (mx, my) => [ox + mx * escala, oy + my * escala];
    const projLL = ([lat, lng]) => proj((lng - mp.lng_esq) * mp.cos_lat * M_LNG, (mp.lat_topo - lat) * M_LAT);
    // o tamanho dos pontos no mapa: juntos, cobrem ~14% da área (fica legível sem virar uma mancha)
    const passoMapa = limitar(Math.sqrt((0.14 * areaMapa.w * areaMapa.h) / Math.max(1, M.pontos.length)), 3, 7);

    for (const p of M.pontos) if (p.tipo === "mapa") p.rota = proj(p.mx, p.my);

    const grupos = new Map();
    for (const p of M.pontos) {
      if (p.tipo !== "mapa") continue;
      const chave = `${Math.floor(p.mx / CELULA_MONTE)},${Math.floor(p.my / CELULA_MONTE)}`;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(p);
    }
    const montes = [...grupos.values()].map((ps) => {
      const x0 = ps.reduce((s, p) => s + p.rota[0], 0) / ps.length;
      const y0 = ps.reduce((s, p) => s + p.rota[1], 0) / ps.length;
      return { ps, x0, y0, x: x0, y: y0, r: raioMonte(ps.length, passoMapa) };
    });
    afastar(montes, areaMapa, passoMapa * 0.5);
    for (const m of montes) girassol(m.ps.length, m.x, m.y, passoMapa).forEach((xy, i) => (m.ps[i].monte = xy));

    // os montes sem lugar no mapa
    const lados = [["sem", M.sem], ["fora", M.fora]].filter(([, n]) => n);
    const rotulosLado = [];
    lados.forEach(([tipo, n], i) => {
      const cx = largo ? areaLado.x + areaLado.w / 2 : areaLado.w * (lados.length === 1 ? 0.5 : i === 0 ? 0.3 : 0.75);
      const cy = largo ? areaLado.y + areaLado.h * (lados.length === 1 ? 0.5 : i === 0 ? 0.38 : 0.74) : areaLado.y + faixa / 2 + 8;
      const ps = M.pontos.filter((p) => p.tipo === tipo);
      girassol(ps.length, cx, cy, passoMapa).forEach((xy, j) => {
        ps[j].monte = xy;
        ps[j].rota = xy;
      });
      const r = raioMonte(ps.length, passoMapa);
      rotulosLado.push({ x: cx, y: cy - r - 8, texto: tipo === "sem" ? t("sem mapa: {km} km", { km: num(n) }) : t("outras cidades: {km} km", { km: num(n) }) });
    });

    // passo 3: a grade, uma linha a cada 50 km (30 no celular)
    const colunas = largo ? 50 : 30;
    const margem = largo ? 44 : 36;
    const topo = 22;
    const nGrade = Math.max(M.meta, M.pontos.length);
    const linhas = Math.ceil(nGrade / colunas);
    const passoGrade = Math.min(14, (W - margem - 8) / colunas, (H - topo - 16) / linhas);
    const x0 = (W - (margem + colunas * passoGrade)) / 2 + margem;
    const y0 = topo + Math.max(0, (H - topo - 16 - linhas * passoGrade) / 2);
    const naGrade = (k) => [x0 + ((k % colunas) + 0.5) * passoGrade, y0 + (Math.floor(k / colunas) + 0.5) * passoGrade];
    for (const p of M.pontos) p.grade = naGrade(p.k);
    const meses = [];
    let ultimaLinha = -1;
    for (const p of M.pontos) {
      if (meses.length && meses.at(-1).mes === p.mes) continue;
      const linha = Math.floor(p.k / colunas);
      meses.push({ mes: p.mes, linha, mostrar: linha > ultimaLinha });
      if (linha > ultimaLinha) ultimaLinha = linha;
    }

    L = {
      W, H, largo, dpr, projLL, rotulosLado, colunas, passoGrade, x0, y0, naGrade, meses,
      rMapa: passoMapa * 0.42,
      rGrade: passoGrade * 0.38,
    };
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

  // --------------------------------------------------------------- passos
  // onde cada ponto fica em cada passo, e quanto aparece de cada camada
  const PASSOS = {
    rotas: { camadas: { linhas: 1, montes: 0, grade: 0 }, ponto: (p) => ({ x: p.rota[0], y: p.rota[1], r: L.rMapa, al: 0 }) },
    nascer: { camadas: { linhas: 0.35, montes: 0, grade: 0 }, ponto: (p) => ({ x: p.rota[0], y: p.rota[1], r: L.rMapa, al: 1 }) },
    montes: { camadas: { linhas: 0.12, montes: 1, grade: 0 }, ponto: (p) => ({ x: p.monte[0], y: p.monte[1], r: L.rMapa, al: 1 }) },
    grade: { camadas: { linhas: 0, montes: 0, grade: 1 }, ponto: (p) => ({ x: p.grade[0], y: p.grade[1], r: L.rGrade, al: 1 }) },
  };
  const NOME_PASSO = ["rotas", "montes", "grade"];

  function aplicar(nome) {
    const alvo = PASSOS[nome];
    Object.assign(camadas, alvo.camadas);
    for (const p of M.pontos) Object.assign(p, alvo.ponto(p));
  }

  function animar(sessao, nome, duracao, atraso = () => 0) {
    const alvo = PASSOS[nome];
    const de = { ...camadas };
    let fim = duracao;
    for (const p of M.pontos) {
      p.de = [p.x, p.y, p.r, p.al];
      p.para = alvo.ponto(p);
      p.atraso = atraso(p);
      fim = Math.max(fim, p.atraso + duracao);
    }
    const t0 = performance.now();
    return new Promise((resolver) => {
      const quadro = (agora) => {
        if (sessao !== estado.sessao) return resolver(false);
        const dt = agora - t0;
        const eg = suave(limitar(dt / duracao, 0, 1));
        for (const k in alvo.camadas) camadas[k] = misturar(de[k], alvo.camadas[k], eg);
        for (const p of M.pontos) {
          const e = suave(limitar((dt - p.atraso) / duracao, 0, 1));
          p.x = misturar(p.de[0], p.para.x, e);
          p.y = misturar(p.de[1], p.para.y, e);
          p.r = misturar(p.de[2], p.para.r, e);
          p.al = misturar(p.de[3], p.para.al, e);
        }
        desenhar();
        if (dt >= fim) resolver(true);
        else requestAnimationFrame(quadro);
      };
      requestAnimationFrame(quadro);
    });
  }

  async function irPara(passo, { instantaneo = false } = {}) {
    const sessao = ++estado.sessao;
    const antes = estado.passo;
    estado.passo = passo;
    atualizarTexto();
    if (instantaneo || reduzirMovimento()) {
      aplicar(NOME_PASSO[passo]);
      desenhar();
      return true;
    }
    const n = M.pontos.length;
    if (passo === 1 && antes === 0) {
      // os pontos nascem em cima das linhas, em ordem de data, e depois se juntam nos montes
      if (!(await animar(sessao, "nascer", 700, (p) => (p.k / n) * 600))) return false;
      return animar(sessao, "montes", 1400);
    }
    if (passo === 2 && antes !== 2) {
      // a grade enche em ordem de data, como o ano passou
      return animar(sessao, "grade", 900, (p) => (p.k / n) * 1900);
    }
    return animar(sessao, NOME_PASSO[passo], 1000);
  }

  async function tocar() {
    await irPara(0, { instantaneo: true });
    let sessao = estado.sessao;
    await esperar(1900);
    if (sessao !== estado.sessao || !(await irPara(1))) return;
    sessao = estado.sessao;
    await esperar(2600);
    if (sessao !== estado.sessao) return;
    await irPara(2);
  }

  // ---------------------------------------------------------------- desenho
  function desenhar() {
    ctx.clearRect(0, 0, L.W, L.H);
    if (camadas.linhas > 0.01) {
      ctx.globalAlpha = camadas.linhas;
      ctx.drawImage(camadaRotas, 0, 0, L.W, L.H);
    }
    ctx.globalAlpha = 1;
    if (camadas.grade > 0.01) desenharGrade(camadas.grade);
    if (camadas.montes > 0.01) {
      ctx.globalAlpha = camadas.montes;
      ctx.font = `600 12px ${cores.fonte}`;
      ctx.fillStyle = cores.texto;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      for (const r of L.rotulosLado) ctx.fillText(r.texto, r.x, r.y);
    }
    for (const p of M.pontos) {
      if (p.al < 0.02) continue;
      ctx.globalAlpha = p.al;
      ctx.fillStyle = corDe(p);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // altura da linha da meta na margem esquerda (no degrau, é a parte de baixo)
  const yMeta = () => L.y0 + (Math.floor(M.meta / L.colunas) + (M.meta % L.colunas ? 1 : 0)) * L.passoGrade;

  // o que é da grade: os círculos que faltam para a meta, a linha da meta e os meses
  function desenharGrade(alfa) {
    const { passoGrade: pg, colunas, x0, y0 } = L;
    ctx.globalAlpha = alfa;
    ctx.strokeStyle = cores.trilha;
    ctx.lineWidth = 1;
    for (let k = M.pontos.length; k < M.meta; k++) {
      const [x, y] = L.naGrade(k);
      ctx.beginPath();
      ctx.arc(x, y, L.rGrade - 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (M.meta) {
      // degrau entre o último ponto da meta e o primeiro além dela
      const q = Math.floor(M.meta / colunas);
      const resto = M.meta % colunas;
      ctx.strokeStyle = cores.texto;
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
      ctx.font = `700 11px ${cores.fonte}`;
      ctx.fillStyle = cores.texto;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(t("grade|meta"), x0 - 8, yMeta());
    }
    ctx.font = `500 11px ${cores.fonte}`;
    ctx.fillStyle = cores.fraco;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const m of L.meses) {
      const y = y0 + (m.linha + 0.5) * pg;
      if (m.mostrar && !(M.meta && Math.abs(y - yMeta()) < pg * 0.9)) ctx.fillText(MESES_CURTOS[m.mes], x0 - 8, y);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ textos
  function textoDoPasso(passo) {
    const ano = estado.ano;
    if (passo === 0) {
      return t("{n} corridas com GPS em {ano}, desenhadas uma por cima da outra. O trecho mais repetido aparece em {r} delas, mas no mapa de linhas parece igual a um trecho feito uma vez.", { n: num(M.comRota.length), ano, r: num(M.repetido) });
    }
    if (passo === 1) {
      return [
        t("Cada ponto é 1 km, juntado perto de onde foi corrido: quanto maior o monte, mais vezes o trecho foi corrido."),
        M.sem ? t("{n} km não têm mapa: esteira, treino sem GPS ou perto de casa.", { n: num(M.sem) }) : "",
        M.fora ? t("{n} km foram em outras cidades.", { n: num(M.fora) }) : "",
      ].filter(Boolean).join(" ");
    }
    const n = M.pontos.length;
    const linha = t("Cada linha tem {n} km.", { n: L?.colunas || 50 });
    if (!M.meta) return `${t("Em ordem de data, os {n} km de {ano}.", { n: num(n), ano })} ${linha}`;
    if (M.batida) return `${t("Em ordem de data, os pontos enchem a meta de {meta} km, batida em {data}. Já são {extra} km além dela.", { meta: num(M.meta), data: dataLonga(M.batida), extra: num(n - M.meta) })} ${linha}`;
    return `${t("Em ordem de data, os pontos já enchem {p}% da meta de {meta} km. Os círculos vazios são os {faltam} km que faltam.", { p: num(Math.floor((n / M.meta) * 100)), meta: num(M.meta), faltam: num(M.meta - n) })} ${linha}`;
  }

  function atualizarTexto() {
    const texto = textoDoPasso(estado.passo);
    $(".pontos-texto", el).textContent = texto;
    canvas.setAttribute("aria-label", texto);
    $$(".pontos-passos button", el).forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.passo) === estado.passo)));
  }

  function montarControles() {
    abas($(".pontos-anos", el), anos.map((a) => ({ valor: a, rotulo: a })), estado.ano, (v) => {
      estado.ano = v;
      prepararAno();
      montarControles();
      if (calcular()) irPara(estado.passo, { instantaneo: true });
    });
    const rotulos = [t("Rotas"), t("Quilômetros"), M.meta ? t("Meta") : t("O ano")];
    $(".pontos-passos", el).innerHTML = rotulos
      .map((r, i) => `<li><button type="button" data-passo="${i}" aria-pressed="${i === estado.passo}"><span class="numero">${i + 1}</span><span>${esc(r)}</span></button></li>`)
      .join("");
    const chave = [
      `<li><i style="background:${cores.a}"></i><i style="background:${cores.b};margin-left:-.25rem"></i>${esc(t("treino (os meses alternam o tom)"))}</li>`,
      M.pontos.some((p) => p.prova) ? `<li><i style="background:${cores.prova}"></i>${esc(t("prova"))}</li>` : "",
      M.meta && M.pontos.length < M.meta ? `<li><i class="vazio"></i>${esc(t("falta para a meta"))}</li>` : "",
    ];
    $(".pontos-chave", el).innerHTML = chave.join("");
    preencherTabela();
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
        return `<tr><td>${MESES_CURTOS[i]}</td><td class="num">${num(g.n)}</td><td class="num">${num(g.m / 1000, 1)}</td><td class="num">${num(acumulado / 1000, 1)}</td></tr>`;
      })
      .join("");
    $(".pontos-tabela div", el).innerHTML = `<table class="resultados"><thead><tr><th>${esc(t("Mês"))}</th><th class="num">${esc(t("Corridas"))}</th><th class="num">km</th><th class="num">${esc(t("Acumulado (km)"))}</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }

  // ------------------------------------------------------------ interação
  function pontoEm(ev) {
    const caixa = canvas.getBoundingClientRect();
    const x = ev.clientX - caixa.left;
    const y = ev.clientY - caixa.top;
    let melhor = null;
    let menor = Infinity;
    for (const p of M.pontos) {
      if (p.al < 0.5) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < menor) {
        menor = d;
        melhor = p;
      }
    }
    return melhor && menor <= Math.max(9, melhor.r * 2.2) ? melhor : null;
  }

  let naDica = null;
  function mostrarDica(p, ev) {
    naDica = p;
    if (!p) {
      dica.classList.remove("visivel");
      return;
    }
    const a = p.a;
    dica.textContent = [
      a.prova ? `${a.n} (${t("prova")})` : a.n,
      dataLonga(a.data),
      `${distTreino(a.m)}, ${pace(a.m, a.s)}`,
      t("{k}º km de {ano}", { k: num(p.k + 1), ano: estado.ano }),
    ].join("\n");
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
    canvas.style.cursor = p ? "pointer" : "";
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
    if (!p) return;
    if (ev.pointerType === "touch" && !jaMostrava) return;
    location.href = linkTreino(p.a.id);
  });
  addEventListener("scroll", () => naDica && mostrarDica(null), { passive: true });

  el.addEventListener("click", (ev) => {
    const b = ev.target.closest(".pontos-passos button");
    if (b) irPara(Number(b.dataset.passo));
    if (ev.target.closest(".pontos-repetir")) tocar();
  });

  // ----------------------------------------------------------------- início
  lerCores();
  prepararAno();
  montarControles();
  const comecar = () => {
    if (!calcular()) return;
    irPara(estado.passo, { instantaneo: true });
    if (reduzirMovimento()) return;
    // a animação toca sozinha uma vez, quando a seção aparece na tela
    const olho = new IntersectionObserver((entradas) => {
      if (estado.jaTocou || !entradas.some((e) => e.isIntersecting)) return;
      estado.jaTocou = true;
      olho.disconnect();
      tocar();
    }, { threshold: 0.45 });
    olho.observe(tela);
  };
  (document.fonts?.ready || Promise.resolve()).then(comecar);
  aoRedimensionar(() => {
    if (calcular()) irPara(estado.passo, { instantaneo: true });
  });
  aoMudarTema(() => {
    lerCores();
    montarControles();
    if (calcular()) irPara(estado.passo, { instantaneo: true });
  });
}
