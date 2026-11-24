// O vídeo da história "cada quilômetro, um ponto", para LinkedIn e Instagram.
//
// video.html?formato=45&roteiro=completo&lang=pt toca em tempo real (para conferir no navegador).
//   formato: 45 (4:5, 1080 × 1350, o feed), 916 (9:16, 1080 × 1920, Reels e Stories) ou 11 (quadrado)
//   roteiro: completo (os 7 capítulos, ~45 s) ou curto (rotas, quilômetros, meta e previsão, ~30 s)
// Com &gravar=1, o tempo da página para: só anda quando scripts/gravar_video.mjs pede o próximo quadro
// (window.video.quadro(n)). Assim cada quadro sai igual, por mais lento que o computador esteja.
import { $, buscarJSON, carregarTudo, num, t } from "./comum.js";
import { montarPontos } from "./pontos.js";

const params = new URLSearchParams(location.search);
const FORMATOS = { 45: [432, 540, 136], 916: [432, 768, 150], 11: [432, 432, 118] };
const [largura, altura, legenda] = FORMATOS[params.get("formato")] || FORMATOS[45];
const ROTEIROS = {
  completo: ["rotas", "montes", "meta", "semanas", "horas", "ritmo", "maratona"],
  curto: ["rotas", "montes", "meta", "maratona"],
};
const roteiro = ROTEIROS[params.get("roteiro")] || ROTEIROS.completo;
// quanto tempo cada parte fica na tela (ms), contando a animação de entrada do capítulo
const TEMPO = { abertura: 2800, rotas: 3600, montes: 5600, meta: 5800, semanas: 5000, horas: 4800, ritmo: 5400, maratona: 8600, fim: 3600 };
const QPS = 30;
const ENDERECO = "oceanthief.github.io/oceanthief-run"; // trocar aqui se o site mudar de domínio

const quadro = $(".v-quadro");
quadro.style.setProperty("--v-largura", `${largura}px`);
quadro.style.setProperty("--v-altura", `${altura}px`);
quadro.style.setProperty("--v-legenda", `${legenda}px`);

// o relógio parado: a página só vê o tempo que a gravação manda
const gravar = params.has("gravar");
let agora = 0;
let fila = [];
if (gravar) {
  performance.now = () => agora;
  window.requestAnimationFrame = (f) => fila.push(f);
  window.cancelAnimationFrame = () => {};
}

const caixa = $(".v-legenda");
const tela = $(".v-tela");

try {
  const { site, perfil } = await carregarTudo();
  const [pontos, rotas, evolucao] = await Promise.all([
    buscarJSON("data/pontos.json"),
    buscarJSON("data/rotas.json", true),
    buscarJSON("data/evolucao.json", true),
  ]);
  const api = montarPontos($("#pontos"), {
    atividades: site.atividades.filter((a) => a.grupo === "corrida"),
    pontos,
    rotas: new Map(rotas || []),
    perfil,
    evolucao,
    video: true,
  });
  await api.pronto;
  const ano = api.ano();
  $(".v-ano").textContent = ano;

  // as partes do vídeo, uma atrás da outra
  const caps = api.capitulos();
  const partes = [];
  let inicio = 0;
  const juntar = (tipo, nome) => {
    partes.push({ tipo, nome, ini: inicio, fim: inicio + TEMPO[nome] });
    inicio += TEMPO[nome];
  };
  juntar("capa", "abertura");
  roteiro.filter((nome) => caps.includes(nome)).forEach((nome) => juntar("capitulo", nome));
  juntar("capa", "fim");
  const duracao = inicio;

  function preencher(parte) {
    caixa.classList.toggle("v-capa", parte.tipo === "capa");
    const [numero, nome, grande, texto] = $$legenda();
    if (parte.nome === "abertura") {
      numero.textContent = "";
      nome.textContent = "";
      grande.textContent = t("Cada quilômetro, um ponto");
      texto.textContent = t("O ano de {ano} em {n} pontos, um por km corrido.", { ano, n: num(api.km()) });
    } else if (parte.nome === "fim") {
      numero.textContent = "";
      nome.textContent = "";
      grande.textContent = t("O ano em pontos");
      // o endereço numa linha só, sem quebrar no hífen
      texto.textContent = t("A história inteira está no site:");
      const url = document.createElement("b");
      url.className = "v-url";
      url.textContent = ENDERECO;
      texto.append(document.createElement("br"), url);
    } else {
      const d = api.destaque(parte.nome);
      numero.textContent = String(roteiro.filter((x) => caps.includes(x)).indexOf(parte.nome) + 1);
      nome.textContent = api.titulo(parte.nome);
      grande.textContent = d.numero;
      texto.textContent = d.texto;
    }
  }
  function $$legenda() {
    return [$(".v-titulo .numero"), $(".v-titulo .nome"), $(".v-numero"), $(".v-texto")];
  }

  // aplica o instante `ms` do vídeo: troca de capítulo na hora certa e esmaece a legenda
  let atual = null;
  function aplicar(ms) {
    const parte = partes.find((p) => ms < p.fim) || partes.at(-1);
    if (parte !== atual) {
      atual = parte;
      preencher(parte);
      if (parte.tipo === "capitulo") api.irPara(parte.nome);
    }
    const dentro = ms - parte.ini;
    const resta = parte.fim - ms;
    // a abertura já começa inteira: o primeiro quadro é a miniatura do vídeo
    const entra = parte.nome === "abertura" ? 1 : Math.min(1, dentro / 450);
    const sai = parte.nome === "fim" ? 1 : Math.min(1, resta / 280);
    const al = Math.max(0, Math.min(entra, sai));
    caixa.style.opacity = al.toFixed(3);
    caixa.style.transform = `translateY(${((1 - Math.min(1, dentro / 450)) * 6).toFixed(2)}px)`;
    // o desenho fica apagado na abertura e no fim, com o título por cima
    const fundo = parte.nome === "abertura" ? 0.3 : parte.nome === "fim" ? Math.max(0.3, 1 - dentro / 600) : partes[1] === parte ? Math.min(1, 0.3 + dentro / 700) : 1;
    tela.style.opacity = fundo.toFixed(3);
  }

  window.video = {
    quadros: Math.ceil((duracao / 1000) * QPS),
    qps: QPS,
    tamanho: [largura, altura],
    // desenha o quadro n (a gravação chama em ordem: 0, 1, 2...)
    quadro(n) {
      agora = (n * 1000) / QPS;
      aplicar(agora);
      const f = fila;
      fila = [];
      for (const g of f) g(agora);
    },
  };
  document.documentElement.dataset.videoPronto = "1";

  if (!gravar) {
    const t0 = performance.now();
    const tocar = () => {
      const ms = performance.now() - t0;
      aplicar(Math.min(ms, duracao - 1));
      if (ms < duracao) requestAnimationFrame(tocar);
    };
    requestAnimationFrame(tocar);
  }
} catch (erro) {
  caixa.textContent = erro.message;
  document.documentElement.dataset.videoPronto = "erro";
}
