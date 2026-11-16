"""Cria dados falsos (mas plausíveis) para ver o site antes de ligar o Strava.

    python scripts/gerar_demo.py

Os dados de demonstração são apagados sozinhos na primeira vez que você roda
o sync_strava.py com seus dados de verdade.
"""

import math
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sync_strava as s  # noqa: E402

random.seed(42)

CIDADES = {
    "sp": ((-23.5874, -46.6576), {"cidade": "São Paulo", "estado": "São Paulo", "pais": "Brasil", "cc": "BR"}),
    "rio": ((-22.9711, -43.1822), {"cidade": "Rio de Janeiro", "estado": "Rio de Janeiro", "pais": "Brasil", "cc": "BR"}),
    "floripa": ((-27.5954, -48.5480), {"cidade": "Florianópolis", "estado": "Santa Catarina", "pais": "Brasil", "cc": "BR"}),
    "bh": ((-19.9245, -43.9352), {"cidade": "Belo Horizonte", "estado": "Minas Gerais", "pais": "Brasil", "cc": "BR"}),
    "baires": ((-34.5711, -58.4233), {"cidade": "Buenos Aires", "estado": "Buenos Aires", "pais": "Argentina", "cc": "AR"}),
    "lisboa": ((38.6916, -9.2160), {"cidade": "Lisboa", "estado": "Lisboa", "pais": "Portugal", "cc": "PT"}),
    "ny": ((40.7812, -73.9665), {"cidade": "Nova York", "estado": "Nova York", "pais": "Estados Unidos", "cc": "US"}),
    "chicago": ((41.8826, -87.6226), {"cidade": "Chicago", "estado": "Illinois", "pais": "Estados Unidos", "cc": "US"}),
}
NOMES_CORRIDA = ["Rodagem leve", "Regenerativo", "Intervalado 6x1000", "Tempo run", "Longão de domingo",
                 "Fartlek no parque", "Tiros na pista", "Corrida matinal", "Progressivo", "Corrida no fim de tarde"]
ESFORCOS = [("400m", 400), ("1/2 mile", 805), ("1K", 1000), ("1 mile", 1609), ("2 mile", 3219), ("5K", 5000),
            ("10K", 10000), ("15K", 15000), ("10 mile", 16090), ("20K", 20000), ("Half-Marathon", 21097),
            ("30K", 30000), ("Marathon", 42195)]
PROVAS = [  # (data, nome, km, pace s/km, cidade)
    ("2022-04-10", "Meia de São Paulo", 21.1, 268, "sp"), ("2022-12-31", "Corrida de São Silvestre", 15.0, 262, "sp"),
    ("2023-06-18", "Maratona do Rio", 42.2, 287, "rio"), ("2023-10-08", "Maratona de Chicago", 42.2, 279, "chicago"),
    ("2024-04-07", "Maratona de São Paulo", 42.2, 276, "sp"), ("2024-08-25", "Meia de Buenos Aires", 21.1, 254, "baires"),
    ("2025-03-16", "10K Floripa", 10.0, 236, "floripa"), ("2025-11-02", "Maratona de Nova York", 42.2, 272, "ny"),
    ("2026-05-31", "Maratona de Floripa", 42.2, 266, "floripa"), ("2026-10-18", "Meia de Lisboa", 21.1, 247, "lisboa"),
]


def rota(centro, metros):
    """Um laço fechado irregular com o perímetro aproximado pedido."""
    raio = metros / (2 * math.pi) / 111_000
    fase = random.random() * math.tau
    a, b = 1 + random.random() * 0.6, 1 + random.random() * 0.6
    n = max(30, int(metros / 60))
    pontos = []
    for i in range(n + 1):
        ang = fase + math.tau * i / n
        ruido = 1 + 0.12 * math.sin(ang * 5 + fase) + 0.05 * math.sin(ang * 13)
        lat = centro[0] + raio * a * ruido * math.sin(ang)
        lng = centro[1] + raio * b * ruido * math.cos(ang) / math.cos(math.radians(centro[0]))
        pontos.append((lat, lng))
    return pontos


