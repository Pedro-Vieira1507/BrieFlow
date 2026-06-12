"""
briefflow_chat.py - BriefFlow: Assistente conversacional de marketing B2B.

Tecnologia:
  - Chamada direta ao Ollama via /api/generate (compativel com todos os modelos)
  - Historico de conversa montado manualmente no prompt
  - Zero dependencias de cloud - 100% local e gratuito

Setup:
  1. Instale Ollama: https://ollama.com
  2. Execute: ollama pull llama3
  3. No .env defina: OLLAMA_MODEL=llama3
  4. pip install requests python-dotenv
  5. python briefflow_chat.py
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(message)s",
    level=logging.WARNING,
)
logger = logging.getLogger("briefflow")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OUTPUT_DIR      = Path(os.getenv("OUTPUT_DIR",   "data/output"))
MAX_TOKENS      = int(os.getenv("MAX_TOKENS",     "1200"))
TEMPERATURE     = float(os.getenv("TEMPERATURE",  "0.7"))
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",        "llama3").strip()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL",     "http://localhost:11434").strip().rstrip("/")
OLLAMA_TIMEOUT  = int(os.getenv("OLLAMA_TIMEOUT",  "180"))

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = f"""Voce e o BriefFlow, assistente especializado em criar materiais de marketing B2B \
para revendedores e distribuidores de produtos tecnicos (laboratorio, industrial, hidraulica, etc).

MATERIAIS QUE VOCE CRIA:
  podcast         - Roteiro de podcast de 5 minutos
  slides          - 10 slides de capacitacao tecnica
  ficha_tecnica   - Ficha com specs e argumentos para vendedores
  email           - 2 emails (apresentacao + oferta com urgencia)
  folheto         - Texto de folheto A4 em 3 paineis
  post_instagram  - 3 posts com legenda e hashtags
  post_linkedin   - 2 posts B2B profissionais
  roteiro_video   - Roteiro de video de 60-90 segundos

