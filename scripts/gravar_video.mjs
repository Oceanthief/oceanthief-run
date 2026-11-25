// Grava o vídeo da história "cada quilômetro, um ponto" (video.html) em MP4.
//
//   node scripts/gravar_video.mjs --formato 45 --roteiro completo --lang pt --saida video.mp4
//
//   --formato   45 (4:5, 1080 × 1350, feed do LinkedIn e do Instagram), 916 (9:16, 1080 × 1920, Reels e
//               Stories) ou 11 (quadrado, 1080 × 1080). Padrão: 45.
//   --roteiro   completo (6 capítulos, sem a previsão) ou curto (rotas, quilômetros, meta e semanas). Padrão: completo.
//   --lang      pt, en ou es. Padrão: pt.
//   --saida     o arquivo MP4. Padrão: video-<roteiro>-<formato>-<lang>.mp4 na pasta atual.
//
// Precisa do Google Chrome e do ffmpeg (winget install Gyan.FFmpeg). Usa os dados que estão em data/:
// rode antes "python scripts/sync_strava.py --so-gerar" (ou "git pull") para gravar com os números de hoje.
// Só usa o que vem com o Node (18 ou mais novo): ele mesmo serve a pasta do site e conversa com o Chrome.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ESCALA = 2.5; // 432 px de CSS viram 1080 px de vídeo

// ------------------------------------------------------------------ opções
const args = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};
const formato = opcao("formato", "45");
const roteiro = opcao("roteiro", "completo");
const lang = opcao("lang", "pt");
const saida = resolve(opcao("saida", `video-${roteiro}-${formato}-${lang}.mp4`));
if (!["45", "916", "11"].includes(formato) || !["completo", "curto"].includes(roteiro) || !["pt", "en", "es"].includes(lang)) {
  console.error("Opção inválida. Veja o começo deste arquivo.");
  process.exit(1);
}

// --------------------------------------------------------- programas de fora
function acharChrome() {
  const lugares = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ];
  return lugares.find((c) => c && existsSync(c));
}
function acharFfmpeg() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {}
  // o winget instala numa pasta própria, que só entra no PATH de terminais abertos depois
  const pacotes = join(process.env.LOCALAPPDATA || "", "Microsoft/WinGet/Packages");
  if (existsSync(pacotes)) {
    for (const p of readdirSync(pacotes).filter((d) => d.startsWith("Gyan.FFmpeg"))) {
      for (const v of readdirSync(join(pacotes, p))) {
        const exe = join(pacotes, p, v, "bin/ffmpeg.exe");
        if (existsSync(exe)) return exe;
      }
    }
  }
  return null;
}
const chromeExe = acharChrome();
const ffmpegExe = acharFfmpeg();
if (!chromeExe) throw new Error("Não achei o Google Chrome (dá para apontar com a variável CHROME).");
if (!ffmpegExe) throw new Error("Não achei o ffmpeg. Instale com: winget install Gyan.FFmpeg");

// ------------------------------------------------- servidor da pasta do site
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json" };
const servidor = createServer((req, res) => {
  const caminho = normalize(join(RAIZ, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!caminho.startsWith(RAIZ) || !existsSync(caminho) || statSync(caminho).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": TIPOS[extname(caminho)] || "application/octet-stream" });
  res.end(readFileSync(caminho));
});
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${servidor.address().port}`;

// ------------------------------------------------------------------ Chrome
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const porta = 9400 + Math.floor(Math.random() * 400);
const perfil = mkdtempSync(join(tmpdir(), "gravar-video-"));
const chrome = spawn(chromeExe, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, "about:blank"], { stdio: "ignore" });
let alvos;
for (let i = 0; i < 75 && !alvos; i++) {
  try {
    alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json();
  } catch {
    await espera(200);
  }
}
const ws = new WebSocket(alvos.find((a) => a.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pendentes = new Map();
const erros = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendentes.has(m.id)) {
    pendentes.get(m.id)(m);
    pendentes.delete(m.id);
  }
  if (m.method === "Runtime.exceptionThrown") erros.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
const cmd = (method, params = {}) => new Promise((r) => {
  const n = ++id;
  pendentes.set(n, r);
  ws.send(JSON.stringify({ id: n, method, params }));
});
const avaliar = async (expressao) => {
  const r = await cmd("Runtime.evaluate", { expression: expressao, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "erro na página");
  return r.result?.result?.value;
};
function encerrar(codigo) {
  try { ws.close(); } catch {}
  chrome.kill();
  servidor.close();
  try { rmSync(perfil, { recursive: true, force: true }); } catch {}
  process.exit(codigo);
}

const tamanhos = { 45: [432, 540], 916: [432, 768], 11: [432, 432] };
const [w, h] = tamanhos[formato];
await cmd("Runtime.enable");
await cmd("Page.enable");
await cmd("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: ESCALA, mobile: false });
await cmd("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: "no-preference" }] });
await cmd("Page.navigate", { url: `${base}/video.html?formato=${formato}&roteiro=${roteiro}&lang=${lang}&gravar=1` });
let estado = null;
for (let i = 0; i < 120 && !estado; i++) {
  await espera(500);
  estado = await avaliar("document.documentElement.dataset.videoPronto || null").catch(() => null);
}
if (estado !== "1") {
  console.error("A página do vídeo não ficou pronta.", erros.join("\n"));
  encerrar(1);
}
const quadros = await avaliar("window.video.quadros");
const qps = await avaliar("window.video.qps");
console.log(`Gravando ${quadros} quadros (${(quadros / qps).toFixed(1)} s, ${w * ESCALA} × ${h * ESCALA}) em ${saida}`);

// ------------------------------------------------------------------ ffmpeg
const ffmpeg = spawn(ffmpegExe, [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(qps), "-c:v", "png", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  saida,
], { stdio: ["pipe", "inherit", "inherit"] });
const fim = new Promise((r) => ffmpeg.on("close", r));
const escrever = (buf) => new Promise((r) => (ffmpeg.stdin.write(buf) ? r() : ffmpeg.stdin.once("drain", r)));

const t0 = Date.now();
for (let n = 0; n < quadros; n++) {
  await avaliar(`window.video.quadro(${n})`);
  const foto = await cmd("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
  await escrever(Buffer.from(foto.result.data, "base64"));
  if (n % 90 === 0 || n === quadros - 1) {
    const feitos = n + 1;
    const resta = ((Date.now() - t0) / feitos) * (quadros - feitos) / 1000;
    process.stdout.write(`  ${feitos}/${quadros} quadros (faltam ~${Math.ceil(resta)} s)\n`);
  }
}
ffmpeg.stdin.end();
const codigo = await fim;
if (erros.length) console.error("Erros na página:\n" + erros.join("\n"));
console.log(codigo === 0 ? `Pronto: ${saida}` : `O ffmpeg falhou (código ${codigo}).`);
encerrar(codigo === 0 && !erros.length ? 0 : 1);
