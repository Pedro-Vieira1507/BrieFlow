"""
briefflow_v2.py - BriefFlow v2: Pipeline multi-modelo com preview ao vivo.

Fluxo:
  1. qwen2.5-coder:7b  -> Gera HTML/CSS premium a partir do briefing
  2. gemma3:4b          -> Critica o HTML gerado (3-5 melhorias objetivas)
  3. qwen2.5-coder:7b  -> Refina o HTML aplicando as melhorias
  4. preview_server     -> Exibe o resultado em http://localhost:5000

Os modelos rodam SEQUENCIALMENTE para respeitar os 8GB de RAM.

Setup:
  pip install -r requirements.txt
  python briefflow_v2.py
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(format="%(asctime)s | %(levelname)s | %(message)s", level=logging.WARNING)
logger = logging.getLogger("briefflow_v2")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OUTPUT_DIR        = Path(os.getenv("OUTPUT_DIR",         "data/output"))
OLLAMA_BASE_URL   = os.getenv("OLLAMA_BASE_URL",         "http://localhost:11434").rstrip("/")
OLLAMA_TIMEOUT    = int(os.getenv("OLLAMA_TIMEOUT",      "480"))
MODEL_CODER       = os.getenv("MODEL_CODER",             "qwen2.5-coder:7b")   # Gerador HTML
MODEL_CRITIC      = os.getenv("MODEL_CRITIC",            "gemma3:4b")          # Critico Design
TEMPERATURE       = float(os.getenv("TEMPERATURE",       "0.5"))
MAX_TOKENS_HTML   = int(os.getenv("MAX_TOKENS_HTML",     "2800"))
MAX_TOKENS_CRITIC = int(os.getenv("MAX_TOKENS_CRITIC",   "400"))
MAX_TOKENS_REFINE = int(os.getenv("MAX_TOKENS_REFINE",   "2800"))
PREVIEW_PORT      = int(os.getenv("PREVIEW_PORT",        "5000"))
AUTO_OPEN_BROWSER = os.getenv("AUTO_OPEN_BROWSER",       "true").lower() == "true"

# ---------------------------------------------------------------------------
# Dimensoes por tipo de material visual
# ---------------------------------------------------------------------------
DIMENSOES = {
    "post_visual": {"width": "1080px", "height": "1080px", "desc": "Post Redes Sociais 1:1"},
    "flyer_html":  {"width": "794px",  "height": "1123px", "desc": "Flyer A4 Vertical"},
    "card_html":   {"width": "600px",  "height": "400px",  "desc": "Card de Produto"},
    "banner_html": {"width": "1200px", "height": "400px",  "desc": "Banner Horizontal"},
}

GATILHOS = {
    "post_visual": ["post visual", "post grafico", "post para instagram", "arte para",
                    "crie um post", "gere um post", "post para redes"],
    "flyer_html":  ["flyer", "panfleto", "folheto visual", "crie um flyer", "gere um flyer",
                    "material grafico", "layout grafico"],
    "card_html":   ["card de produto", "card html", "cartao de produto", "crie um card"],
    "banner_html": ["banner", "crie um banner", "gere um banner", "banner promocional"],
}

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
PROMPT_GERADOR = """Voce e um dev front-end senior especialista em HTML/CSS para marketing visual.
Gere um arquivo HTML completo, autocontido e visualmente premium para o briefing abaixo.

REGRAS:
1. Retorne SOMENTE o HTML. Sem explicacoes, sem markdown.
2. Comece com <!DOCTYPE html> e termine com </html>.
3. CSS inline em <style>. Sem libs externas.
4. Visual premium: gradientes suaves, sombras, border-radius moderno, hierarquia clara.
5. Canvas centralizado com fundo externo #e8ecf0.
6. Texto em portugues pt-BR.
7. Codigo compacto e eficiente.

PROIBIDO: layout minimalista/simples, so uma coluna de texto, visual de template basico.
"""

PROMPT_CRITICO = """Voce e um Diretor de Arte senior avaliando um HTML de marketing.
Analise o codigo abaixo e liste EXATAMENTE 3 melhorias objetivas e especificas.

FORMATO OBRIGATORIO (retorne apenas isso, sem introducao):
1. [elemento] problema -> solucao especifica
2. [elemento] problema -> solucao especifica
3. [elemento] problema -> solucao especifica

Foco: hierarquia visual, contraste de cores, uso de espaco, impacto do CTA, legibilidade.
"""

PROMPT_REFINADOR = """Voce e um dev front-end senior. Voce recebeu um HTML de marketing e uma lista de melhorias.
Aplique TODAS as melhorias no HTML e retorne o HTML corrigido.

