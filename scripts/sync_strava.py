"""Baixa seus dados do Strava e gera os arquivos que o site lê.

    python scripts/sync_strava.py                    # sincroniza e gera o site
    python scripts/sync_strava.py --max-detalhes 900 # primeira vez: baixa mais detalhes
    python scripts/sync_strava.py --so-gerar         # só refaz os arquivos a partir do cache

Precisa de STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET e STRAVA_REFRESH_TOKEN, no
arquivo .env (criado pelo strava_auth.py) ou em variáveis de ambiente (GitHub).

O que fica salvo no repositório (data/cache/) não tem coordenadas exatas:
detalhes dos treinos (parciais e melhores esforços), clima e cidades. A lista
de atividades com as rotas completas fica em data/local/, fora do git.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CACHE = RAIZ / "data" / "cache"        # vai para o git
LOCAL = RAIZ / "data" / "local"        # fica só no seu PC
SAIDA = RAIZ / "data"
CONFIG = RAIZ / "config" / "perfil.json"
API = "https://www.strava.com/api/v3"
UA = "strava-site-pessoal/1.0"

CORRIDA = {"Run", "TrailRun", "VirtualRun"}
COM_DETALHE = CORRIDA | {"Walk", "Hike", "Ride", "GravelRide", "MountainBikeRide", "Swim"}


class LimiteDiario(Exception):
    """O Strava avisou que a cota do dia acabou."""


# ---------------------------------------------------------------- utilidades

def ler_json(caminho: Path, padrao):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return padrao


def gravar_json(caminho: Path, dados, compacto: bool = False) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    if compacto:
        texto = json.dumps(dados, ensure_ascii=False, separators=(",", ":"))
    else:
        texto = json.dumps(dados, ensure_ascii=False, indent=1)
    temp = caminho.with_suffix(caminho.suffix + ".tmp")
    temp.write_text(texto, encoding="utf-8")
    temp.replace(caminho)


def ler_env() -> dict:
    dados = {}
    arquivo = RAIZ / ".env"
    if arquivo.exists():
        for linha in arquivo.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if linha and not linha.startswith("#") and "=" in linha:
                chave, valor = linha.split("=", 1)
                dados[chave.strip()] = valor.strip()
    for chave in ("STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_REFRESH_TOKEN"):
        if os.environ.get(chave):
            dados[chave] = os.environ[chave]
    return dados


def http_json(url: str, *, dados: dict | None = None, cabecalhos: dict | None = None, timeout: int = 90):
    corpo = urllib.parse.urlencode(dados).encode() if dados else None
    req = urllib.request.Request(url, data=corpo, headers={"User-Agent": UA, **(cabecalhos or {})})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp), resp.headers


def log(msg: str) -> None:
    print(msg, flush=True)


# ------------------------------------------------------------- polyline e geo

def decodificar(polyline: str) -> list[tuple[float, float]]:
    pontos, i, lat, lng = [], 0, 0, 0
    while i < len(polyline):
        for eixo in (0, 1):
            resultado, deslocamento = 0, 0
            while True:
                b = ord(polyline[i]) - 63
                i += 1
                resultado |= (b & 0x1F) << deslocamento
                deslocamento += 5
                if b < 0x20:
                    break
            delta = ~(resultado >> 1) if resultado & 1 else resultado >> 1
            if eixo == 0:
                lat += delta
            else:
                lng += delta
        pontos.append((lat / 1e5, lng / 1e5))
    return pontos


def codificar(pontos: list[tuple[float, float]]) -> str:
    saida, ant_lat, ant_lng = [], 0, 0
    for lat, lng in pontos:
        ilat, ilng = round(lat * 1e5), round(lng * 1e5)
        for delta in (ilat - ant_lat, ilng - ant_lng):
            valor = ~(delta << 1) if delta < 0 else delta << 1
            while valor >= 0x20:
                saida.append(chr((0x20 | (valor & 0x1F)) + 63))
                valor >>= 5
            saida.append(chr(valor + 63))
        ant_lat, ant_lng = ilat, ilng
    return "".join(saida)


def distancia_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def cortar_pontas(pontos: list[tuple[float, float]], metros: float) -> list[tuple[float, float]]:
    """Tira os primeiros e os últimos `metros` da rota (esconde onde você mora)."""
    if metros <= 0 or len(pontos) < 3:
        return pontos

    def corte(lista):
        andado = 0.0
        for i in range(1, len(lista)):
            andado += distancia_m(lista[i - 1], lista[i])
            if andado >= metros:
                return i
        return len(lista)

    inicio = corte(pontos)
    fim = len(pontos) - corte(pontos[::-1])
    return pontos[inicio:fim] if fim - inicio >= 2 else []


def simplificar(pontos: list[tuple[float, float]], tolerancia: float) -> list[tuple[float, float]]:
    """Douglas-Peucker iterativo, tolerância em graus."""
    if len(pontos) < 3:
        return pontos
    manter = [False] * len(pontos)
    manter[0] = manter[-1] = True
    pilha = [(0, len(pontos) - 1)]
    while pilha:
        ini, fim = pilha.pop()
        (y1, x1), (y2, x2) = pontos[ini], pontos[fim]
        dx, dy = x2 - x1, y2 - y1
        norma = math.hypot(dx, dy) or 1e-12
        maior, indice = 0.0, -1
        for i in range(ini + 1, fim):
            y, x = pontos[i]
            d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norma
            if d > maior:
                maior, indice = d, i
        if maior > tolerancia and indice > 0:
            manter[indice] = True
            pilha.append((ini, indice))
            pilha.append((indice, fim))
    return [p for p, m in zip(pontos, manter) if m]


def celula(lat: float, lng: float, passo: float = 0.05) -> str:
    return f"{round(lat / passo) * passo:.2f},{round(lng / passo) * passo:.2f}"


# ------------------------------------------------------------------- Strava

class Strava:
    def __init__(self, env: dict, esperar: bool):
        self.env = env
        self.esperar = esperar
        self.token = ""
        self.expira = 0.0
        self.chamadas = 0
        self.uso = (0, 0)
        self.limite = (100, 1000)

    def autenticar(self) -> None:
        dados, _ = http_json(
            "https://www.strava.com/oauth/token",
            dados={
                "client_id": self.env["STRAVA_CLIENT_ID"],
                "client_secret": self.env["STRAVA_CLIENT_SECRET"],
                "grant_type": "refresh_token",
                "refresh_token": self.env["STRAVA_REFRESH_TOKEN"],
            },
        )
        self.token = dados["access_token"]
        self.expira = float(dados.get("expires_at") or time.time() + 3600)
        novo = dados.get("refresh_token")
        if novo and novo != self.env["STRAVA_REFRESH_TOKEN"]:
            log("Aviso: o Strava trocou o refresh token. Atualize STRAVA_REFRESH_TOKEN (.env e segredos do GitHub).")
            arquivo = RAIZ / ".env"
            if arquivo.exists():
                texto = arquivo.read_text(encoding="utf-8").replace(self.env["STRAVA_REFRESH_TOKEN"], novo)
                arquivo.write_text(texto, encoding="utf-8")
            self.env["STRAVA_REFRESH_TOKEN"] = novo

    def _ler_limites(self, cabecalhos) -> None:
        for prefixo in ("X-ReadRateLimit", "X-RateLimit"):
            uso, limite = cabecalhos.get(f"{prefixo}-Usage"), cabecalhos.get(f"{prefixo}-Limit")
            if uso and limite:
                self.uso = tuple(int(x) for x in uso.split(",")[:2])
                self.limite = tuple(int(x) for x in limite.split(",")[:2])
                return

    def _aguardar_janela(self) -> None:
        agora = datetime.now(timezone.utc)
        segundos = (15 - agora.minute % 15) * 60 - agora.second + 5
        if not self.esperar:
            raise LimiteDiario("limite de 15 minutos atingido")
        log(f"  limite de 15 min do Strava atingido; esperando {segundos // 60} min...")
        time.sleep(segundos)
        self.uso = (0, self.uso[1])

    def get(self, caminho: str, **params):
        if self.uso[1] >= self.limite[1] - 3:
            raise LimiteDiario("cota diária do Strava acabou")
        if self.uso[0] >= self.limite[0] - 2:
            self._aguardar_janela()
        url = f"{API}{caminho}" + (f"?{urllib.parse.urlencode(params)}" if params else "")
        for tentativa in range(4):
            # o token do Strava vence em 6 h: renova antes, inclusive depois de esperas longas
            if time.time() > self.expira - 300:
                self.autenticar()
            try:
                dados, cabecalhos = http_json(url, cabecalhos={"Authorization": f"Bearer {self.token}"})
                self.chamadas += 1
                self._ler_limites(cabecalhos)
                return dados
            except urllib.error.HTTPError as erro:
                self._ler_limites(erro.headers)
                if erro.code == 401 and tentativa == 0:
                    self.autenticar()
                    continue
                if erro.code == 429:
                    if self.uso[1] >= self.limite[1] - 3:
                        raise LimiteDiario("cota diária do Strava acabou") from erro
                    self._aguardar_janela()
                    continue
                if erro.code == 404:
                    return None
                if erro.code >= 500 and tentativa < 3:
                    time.sleep(5 * (tentativa + 1))
                    continue
                raise
            except (urllib.error.URLError, TimeoutError):
                if tentativa == 3:
                    raise
                time.sleep(5 * (tentativa + 1))
        return None


def enxugar_resumo(a: dict) -> dict:
    campos = (
        "id", "name", "sport_type", "type", "start_date", "start_date_local", "distance", "moving_time",
        "elapsed_time", "total_elevation_gain", "average_speed", "max_speed", "average_heartrate",
        "max_heartrate", "trainer", "commute", "manual", "visibility", "private", "workout_type",
        "kudos_count", "achievement_count", "pr_count", "athlete_count", "average_cadence",
        "average_watts", "kilojoules", "gear_id", "start_latlng", "end_latlng",
    )
    saida = {c: a.get(c) for c in campos}
    saida["polyline"] = (a.get("map") or {}).get("summary_polyline") or ""
    return saida


def enxugar_detalhe(d: dict) -> dict:
    esforcos = [
        {
            "nome": e.get("name"),
            "dist": e.get("distance"),
            "t": e.get("elapsed_time"),
            "inicio": e.get("start_index"),
            "pr": e.get("pr_rank"),
        }
        for e in d.get("best_efforts") or []
    ]
    parciais = [
        {
            "m": round(s.get("distance") or 0),
            "s": s.get("moving_time"),
            "el": round(s.get("elevation_difference") or 0, 1),
            "v": round(s.get("average_speed") or 0, 3),
            "hr": round(s["average_heartrate"]) if s.get("average_heartrate") else None,
        }
        for s in d.get("splits_metric") or []
    ]
    return {
        "esforcos": esforcos,
        "parciais": parciais,
        "calorias": round(d["calories"]) if d.get("calories") else None,
        "aparelho": d.get("device_name"),
    }


def enxugar_atleta(a: dict) -> dict:
    def equipamento(lista):
        return [
            {"id": g.get("id"), "nome": g.get("name") or g.get("nickname"), "m": g.get("distance") or 0,
             "principal": bool(g.get("primary")), "aposentado": bool(g.get("retired"))}
            for g in lista or []
        ]

    return {
        "id": a.get("id"),
        "nome": a.get("firstname") or "",
        "sobrenome": a.get("lastname") or "",
        "cidade": a.get("city") or "",
        "estado": a.get("state") or "",
        "pais": a.get("country") or "",
        "foto": a.get("profile") or "",
        "desde": (a.get("created_at") or "")[:10],
        "tenis": equipamento(a.get("shoes")),
        "bikes": equipamento(a.get("bikes")),
    }


def sincronizar_strava(env: dict, max_detalhes: int, esperar: bool) -> None:
    api = Strava(env, esperar)
    api.autenticar()

    log("Baixando perfil...")
    atleta = api.get("/athlete")
    gravar_json(CACHE / "atleta.json", enxugar_atleta(atleta))
    zonas = api.get("/athlete/zones") or {}
    gravar_json(CACHE / "zonas.json", {"fc": ((zonas.get("heart_rate") or {}).get("zones")) or []})

    log("Baixando a lista de atividades...")
    todas, pagina = [], 1
    while True:
        lote = api.get("/athlete/activities", per_page=200, page=pagina)
        if not lote:
            break
        todas.extend(enxugar_resumo(a) for a in lote)
        log(f"  {len(todas)} atividades")
        if len(lote) < 200:
            break
        pagina += 1
    gravar_json(LOCAL / "atividades.json", todas, compacto=True)

    detalhes = ler_json(CACHE / "detalhes.json", {})
    faltando = [
        a for a in sorted(todas, key=lambda x: x["start_date"], reverse=True)
        if str(a["id"]) not in detalhes and (a.get("sport_type") or a.get("type")) in COM_DETALHE and not a.get("manual")
    ]
    # corridas primeiro: são elas que têm os melhores esforços (recordes)
    faltando.sort(key=lambda a: (a.get("sport_type") or a.get("type")) not in CORRIDA)
    if faltando:
        alvo = min(len(faltando), max_detalhes)
        log(f"Baixando detalhes de {alvo} de {len(faltando)} treinos que ainda não têm...")
        feitos = 0
        try:
            for a in faltando[:alvo]:
                d = api.get(f"/activities/{a['id']}")
                if d:
                    detalhes[str(a["id"])] = enxugar_detalhe(d)
                feitos += 1
                if feitos % 25 == 0:
                    gravar_json(CACHE / "detalhes.json", detalhes, compacto=True)
                    log(f"  {feitos}/{alvo}")
        except LimiteDiario as motivo:
            log(f"  parei nos detalhes: {motivo}. O resto vem na próxima sincronização.")
        except (urllib.error.URLError, TimeoutError, OSError) as erro:
            # um erro aqui não pode impedir que o site seja montado com o que já chegou
            log(f"  parei nos detalhes por um erro ({erro}). O resto vem na próxima sincronização.")
        gravar_json(CACHE / "detalhes.json", detalhes, compacto=True)
        restantes = len(faltando) - feitos
        if restantes:
            log(f"  faltam {restantes} treinos sem detalhe (vão sendo baixados aos poucos).")
    log(f"Strava: {api.chamadas} chamadas nesta rodada.")


# ---------------------------------------------------------- clima e cidades

def ponto_inicial(a: dict):
    ll = a.get("start_latlng")
    if ll and len(ll) == 2:
        return float(ll[0]), float(ll[1])
    if a.get("polyline"):
        pts = decodificar(a["polyline"])
        if pts:
            return pts[0]
    return None


def sincronizar_clima(atividades: list[dict], limite: int = 40) -> None:
    """Temperatura, chuva e vento na hora do treino (Open-Meteo, grátis)."""
    clima = ler_json(CACHE / "clima.json", {})
    hoje = date.today()
    grupos = defaultdict(list)
    for a in atividades:
        if str(a["id"]) in clima or a.get("trainer") or a.get("manual"):
            continue
        p = ponto_inicial(a)
        dia = date.fromisoformat(a["start_date_local"][:10])
        if not p or (hoje - dia).days < 7:
            continue
        grupos[celula(*p, passo=0.25)].append(a)
    if not grupos:
        return
    log(f"Buscando o clima de {sum(len(g) for g in grupos.values())} treinos ({len(grupos)} regiões)...")
    for n, (cel, lista) in enumerate(sorted(grupos.items(), key=lambda kv: -len(kv[1]))):
        if n >= limite:
            log("  o resto do clima fica para a próxima sincronização.")
            break
        lat, lng = map(float, cel.split(","))
        dias = sorted(a["start_date_local"][:10] for a in lista)
        params = {
            "latitude": lat, "longitude": lng, "start_date": dias[0], "end_date": dias[-1],
            "hourly": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
            "timezone": "auto",
        }
        try:
            dados, _ = http_json("https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode(params), timeout=180)
        except (urllib.error.URLError, TimeoutError) as erro:
            log(f"  clima indisponível agora ({erro}); tento na próxima.")
            break
        horas = dados.get("hourly") or {}
        indice = {t: i for i, t in enumerate(horas.get("time") or [])}
        for a in lista:
            inicio = datetime.fromisoformat(a["start_date_local"][:19].replace("Z", ""))
            chaves = []
            t = inicio.replace(minute=0, second=0)
            while t <= inicio + timedelta(seconds=a.get("elapsed_time") or 0):
                chaves.append(t.strftime("%Y-%m-%dT%H:00"))
                t += timedelta(hours=1)
            idx = [indice[k] for k in chaves if k in indice]
            if not idx:
                continue

            def serie(nome):
                valores = [horas[nome][i] for i in idx if horas.get(nome) and horas[nome][i] is not None]
                return valores

            temps, chuva = serie("temperature_2m"), serie("precipitation")
            codigos = serie("weather_code")
            if not temps:
                continue
            clima[str(a["id"])] = {
                "temp": round(sum(temps) / len(temps), 1),
                "umid": round(sum(serie("relative_humidity_2m")) / max(1, len(serie("relative_humidity_2m")))),
                "chuva": round(sum(chuva), 1),
                "vento": round(max(serie("wind_speed_10m") or [0])),
                "cod": int(max(codigos)) if codigos else None,
            }
        time.sleep(0.5)
    gravar_json(CACHE / "clima.json", clima, compacto=True)


def sincronizar_lugares(atividades: list[dict], limite: int = 120) -> None:
    """Cidade e país de cada região onde você treinou (OpenStreetMap)."""
    lugares = ler_json(CACHE / "lugares.json", {})
    faltando = []
    for a in atividades:
        p = ponto_inicial(a)
        if p:
            cel = celula(*p)
            if cel not in lugares and cel not in faltando:
                faltando.append(cel)
    if not faltando:
        return
    log(f"Descobrindo {min(len(faltando), limite)} de {len(faltando)} cidades novas...")
    for cel in faltando[:limite]:
        lat, lng = cel.split(",")
        url = "https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode(
            {"format": "jsonv2", "lat": lat, "lon": lng, "zoom": 10, "accept-language": "pt-BR"}
        )
        try:
            dados, _ = http_json(url, timeout=30)
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2)
            continue
        end = dados.get("address") or {}
        lugares[cel] = {
            "cidade": end.get("city") or end.get("town") or end.get("village") or end.get("municipality") or end.get("county") or "",
            "estado": end.get("state") or "",
            "pais": end.get("country") or "",
            "cc": (end.get("country_code") or "").upper(),
        }
        time.sleep(1.1)  # regra de uso do OpenStreetMap: 1 pedido por segundo
    gravar_json(CACHE / "lugares.json", lugares)


# ------------------------------------------------------------ gerar o site

def tipo(a: dict) -> str:
    return a.get("sport_type") or a.get("type") or "Workout"


def gerar_site() -> None:
    perfil = ler_json(CONFIG, {})
    priv = perfil.get("privacidade") or {}
    corte = float(priv.get("cortar_inicio_fim_m", 400))
    so_publicas = bool(priv.get("ocultar_somente_seguidores", False))
    nao_sao_provas = {str(x) for x in perfil.get("nao_sao_provas") or []}

    atividades = ler_json(LOCAL / "atividades.json", [])
    if not atividades:
        log("Não há atividades no cache. Rode sem --so-gerar primeiro.")
        sys.exit(1)
    atividades = [
        a for a in atividades
        if not a.get("private") and a.get("visibility") != "only_me"
        and not (so_publicas and a.get("visibility") == "followers_only")
    ]
    atividades.sort(key=lambda a: a["start_date"])

    atleta = ler_json(CACHE / "atleta.json", {})
    zonas = ler_json(CACHE / "zonas.json", {"fc": []})
    detalhes = ler_json(CACHE / "detalhes.json", {})
    clima = ler_json(CACHE / "clima.json", {})
    lugares_cache = ler_json(CACHE / "lugares.json", {})

    # casa = região com mais inícios de treino (ou a do perfil.json)
    inicios = [ponto_inicial(a) for a in atividades]
    contagem = Counter(celula(*p, passo=0.02) for p in inicios if p)
    casa = perfil.get("casa")
    if casa and casa.get("lat") is not None:
        casa_pt = (float(casa["lat"]), float(casa["lng"]))
    elif contagem:
        casa_pt = tuple(map(float, contagem.most_common(1)[0][0].split(",")))
    else:
        casa_pt = None

    lugares, indice_lugar = [], {}
    compactas, rotas = [], []
    pasta_ativ = SAIDA / "atividades"
    pasta_ativ.mkdir(parents=True, exist_ok=True)
    ids_validos = set()

    for a, inicio in zip(atividades, inicios):
        aid = str(a["id"])
        ids_validos.add(aid)
        pontos = cortar_pontas(decodificar(a["polyline"]), corte) if a.get("polyline") else []
        ponto_mapa = pontos[0] if pontos else (round(inicio[0], 2), round(inicio[1], 2)) if inicio else None

        lugar_idx = None
        if inicio:
            info = lugares_cache.get(celula(*inicio))
            if info and info.get("cidade"):
                chave = (info["cidade"], info["pais"])
                if chave not in indice_lugar:
                    indice_lugar[chave] = len(lugares)
                    lat_c, lng_c = map(float, celula(*inicio).split(","))  # centro da região, não o ponto exato
                    lugares.append({**info, "lat": lat_c, "lng": lng_c})
                lugar_idx = indice_lugar[chave]

        det = detalhes.get(aid) or {}
        cl = clima.get(aid)
        c = {
            "id": a["id"],
            "n": a.get("name") or "",
            "t": tipo(a),
            "d": (a.get("start_date_local") or "")[:16],
            "m": round(a.get("distance") or 0),
            "s": a.get("moving_time") or 0,
            "e": a.get("elapsed_time") or 0,
            "el": round(a.get("total_elevation_gain") or 0),
        }
        if a.get("average_heartrate"):
            c["hr"] = round(a["average_heartrate"])
            c["hrx"] = round(a.get("max_heartrate") or 0)
        if a.get("trainer") or tipo(a).startswith("Virtual"):
            c["in"] = 1
        # 1 = prova de corrida, 11 = prova de pedal; perfil.json pode desmarcar
        if a.get("workout_type") in (1, 11) and aid not in nao_sao_provas:
            c["prova"] = 1
        if a.get("kudos_count"):
            c["k"] = a["kudos_count"]
        if a.get("pr_count"):
            c["pr"] = a["pr_count"]
        if (a.get("athlete_count") or 1) > 1:
            c["pessoas"] = a["athlete_count"]
        if a.get("gear_id"):
            c["g"] = a["gear_id"]
        if lugar_idx is not None:
            c["l"] = lugar_idx
        if ponto_mapa:
            c["ll"] = [round(ponto_mapa[0], 3), round(ponto_mapa[1], 3)]
            if casa_pt:
                c["casa"] = round(distancia_m(casa_pt, ponto_mapa) / 1000)
        if cl:
            c["cl"] = [cl["temp"], cl.get("cod"), cl.get("chuva", 0)]
        if det.get("aparelho"):
            c["ap"] = det["aparelho"]
        compactas.append(c)

        if len(pontos) >= 2:
            rotas.append([a["id"], codificar(simplificar(pontos, 0.00015))])

        arquivo = {
            **c,
            "v": round(a.get("average_speed") or 0, 3),
            "vx": round(a.get("max_speed") or 0, 2),
            "cad": round(a["average_cadence"], 1) if a.get("average_cadence") else None,
            "w": round(a["average_watts"]) if a.get("average_watts") else None,
            "cal": det.get("calorias"),
            "rota": codificar(pontos) if len(pontos) >= 2 else "",
            "parciais": det.get("parciais") or [],
            "esforcos": [{k: e[k] for k in ("nome", "dist", "t", "pr")} for e in det.get("esforcos") or []],
            "clima": cl,
            "lugar": lugares[lugar_idx] if lugar_idx is not None else None,
        }
        gravar_json(pasta_ativ / f"{aid}.json", arquivo, compacto=True)

    for velho in pasta_ativ.glob("*.json"):
        if velho.stem not in ids_validos:
            velho.unlink()

    # recordes: melhores esforços de todas as corridas detalhadas
    por_distancia = defaultdict(list)
    for a in atividades:
        if tipo(a) not in CORRIDA:
            continue
        for e in (detalhes.get(str(a["id"])) or {}).get("esforcos") or []:
            if e.get("t"):
                por_distancia[(e["nome"], round(e["dist"] or 0))].append(
                    {"t": e["t"], "id": a["id"], "d": a["start_date_local"][:10], "n": a.get("name") or ""}
                )
    recordes = []
    for (nome, dist), lista in sorted(por_distancia.items(), key=lambda kv: kv[0][1]):
        lista.sort(key=lambda x: x["t"])
        por_ano = {}
        for e in lista:
            por_ano.setdefault(e["d"][:4], e["t"])
        recordes.append({"nome": nome, "dist": dist, "top": lista[:5], "por_ano": dict(sorted(por_ano.items()))})

    uso_equip = Counter()
    for a in atividades:
        if a.get("gear_id"):
            uso_equip[a["gear_id"]] += 1
    equipamento = []
    for g in (atleta.get("tenis") or []):
        equipamento.append({**g, "tipo": "tenis", "usos": uso_equip.get(g["id"], 0)})
    for g in (atleta.get("bikes") or []):
        equipamento.append({**g, "tipo": "bike", "usos": uso_equip.get(g["id"], 0)})

    site = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "atleta": {k: v for k, v in atleta.items() if k not in ("tenis", "bikes")},
        "zonas_fc": zonas.get("fc") or [],
        "casa": lugares[Counter(c["l"] for c in compactas if "l" in c).most_common(1)[0][0]] if any("l" in c for c in compactas) else None,
        "detalhados": sum(1 for a in atividades if str(a["id"]) in detalhes),
        "atividades": compactas,
        "lugares": lugares,
        "recordes": recordes,
        "equipamento": equipamento,
    }
    gravar_json(SAIDA / "site.json", site, compacto=True)
    gravar_json(SAIDA / "rotas.json", rotas, compacto=True)
    log(f"Site gerado: {len(compactas)} atividades, {len(rotas)} rotas, {len(lugares)} cidades, {len(recordes)} distâncias com recorde.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--max-detalhes", type=int, default=80, help="quantos treinos detalhar nesta rodada")
    parser.add_argument("--so-gerar", action="store_true", help="não fala com o Strava; só refaz os arquivos")
    parser.add_argument("--sem-esperar", action="store_true", help="não espera a janela de 15 min do Strava")
    args = parser.parse_args()

    if not args.so_gerar:
        env = ler_env()
        faltam = [c for c in ("STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_REFRESH_TOKEN") if not env.get(c)]
        if faltam:
            log(f"Faltam {', '.join(faltam)}. Rode antes: python scripts/strava_auth.py")
            return 1
        if (LOCAL / "DEMO").exists():
            log("Apagando os dados de demonstração antes de baixar os seus...")
            for pasta in (CACHE, LOCAL, SAIDA / "atividades"):
                for arquivo in pasta.glob("*"):
                    if arquivo.is_file():
                        arquivo.unlink()
            for arquivo in ("site.json", "rotas.json"):
                (SAIDA / arquivo).unlink(missing_ok=True)
        esperar = not args.sem_esperar and not os.environ.get("CI")
        sincronizar_strava(env, args.max_detalhes, esperar)
        atividades = ler_json(LOCAL / "atividades.json", [])
        sincronizar_lugares(atividades)
        sincronizar_clima(atividades)
    gerar_site()
    return 0


if __name__ == "__main__":
    sys.exit(main())
