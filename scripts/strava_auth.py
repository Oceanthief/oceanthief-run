"""Autoriza o site a ler seus dados do Strava. Rode uma vez, no seu PC.

    python scripts/strava_auth.py

O script pede o Client ID e o Client Secret do seu app do Strava (se ainda
não estiverem no arquivo .env), abre o navegador para você autorizar e grava
o STRAVA_REFRESH_TOKEN no .env. Nada sai do seu computador além da conversa
direta com o Strava.
"""

import getpass
import http.server
import json
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ENV = RAIZ / ".env"
PORTA = 8721
REDIRECT = f"http://localhost:{PORTA}/callback"
# activity:read (e não read_all) deixa de fora as atividades "Só eu" e os
# trechos dentro das suas zonas de privacidade. É o certo para um site público.
ESCOPO = "read,activity:read,profile:read_all"


def ler_env() -> dict:
    dados = {}
    if ENV.exists():
        for linha in ENV.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if linha and not linha.startswith("#") and "=" in linha:
                chave, valor = linha.split("=", 1)
                dados[chave.strip()] = valor.strip()
    return dados


def salvar_env(dados: dict) -> None:
    linhas = [f"{chave}={valor}" for chave, valor in dados.items()]
    ENV.write_text("\n".join(linhas) + "\n", encoding="utf-8")


class Callback(http.server.BaseHTTPRequestHandler):
    resultado: dict = {}

    def do_GET(self):  # noqa: N802 (nome exigido pelo http.server)
        url = urllib.parse.urlparse(self.path)
        if url.path != "/callback":
            self.send_response(404)
            self.end_headers()
            return
        params = dict(urllib.parse.parse_qsl(url.query))
        Callback.resultado = params
        ok = "code" in params
        corpo = (
            "<h1>Pronto!</h1><p>Pode fechar esta aba e voltar ao terminal.</p>"
            if ok
            else "<h1>A autorização não foi concluída.</h1><p>Volte ao terminal e rode o script de novo.</p>"
        )
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(f"<meta charset='utf-8'><body style='font-family:sans-serif;padding:3rem'>{corpo}</body>".encode())

    def log_message(self, *args):  # silencia o log padrão
        pass


def trocar_codigo(client_id: str, secret: str, codigo: str) -> dict:
    corpo = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": secret,
            "code": codigo,
            "grant_type": "authorization_code",
        }
    ).encode()
    req = urllib.request.Request("https://www.strava.com/oauth/token", data=corpo, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main() -> int:
    env = ler_env()
    client_id = env.get("STRAVA_CLIENT_ID") or input("Client ID do seu app do Strava: ").strip()
    secret = env.get("STRAVA_CLIENT_SECRET") or getpass.getpass("Client Secret (não aparece enquanto digita): ").strip()
    if not client_id or not secret:
        print("Faltou o Client ID ou o Client Secret. Eles ficam em https://www.strava.com/settings/api")
        return 1
    env["STRAVA_CLIENT_ID"] = client_id
    env["STRAVA_CLIENT_SECRET"] = secret
    salvar_env(env)

    servidor = http.server.HTTPServer(("localhost", PORTA), Callback)
    threading.Thread(target=servidor.handle_request, daemon=True).start()

    url = "https://www.strava.com/oauth/authorize?" + urllib.parse.urlencode(
        {
            "client_id": client_id,
            "response_type": "code",
            "redirect_uri": REDIRECT,
            "approval_prompt": "force",
            "scope": ESCOPO,
        }
    )
    print("\nAbrindo o Strava no navegador. Clique em 'Autorizar'.")
    print(f"Se o navegador não abrir, copie este endereço:\n{url}\n")
    webbrowser.open(url)

    print("Esperando a autorização...")
    while not Callback.resultado:
        threading.Event().wait(0.3)
    servidor.server_close()

    params = Callback.resultado
    if "code" not in params:
        print(f"O Strava recusou a autorização ({params.get('error', 'motivo desconhecido')}).")
        return 1
    escopos = params.get("scope", "")
    if "activity:read" not in escopos:
        print("Você desmarcou a permissão de ler atividades. Rode de novo e deixe todas marcadas.")
        return 1

    try:
        token = trocar_codigo(client_id, secret, params["code"])
    except urllib.error.HTTPError as erro:
        print(f"O Strava não aceitou o código ({erro.code}). Confira o Client Secret no .env e rode de novo.")
        return 1

    env["STRAVA_REFRESH_TOKEN"] = token["refresh_token"]
    salvar_env(env)
    atleta = token.get("athlete") or {}
    nome = f"{atleta.get('firstname', '')} {atleta.get('lastname', '')}".strip()
    print(f"\nTudo certo{', ' + nome if nome else ''}! O acesso foi salvo em {ENV}.")
    print("Agora o próximo passo é baixar os dados: python scripts/sync_strava.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