REGRAS:
1. Retorne SOMENTE o HTML corrigido. Sem explicacoes.
2. Comece com <!DOCTYPE html> e termine com </html>.
3. Aplique cada melhoria com precisao cirurgica.
4. Mantenha tudo que ja estava bom.
"""

# ---------------------------------------------------------------------------
# Estado compartilhado com o preview server
# ---------------------------------------------------------------------------
_estado = {
    "html_v1": "",
    "html_v2": "",
    "critica": "",
    "briefing": "",
    "tipo": "",
    "status": "idle",   # idle | gerando | pronto | erro
    "etapa": "",
    "historico": [],    # lista de {versao, html, ts}
}

# ---------------------------------------------------------------------------
# Ollama
# ---------------------------------------------------------------------------
def _verificar_ollama() -> None:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        r.raise_for_status()
        modelos_raw = r.json().get("models", [])
        modelos = [m["name"] for m in modelos_raw]
        bases   = [m.split(":")[0] for m in modelos]
        for modelo in [MODEL_CODER, MODEL_CRITIC]:
            base = modelo.split(":")[0]
            if bases and base not in bases:
                print(f"[AVISO] Modelo '{modelo}' nao encontrado.")
                print(f"  Instale com: ollama pull {modelo}")
    except requests.exceptions.ConnectionError:
        print(f"[ERRO] Ollama offline em {OLLAMA_BASE_URL}. Execute: ollama serve")
        sys.exit(1)

def _chamar_ollama(modelo: str, prompt: str, max_tokens: int) -> str:
    payload = {
        "model": modelo,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": TEMPERATURE,
            "num_predict": max_tokens,
        },
    }
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=OLLAMA_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except requests.exceptions.Timeout:
        raise RuntimeError(
            f"Timeout em {OLLAMA_TIMEOUT}s com {modelo}.\n"
            "Dica: reduza MAX_TOKENS_HTML=2000 no .env"
        )
    except Exception as e:
        raise RuntimeError(f"Erro ao chamar {modelo}: {e}")

def _extrair_html(texto: str) -> str:
    m = re.search(r"```(?:html)?\s*([\s\S]+?)```", texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"(<!DOCTYPE[\s\S]+</html>)", texto, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return texto.strip()

# ---------------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------------
def _detectar_tipo(texto: str) -> str | None:
    t = texto.lower()
    for tipo, gatilhos in GATILHOS.items():
        if any(g in t for g in gatilhos):
            return tipo
    return None

def executar_pipeline(briefing: str, tipo: str) -> None:
    """Roda o pipeline em thread separada para nao bloquear o preview server."""
    dim = DIMENSOES[tipo]
    _estado.update({"briefing": briefing, "tipo": tipo, "status": "gerando",
                    "html_v1": "", "html_v2": "", "critica": ""})

    try:
        # --- Etapa 1: Gerar HTML ---
        _estado["etapa"] = f"[1/3] {MODEL_CODER} gerando HTML..."
        print(f"  {_estado['etapa']}", flush=True)
        prompt_g = (
            f"{PROMPT_GERADOR}"
            f"MATERIAL: {dim['desc']} | CANVAS: {dim['width']} x {dim['height']}\n"
            f"BRIEFING: {briefing}\n\n"
            "HTML completo (comece com <!DOCTYPE html>):"
        )
        raw_v1 = _chamar_ollama(MODEL_CODER, prompt_g, MAX_TOKENS_HTML)
        html_v1 = _extrair_html(raw_v1)
        _estado["html_v1"] = html_v1

        # --- Etapa 2: Critica ---
        _estado["etapa"] = f"[2/3] {MODEL_CRITIC} analisando design..."
        print(f"  {_estado['etapa']}", flush=True)
        prompt_c = (
            f"{PROMPT_CRITICO}"
            f"HTML para avaliar:\n{html_v1[:3000]}\n\n"
            "3 melhorias objetivas:"
        )
        critica = _chamar_ollama(MODEL_CRITIC, prompt_c, MAX_TOKENS_CRITIC)
        _estado["critica"] = critica

        # --- Etapa 3: Refinar ---
        _estado["etapa"] = f"[3/3] {MODEL_CODER} aplicando melhorias..."
        print(f"  {_estado['etapa']}", flush=True)
        prompt_r = (
            f"{PROMPT_REFINADOR}"
            f"MELHORIAS A APLICAR:\n{critica}\n\n"
            f"HTML ORIGINAL:\n{html_v1}\n\n"
            "HTML CORRIGIDO (comece com <!DOCTYPE html>):"
        )
        raw_v2 = _chamar_ollama(MODEL_CODER, prompt_r, MAX_TOKENS_REFINE)
        html_v2 = _extrair_html(raw_v2)
        if len(html_v2) < 200:
            html_v2 = html_v1  # fallback se refinamento falhou
        _estado["html_v2"] = html_v2

        # --- Salvar ---
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path_v1 = OUTPUT_DIR / f"{tipo}_v1_{ts}.html"
        path_v2 = OUTPUT_DIR / f"{tipo}_v2_{ts}.html"
        path_v1.write_text(html_v1, encoding="utf-8")
        path_v2.write_text(html_v2, encoding="utf-8")

        # Historico
        _estado["historico"].insert(0, {
            "versao": f"{tipo}_v2_{ts}",
            "html": html_v2,
            "ts": ts,
            "tipo": tipo,
        })
        if len(_estado["historico"]) > 10:
            _estado["historico"] = _estado["historico"][:10]

        _estado["status"] = "pronto"
        _estado["etapa"] = "Concluido! Preview atualizado."
        print(f"  [OK] Pipeline concluido. Arquivos salvos em {OUTPUT_DIR}/")

    except RuntimeError as e:
        _estado["status"] = "erro"
        _estado["etapa"] = str(e)
        print(f"  [ERRO] {e}")
    except Exception as e:
        logger.exception("Erro inesperado no pipeline")
        _estado["status"] = "erro"
        _estado["etapa"] = str(e)

# ---------------------------------------------------------------------------
# Iniciar preview server em background
# ---------------------------------------------------------------------------
def _iniciar_preview_server() -> None:
    """Inicia o preview_server.py em processo separado."""
    script = Path(__file__).parent / "preview_server.py"
    if not script.exists():
        print("[AVISO] preview_server.py nao encontrado. Preview desabilitado.")
        return
    try:
        subprocess.Popen(
            [sys.executable, str(script)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2)  # aguarda o servidor subir
        if AUTO_OPEN_BROWSER:
            webbrowser.open(f"http://localhost:{PREVIEW_PORT}")
            print(f"  [Preview] Aberto em http://localhost:{PREVIEW_PORT}")
    except Exception as e:
        print(f"[AVISO] Nao foi possivel iniciar o preview server: {e}")

# ---------------------------------------------------------------------------
# Loop principal
# ---------------------------------------------------------------------------
def _banner() -> str:
    return (
        "\n" + "+" + "=" * 62 + "+\n"
        + "|{:^62}|\n".format("BriefFlow v2 - Pipeline Multi-Modelo")
        + "|{:^62}|\n".format(f"{MODEL_CODER}  +  {MODEL_CRITIC}")
        + "|{:^62}|\n".format("Preview ao vivo em http://localhost:5000")
        + "+" + "=" * 62 + "+\n"
        "\nExemplos de materiais visuais:"
        "\n  > Gere um banner promocional da Forlab Express"
        "\n  > Crie um flyer da campanha Compre 3 Leve 4 Kasvi"
        "\n  > Gere um post visual sobre auxiliar de pipetagem"
        "\n  > Crie um card de produto para micropipeta DLAB"
        "\n\nDigite 'sair' para encerrar."
    )

def main() -> None:
    _verificar_ollama()
    _iniciar_preview_server()
    print(_banner())

    while True:
        try:
            entrada = input("\nVoce: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEncerrando. Ate mais!")
            break

        if not entrada:
            continue
        if entrada.lower() in {"sair", "exit", "quit", "q"}:
            print("\nEncerrando o BriefFlow v2. Ate mais!")
            break

        tipo = _detectar_tipo(entrada)
        if not tipo:
            print("\nBriefFlow: Nao reconheci o tipo de material.")
            print("  Tente: banner, flyer, post visual ou card de produto.")
            continue

        if _estado["status"] == "gerando":
            print("\nBriefFlow: Aguarde, ainda estou gerando o material anterior...")
            continue

        dim = DIMENSOES[tipo]
        print(f"\nBriefFlow: Iniciando pipeline para {dim['desc']}...")
        print(f"  Modelos: {MODEL_CODER} (gerador/refinador) + {MODEL_CRITIC} (critico)")
        print(f"  Preview: http://localhost:{PREVIEW_PORT} (atualiza automaticamente)\n")

        thread = threading.Thread(
            target=executar_pipeline,
            args=(entrada, tipo),
            daemon=True,
        )
        thread.start()

        # Aguarda com feedback ao vivo
        while thread.is_alive():
            etapa = _estado.get("etapa", "")
            if etapa:
                print(f"\r  {etapa}", end="", flush=True)
            time.sleep(1)
        print()  # nova linha apos o loop

if __name__ == "__main__":
    main()