REGRAS:
- Gere o conteudo COMPLETO e formatado quando solicitado.
- Apos gerar, pergunte se o usuario quer salvar o material.
- Se faltar contexto, faca UMA pergunta objetiva.
- Responda SEMPRE em portugues pt-BR, de forma direta e amigavel.
- Limite por resposta: {MAX_TOKENS} tokens."""

# ---------------------------------------------------------------------------
# Historico
# ---------------------------------------------------------------------------
_historico: list[tuple[str, str]] = []  # lista de (usuario, assistente)
_ultimo_material: dict = {"conteudo": "", "tipo": ""}


def _montar_prompt(entrada: str) -> str:
    """Monta prompt completo com historico no formato que o llama3 entende."""
    partes = [SYSTEM_PROMPT, ""]

    for user_msg, assistant_msg in _historico[-6:]:  # ultimas 6 trocas
        partes.append(f"Usuario: {user_msg}")
        partes.append(f"BriefFlow: {assistant_msg}")
        partes.append("")

    partes.append(f"Usuario: {entrada}")
    partes.append("BriefFlow:")

    return "\n".join(partes)


# ---------------------------------------------------------------------------
# Verificacao
# ---------------------------------------------------------------------------

def _verificar_ollama() -> None:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=4)
        r.raise_for_status()
        modelos_instalados = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        modelo_base = OLLAMA_MODEL.split(":")[0]
        if modelos_instalados and modelo_base not in modelos_instalados:
            print(
                f"\n[AVISO] Modelo '{OLLAMA_MODEL}' nao encontrado.\n"
                f"  Modelos disponiveis: {', '.join(modelos_instalados)}\n"
                f"  Para instalar: ollama pull {OLLAMA_MODEL}\n"
                f"  Ou troque OLLAMA_MODEL no .env para um dos modelos acima.\n"
            )
    except requests.exceptions.ConnectionError:
        print(
            f"\n[ERRO] Ollama nao esta rodando em {OLLAMA_BASE_URL}\n"
            "  1. Abra outro terminal e execute: ollama serve\n"
            f"  2. Execute novamente: python briefflow_chat.py\n"
        )
        raise SystemExit(1)
    except Exception as e:
        print(f"\n[ERRO] Falha ao verificar Ollama: {e}\n")
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# Chamada ao Ollama via /api/generate
# ---------------------------------------------------------------------------

def _chamar_ollama(entrada: str) -> str:
    prompt = _montar_prompt(entrada)

    payload = {
        "model":  OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": TEMPERATURE,
            "num_predict": MAX_TOKENS,
            "stop": ["\nUsuario:", "\nVoce:"],
        },
    }

    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=OLLAMA_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            "Ollama parou de responder.\n"
            "Execute 'ollama serve' em outro terminal e tente novamente."
        )
    except requests.exceptions.Timeout:
        raise RuntimeError(
            f"Ollama nao respondeu em {OLLAMA_TIMEOUT}s. O modelo pode estar carregando.\n"
            "Aguarde alguns segundos e tente novamente."
        )
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        corpo  = e.response.text[:300] if e.response is not None else ""
        raise RuntimeError(
            f"Erro {status} do Ollama.\n"
            f"Detalhe: {corpo}\n"
            f"Verifique se o modelo '{OLLAMA_MODEL}' esta instalado: ollama list"
        )

    conteudo = resp.json().get("response", "").strip()
    if not conteudo:
        raise RuntimeError("Ollama retornou resposta vazia. Tente novamente.")

    _historico.append((entrada, conteudo))

    # Armazena material se resposta for longa
    if len(conteudo) > 300:
        _ultimo_material["conteudo"] = conteudo
        tipo = _detectar_tipo(entrada)
        if tipo:
            _ultimo_material["tipo"] = tipo

    return conteudo


# ---------------------------------------------------------------------------
# Salvar material
# ---------------------------------------------------------------------------

def _salvar_material(conteudo: str, nome_arquivo: str = "") -> str:
    if not conteudo or not conteudo.strip():
        return "[ERRO] Nenhum conteudo para salvar."

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not nome_arquivo.strip():
        ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
        tipo = _ultimo_material.get("tipo") or "material"
        nome_arquivo = f"{tipo}_{ts}.txt"

    if not nome_arquivo.endswith(".txt"):
        nome_arquivo += ".txt"

    path = OUTPUT_DIR / nome_arquivo
    try:
        path.write_text(conteudo.strip() + "\n", encoding="utf-8")
        return f"[OK] Salvo em: {path}"
    except OSError as e:
        return f"[ERRO] Nao foi possivel salvar: {e}"


def _listar_materiais() -> str:
    if not OUTPUT_DIR.exists():
        return "Nenhum material salvo ainda."
    arquivos = sorted(OUTPUT_DIR.rglob("*.txt"))
    if not arquivos:
        return "Nenhum arquivo encontrado em data/output/."
    linhas = []
    for a in arquivos:
        stat = a.stat()
        data = datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m %H:%M")
        kb   = max(1, stat.st_size // 1024)
        linhas.append(f"  {a.relative_to(OUTPUT_DIR)}  ({kb} KB | {data})")
    return f"Materiais salvos ({len(arquivos)}):\n" + "\n".join(linhas)


def _detectar_tipo(texto: str) -> str:
    texto = texto.lower()
    mapa = {
        "podcast":        ["podcast"],
        "slides":         ["slide", "apresentacao", "capacitacao"],
        "ficha_tecnica":  ["ficha", "especificacao"],
        "email":          ["email", "e-mail"],
        "folheto":        ["folheto", "flyer", "panfleto"],
        "post_instagram": ["instagram", "post"],
        "post_linkedin":  ["linkedin"],
        "roteiro_video":  ["video", "reels"],
    }
    for tipo, palavras in mapa.items():
        if any(p in texto for p in palavras):
            return tipo
    return ""


def _usuario_quer_salvar(entrada: str) -> bool:
    return any(g in entrada.lower() for g in ["sim", "salvar", "salva", "salve", "save", "gravar"])


def _extrair_nome_arquivo(entrada: str) -> str:
    for p in entrada.split():
        if (len(p) > 4) and ("." in p or "_" in p):
            return p
    return ""


# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------

def _banner() -> str:
    linhas = [
        "+" + "=" * 55 + "+",
        "|{:^55}|".format("BriefFlow - Assistente de Marketing B2B"),
        "|{:^55}|".format(f"Modelo: {OLLAMA_MODEL}  |  100% local"),
        "|{:^55}|".format(f"Limite: {MAX_TOKENS} tokens  |  Temp: {TEMPERATURE}"),
        "+" + "=" * 55 + "+",
        "",
        "Exemplos do que voce pode pedir:",
        "  > Crie um podcast sobre a linha DLAB de lubrificantes",
        "  > Emails para a campanha Compre 3 Leve 4 com urgencia",
        "  > 3 posts de Instagram sobre pipetas sorologicas",
        "  > Ficha tecnica dos auxiliares de pipetagem Kasvi",
        "  > Liste os materiais ja salvos",
        "",
        "Digite 'sair' para encerrar.",
    ]
    return "\n".join(linhas)


# ---------------------------------------------------------------------------
# Loop principal
# ---------------------------------------------------------------------------

def main() -> None:
    _verificar_ollama()
    print(_banner())

    aguardando_salvamento = False

    while True:
        try:
            entrada = input("\nVoce: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEncerrando. Ate mais!")
            break

        if not entrada:
            continue

        if entrada.lower() in {"sair", "exit", "quit", "q"}:
            print("\nEncerrando o BriefFlow. Ate mais!")
            break

        # Comando de listagem direto
        if any(k in entrada.lower() for k in ("liste", "listar materiais", "o que foi salvo")):
            print(f"\nBriefFlow: {_listar_materiais()}")
            continue

        # Resposta ao pedido de salvamento
        if aguardando_salvamento and _usuario_quer_salvar(entrada):
            nome = _extrair_nome_arquivo(entrada)
            conteudo = _ultimo_material.get("conteudo", "")
            if conteudo:
                resultado = _salvar_material(conteudo, nome)
                print(f"\nBriefFlow: {resultado}")
            else:
                print("\nBriefFlow: Nao ha material recente para salvar. Gere um primeiro.")
            aguardando_salvamento = False
            continue

        print("\nBriefFlow: ", end="", flush=True)
        try:
            resposta = _chamar_ollama(entrada)
            print(resposta)
            aguardando_salvamento = any(
                k in resposta.lower() for k in ("quer salvar", "deseja salvar", "salvar este", "salvar o material")
            )
        except RuntimeError as e:
            print(f"\n[ERRO] {e}")
        except Exception as e:
            logger.exception("Erro inesperado")
            print(f"\n[ERRO] {e}")


if __name__ == "__main__":
    main()
