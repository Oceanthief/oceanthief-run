"""Liga, confere ou desliga o aviso do Strava (webhook) que atualiza o site na hora.

    python scripts/strava_webhook.py preparar      gera as senhas e mostra o que vai no Worker
    python scripts/strava_webhook.py criar URL     inscreve o endereço do Worker no Strava
    python scripts/strava_webhook.py ver           mostra a inscrição atual
    python scripts/strava_webhook.py apagar        cancela a inscrição

O Strava aceita uma inscrição por app. Antes de "criar", o Worker precisa estar
no ar com as mesmas senhas: o Strava testa o endereço na hora e desiste se ele
não responder em 2 segundos.
"""

import json
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

from strava_auth import RAIZ, ler_env, salvar_env

API = "https://www.strava.com/api/v3/push_subscriptions"


def pedir(metodo: str, url: str, dados: dict | None = None):
    corpo = urllib.parse.urlencode(dados).encode() if dados else None
    req = urllib.request.Request(url, data=corpo, method=metodo, headers={"User-Agent": "strava-site"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            texto = resp.read().decode() or "null"
            return json.loads(texto)
    except urllib.error.HTTPError as erro:
        sys.exit(f"O Strava recusou ({erro.code}): {erro.read().decode(errors='replace')}")


def credenciais(env: dict) -> dict:
    if not env.get("STRAVA_CLIENT_ID") or not env.get("STRAVA_CLIENT_SECRET"):
        sys.exit("Faltam STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET no .env. Rode antes: python scripts/strava_auth.py")
    return {"client_id": env["STRAVA_CLIENT_ID"], "client_secret": env["STRAVA_CLIENT_SECRET"]}


def id_do_atleta() -> str:
    for arquivo in (RAIZ / "data" / "site.json", RAIZ / "data" / "cache" / "atleta.json"):
        try:
            dados = json.loads(arquivo.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        atleta = dados.get("atleta", dados)
        if atleta.get("id"):
            return str(atleta["id"])
    return "(rode python scripts/sync_strava.py e tente de novo)"


def preparar() -> None:
    env = ler_env()
    mudou = False
    for chave in ("STRAVA_VERIFY_TOKEN", "CAMINHO_SECRETO"):
        if not env.get(chave):
            env[chave] = secrets.token_urlsafe(24)
            mudou = True
    if mudou:
        salvar_env(env)
    print("Variáveis do Worker na Cloudflare (Settings > Variables and Secrets):\n")
    print(f"  CAMINHO_SECRETO     = {env['CAMINHO_SECRETO']}")
    print(f"  STRAVA_VERIFY_TOKEN = {env['STRAVA_VERIFY_TOKEN']}")
    print(f"  STRAVA_ATHLETE_ID   = {id_do_atleta()}")
    print("  GITHUB_REPO         = usuario/repositorio")
    print("  GITHUB_TOKEN        = (o token do GitHub, como Secret)\n")
    print("Depois, inscreva o endereço no Strava:")
    print(f"  python scripts/strava_webhook.py criar https://SEU-WORKER.workers.dev/strava/{env['CAMINHO_SECRETO']}")


def criar(url: str) -> None:
    env = ler_env()
    if not env.get("STRAVA_VERIFY_TOKEN"):
        sys.exit("Rode antes: python scripts/strava_webhook.py preparar")
    if not url.startswith("https://"):
        sys.exit("O endereço precisa começar com https://")
    resposta = pedir("POST", API, {**credenciais(env), "callback_url": url, "verify_token": env["STRAVA_VERIFY_TOKEN"]})
    print(f"Pronto. Inscrição {resposta.get('id')} criada: cada atividade nova no Strava atualiza o site.")


def ver() -> list:
    env = ler_env()
    lista = pedir("GET", f"{API}?{urllib.parse.urlencode(credenciais(env))}") or []
    if not lista:
        print("Nenhuma inscrição. O site só se atualiza nos horários fixos.")
    for item in lista:
        # o endereço tem o caminho secreto; mostra só o começo
        endereco = item.get("callback_url", "")
        print(f"Inscrição {item.get('id')}: {endereco.split('/strava/')[0]}/strava/..., criada em {item.get('created_at')}")
    return lista


def apagar() -> None:
    env = ler_env()
    for item in ver():
        pedir("DELETE", f"{API}/{item['id']}?{urllib.parse.urlencode(credenciais(env))}")
        print(f"Inscrição {item['id']} apagada.")


def main() -> int:
    args = sys.argv[1:]
    if args[:1] == ["preparar"]:
        preparar()
    elif args[:1] == ["criar"] and len(args) == 2:
        criar(args[1])
    elif args[:1] == ["ver"]:
        ver()
    elif args[:1] == ["apagar"]:
        apagar()
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
