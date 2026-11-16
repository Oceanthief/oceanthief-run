"""Confere se toda frase traduzível do site tem versão em inglês e em espanhol.

    python scripts/checar_traducoes.py            lista o que falta
    python scripts/checar_traducoes.py --chaves   lista todas as frases encontradas

Procura t("..."), plural(n, "...", "...") nos scripts, data-t nos HTML, os
títulos de seção do perfil.json e os textos do plano.json, e compara com o
dicionário em assets/js/traducoes.js.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
JS = RAIZ / "assets" / "js"


def frases() -> list[str]:
    achadas: list[str] = []

    def add(s: str) -> None:
        s = s.replace('\\"', '"')
        if s and s not in achadas:
            achadas.append(s)

    for arq in sorted(JS.glob("*.js")):
        if arq.name == "traducoes.js":
            continue
        texto = arq.read_text(encoding="utf-8")
        for m in re.finditer(r'\bt\(\s*"((?:[^"\\]|\\.)*)"', texto):
            add(m.group(1))
        for m in re.finditer(r'\bplural\([^,]+,\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"', texto):
            add(m.group(1))
            add(m.group(2))
    for arq in sorted(RAIZ.glob("*.html")):
        texto = arq.read_text(encoding="utf-8")
        for m in re.finditer(r"<[^>]*\sdata-t(?=[\s>=])(?:=\"([^\"]*)\")?[^>]*>([^<]*)(?=<)", texto):
            add((m.group(1) or m.group(2)).strip())
        for m in re.finditer(r'aria-label="([^"]*)"[^>]*data-t-aria|data-t-aria[^>]*aria-label="([^"]*)"', texto):
            add(m.group(1) or m.group(2))
    perfil = json.loads((RAIZ / "config" / "perfil.json").read_text(encoding="utf-8"))
    for valor in (perfil.get("secoes") or {}).values():
        if isinstance(valor, list):
            for s in valor:
                add(s)
    plano = json.loads((RAIZ / "config" / "plano.json").read_text(encoding="utf-8"))
    for s in (plano.get("fases") or {}).values():
        if isinstance(s, str):
            add(s)
    for semana in plano.get("semanas") or []:
        if isinstance(semana.get("foco"), str):
            add(semana["foco"])
        for treino in semana.get("treinos") or []:
            for campo in ("titulo", "detalhe"):
                if isinstance(treino.get(campo), str):
                    add(treino[campo])
    return achadas


def dicionario() -> dict:
    # o próprio Node lê o módulo, para não haver diferença entre o que o site e este script veem
    codigo = (
        "import(process.argv[1]).then(m => process.stdout.write(JSON.stringify(m.default)))"
    )
    url = (JS / "traducoes.js").resolve().as_uri()
    saida = subprocess.run(["node", "-e", codigo, url], capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(saida.stdout)


def main() -> int:
    lista = frases()
    if "--chaves" in sys.argv:
        sys.stdout.reconfigure(encoding="utf-8")
        for s in lista:
            print(s)
        return 0
    d = dicionario()
    sobra = {lang: sorted(set(d.get(lang, {})) - set(lista)) for lang in ("en", "es")}
    falta = {lang: [s for s in lista if s not in d.get(lang, {})] for lang in ("en", "es")}
    sys.stdout.reconfigure(encoding="utf-8")
    ok = True
    for lang in ("en", "es"):
        if falta[lang]:
            ok = False
            print(f"Faltam {len(falta[lang])} frases em {lang}:")
            for s in falta[lang]:
                print(f"  {s}")
    # marcadores {x} precisam ser os mesmos nas três línguas
    for lang in ("en", "es"):
        for k, v in d.get(lang, {}).items():
            if sorted(re.findall(r"\{\w+\}", k)) != sorted(re.findall(r"\{\w+\}", v)):
                ok = False
                print(f"Marcadores diferentes em {lang}: {k!r} -> {v!r}")
    if sobra["en"]:
        print(f"(No dicionário, mas sem uso no site: {len(sobra['en'])})")
        for s in sobra["en"]:
            print(f"  {s}")
    print(f"{len(lista)} frases; " + ("todas traduzidas." if ok else "há pendências."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