def main():
    inicio = datetime(2021, 2, 1)
    hoje = datetime.now().replace(second=0, microsecond=0)
    atividades, detalhes, clima, lugares = [], {}, {}, {}
    provas = {p[0]: p for p in PROVAS}
    viagem, viagem_ate = None, None
    aid = 9_000_000_000
    dia = inicio
    while dia.date() <= hoje.date():
        if viagem_ate and dia > viagem_ate:
            viagem = None
        if not viagem and random.random() < 0.012:
            viagem = random.choice(["rio", "floripa", "bh", "baires", "lisboa", "ny"])
            viagem_ate = dia + timedelta(days=random.randint(3, 8))
        anos = (dia - inicio).days / 365
        forma = min(1.0, 0.55 + anos * 0.12)  # vai melhorando com o tempo
        semana = dia.weekday()
        treinos = []
        chave = dia.strftime("%Y-%m-%d")
        if chave in provas:
            _, nome, km, pace, cid = provas[chave]
            treinos.append(("Run", nome, km * 1000, pace, cid, 7, True))
        else:
            descanso = semana == 0 or random.random() < 0.13
            if not descanso:
                if semana == 6:
                    km = random.uniform(16, 22 + 12 * forma)
                    pace = random.uniform(305, 335) - 25 * forma
                    nome = "Longão de domingo"
                elif semana in (1, 3) and random.random() < 0.8:
                    km = random.uniform(9, 14)
                    pace = random.uniform(270, 295) - 20 * forma
                    nome = random.choice(["Intervalado 6x1000", "Tempo run", "Tiros na pista", "Progressivo", "Fartlek no parque"])
                else:
                    km = random.uniform(6, 12)
                    pace = random.uniform(310, 345) - 15 * forma
                    nome = random.choice(NOMES_CORRIDA)
                hora = random.choice([5, 5, 6, 6, 6, 7, 18, 19])
                treinos.append(("Run", nome, km * 1000, pace, viagem or "sp", hora, False))
            if semana == 5 and random.random() < 0.55 and not viagem:
                treinos.append(("Ride", "Pedal de sábado", random.uniform(35, 80) * 1000, 3600 / random.uniform(24, 30), "sp", 7, False))
            if semana in (2, 4) and random.random() < 0.35:
                treinos.append(("Swim", "Natação", random.uniform(1500, 2800), random.uniform(118, 140) / 100 * 1000 / 10, viagem or "sp", 12, False))
            if semana in (0, 2) and random.random() < 0.45:
                treinos.append(("WeightTraining", "Fortalecimento", 0, 0, viagem or "sp", 20, False))
            if random.random() < 0.06:
                treinos.append(("VirtualRide", "Rolo no Zwift", random.uniform(20, 35) * 1000, 3600 / 31, "sp", 21, False))

        for t, nome, metros, pace, cid, hora, eh_prova in treinos:
            aid += random.randint(1, 50)
            centro_cidade, info = CIDADES[cid]
            centro = (centro_cidade[0] + random.uniform(-0.03, 0.03), centro_cidade[1] + random.uniform(-0.03, 0.03))
            if cid == "sp" and random.random() < 0.7:
                centro = (centro_cidade[0] + random.uniform(-0.004, 0.004), centro_cidade[1] + random.uniform(-0.004, 0.004))
            quando = dia.replace(hour=hora, minute=random.randint(0, 50))
            if quando > hoje:
                continue
            indoor = t in ("WeightTraining", "VirtualRide")
            if t == "Swim":
                segundos = int(metros / 100 * random.uniform(118, 140))
            elif t == "WeightTraining":
                segundos = random.randint(2400, 3600)
            else:
                segundos = int(metros / 1000 * pace)
            pts = rota(centro, metros) if not indoor and t != "Swim" and metros else []
            hr = None if t == "WeightTraining" else int(min(178, (172 if eh_prova else 140 + (320 - pace) / 4) + random.uniform(-6, 6)))
            atividades.append({
                "id": aid, "name": nome, "sport_type": t, "type": t,
                "start_date": (quando + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "start_date_local": quando.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "distance": round(metros, 1), "moving_time": segundos, "elapsed_time": int(segundos * random.uniform(1.0, 1.08)),
                "total_elevation_gain": round(metros / 1000 * random.uniform(2, 12), 1) if pts else 0,
                "average_speed": round(metros / segundos, 3) if segundos and metros else 0,
                "max_speed": round(metros / segundos * 1.4, 2) if segundos and metros else 0,
                "average_heartrate": hr, "max_heartrate": hr + random.randint(8, 18) if hr else None,
                "trainer": indoor, "commute": False, "manual": False, "visibility": "everyone", "private": False,
                "workout_type": 1 if eh_prova else (2 if nome == "Longão de domingo" else 0),
                "kudos_count": random.randint(40, 140) if eh_prova else random.randint(2, 30),
                "achievement_count": 0, "pr_count": random.randint(1, 4) if eh_prova else (1 if random.random() < 0.05 else 0),
                "athlete_count": random.randint(2, 6) if random.random() < 0.15 else 1,
                "average_cadence": round(random.uniform(84, 92), 1) if t == "Run" else None,
                "average_watts": random.randint(150, 220) if "Ride" in t else None, "kilojoules": None,
                "gear_id": ("g1" if anos < 2 else "g2" if anos < 4 else "g3") if t == "Run" else ("b1" if "Ride" in t else None),
                "start_latlng": [round(pts[0][0], 5), round(pts[0][1], 5)] if pts else [round(centro[0], 5), round(centro[1], 5)] if t == "Swim" else [],
                "end_latlng": [], "polyline": s.codificar(pts) if pts else "",
            })
            if t == "Run":
                v = metros / segundos
                parciais = []
                restante = metros
                while restante > 50:
                    m = min(1000, restante)
                    vv = v * random.uniform(0.95, 1.05)
                    parciais.append({"m": round(m), "s": int(m / vv), "el": round(random.uniform(-8, 8), 1), "v": round(vv, 3),
                                     "hr": int(hr + random.uniform(-5, 6)) if hr else None})
                    restante -= m
                esforcos = []
                for nome_e, dist_e in ESFORCOS:
                    if dist_e <= metros:
                        fator = 0.90 if dist_e <= 1609 else 0.95 if dist_e <= 5000 else 0.985
                        esforcos.append({"nome": nome_e, "dist": dist_e, "t": int(dist_e / v * fator * random.uniform(0.98, 1.02)), "inicio": 0,
                                         "pr": 1 if eh_prova and random.random() < 0.5 else None})
                detalhes[str(aid)] = {"esforcos": esforcos, "parciais": parciais, "calorias": int(metros / 1000 * 68),
                                      "aparelho": "Garmin Forerunner 265" if anos > 2 else "Garmin Forerunner 55"}
            if pts or t == "Swim":
                p = pts[0] if pts else centro
                lugares[s.celula(*p)] = info
                if (hoje - quando).days > 7 and not indoor:
                    mes = quando.month
                    base = {"sp": 21, "rio": 26, "floripa": 22, "bh": 22, "baires": 17, "lisboa": 17, "ny": 12, "chicago": 13}[cid]
                    sazonal = (4 if mes in (12, 1, 2, 3) else -4 if mes in (6, 7, 8) else 0) * (1 if info["cc"] in ("BR", "AR") else -1.6)
                    temp = base + sazonal + (hora - 9) * 0.6 + random.uniform(-3, 3)
                    cod = random.choices([0, 1, 2, 3, 45, 51, 61, 63, 80, 95], [20, 22, 18, 14, 3, 6, 7, 3, 5, 2])[0]
                    clima[str(aid)] = {"temp": round(temp, 1), "umid": random.randint(45, 95),
                                       "chuva": round(random.uniform(0.2, 6), 1) if cod >= 51 else 0, "vento": random.randint(3, 25), "cod": cod}
        dia += timedelta(days=1)

    atleta = {"id": 12345678, "nome": "Victor", "sobrenome": "", "cidade": "São Paulo", "estado": "SP", "pais": "Brasil",
              "foto": "", "desde": "2021-01-20",
              "tenis": [{"id": "g1", "nome": "Asics Novablast 3", "m": 1_184_000, "principal": False, "aposentado": True},
                        {"id": "g2", "nome": "Adidas Adizero Boston 12", "m": 1_406_000, "principal": False, "aposentado": True},
                        {"id": "g3", "nome": "Nike Pegasus 41", "m": 812_000, "principal": True, "aposentado": False}],
              "bikes": [{"id": "b1", "nome": "Caloi Strada", "m": 4_310_000, "principal": True, "aposentado": False}]}
    zonas = {"fc": [{"min": 0, "max": 128}, {"min": 128, "max": 146}, {"min": 146, "max": 159}, {"min": 159, "max": 172}, {"min": 172, "max": -1}]}

    s.gravar_json(s.LOCAL / "atividades.json", atividades, compacto=True)
    (s.LOCAL / "DEMO").write_text("dados de demonstração", encoding="utf-8")
    s.gravar_json(s.CACHE / "atleta.json", atleta)
    s.gravar_json(s.CACHE / "zonas.json", zonas)
    s.gravar_json(s.CACHE / "detalhes.json", detalhes, compacto=True)
    s.gravar_json(s.CACHE / "clima.json", clima, compacto=True)
    s.gravar_json(s.CACHE / "lugares.json", lugares)
    print(f"Demonstração: {len(atividades)} atividades falsas.")
    s.gerar_site()


if __name__ == "__main__":
    main()
