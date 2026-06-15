"""
BriefFlow Renderer
------------------
Converte HTML gerado pelo LLM para o formato nativo de cada material:
  - Banner, Card, Post Instagram  -> PNG
  - Stories Instagram             -> PNG (3 arquivos, 1080x1920)
  - Ficha tecnica, Proposta       -> PDF (A4)
  - Landing page, E-mail          -> HTML
  - Carrossel LinkedIn, Ads, Copy -> TXT

Requer: pip install playwright && playwright install chromium

NOTA WINDOWS: Playwright sync_api nao pode rodar dentro do event loop do uvicorn.
A solucao e executar a captura em um subprocess Python separado.
"""

import json
import logging
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

FORMAT_MAP: dict = {
    "banner": {
        "format": "png", "renderer": "png",
        "width": 1200, "height": None, "label": "Banner",
    },
    "card": {
        "format": "png", "renderer": "png",
        "width": 800, "height": None, "label": "Card de Produto",
    },
    "instagram": {
        "format": "png", "renderer": "png",
        "width": 1080, "height": 1080, "label": "Post Instagram",
    },
    "post instagram": {
        "format": "png", "renderer": "png",
        "width": 1080, "height": 1080, "label": "Post Instagram",
    },
    "stories": {
        "format": "png", "renderer": "png_stories",
        "width": 1080, "height": 1920, "label": "Instagram Stories",
    },
    "ficha": {
        "format": "pdf", "renderer": "pdf",
        "width": 1200, "height": None, "label": "Ficha Tecnica",
    },
    "ficha tecnica": {
        "format": "pdf", "renderer": "pdf",
        "width": 1200, "height": None, "label": "Ficha Tecnica",
    },
    "proposta": {
        "format": "pdf", "renderer": "pdf",
        "width": 1200, "height": None, "label": "Proposta Comercial",
    },
    "one pager": {
        "format": "pdf", "renderer": "pdf",
        "width": 1200, "height": None, "label": "One-Pager",
    },
    "landing page": {
        "format": "html", "renderer": "html",
        "width": 1440, "height": None, "label": "Landing Page",
    },
    "email": {
        "format": "html", "renderer": "html",
        "width": 600, "height": None, "label": "E-mail Marketing",
    },
    "e-mail": {
        "format": "html", "renderer": "html",
        "width": 600, "height": None, "label": "E-mail Marketing",
    },
    "linkedin": {
        "format": "txt", "renderer": "txt",
        "width": None, "height": None, "label": "Carrossel LinkedIn",
    },
    "post linkedin": {
        "format": "txt", "renderer": "txt",
        "width": None, "height": None, "label": "Carrossel LinkedIn",
    },
    "reels": {
        "format": "txt", "renderer": "txt",
        "width": None, "height": None, "label": "Roteiro Reels/TikTok",
    },
    "tiktok": {
        "format": "txt", "renderer": "txt",
        "width": None, "height": None, "label": "Roteiro TikTok",
    },
    "google ads": {
        "format": "txt", "renderer": "txt",
        "width": None, "height": None, "label": "Google Ads",
    },
    "meta ads": {
        "format": "txt", "renderer": "txt",
        "width": None, "height": None, "label": "Meta Ads",
    },
    "whatsapp": {
        "format": "txt", "renderer": "txt",
        "width": None, "height": None, "label": "Script WhatsApp",
    },
    "script": {
        "format": "txt", "renderer": "txt",
        "width": None, "height": None, "label": "Script",
    },
}


# ---------------------------------------------------------------------------
# Script embutido que roda em subprocess isolado (sem conflito de event loop)
# ---------------------------------------------------------------------------

_WORKER_SCRIPT = """
import sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright

args_json = sys.argv[1]
a = json.loads(args_json)

renderer = a["renderer"]
html     = a["html"]
output   = a["output"]
width    = a["width"]
height   = a.get("height")
stories_dir = a.get("stories_dir")

def launch_browser(p):
    return p.chromium.launch(
        args=["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"]
    )

with sync_playwright() as p:
    if renderer == "png":
        browser = launch_browser(p)
        page = browser.new_page(
            viewport={"width": width, "height": height or 900},
            device_scale_factor=2,
        )
        page.set_content(html, wait_until="networkidle")
        page.wait_for_load_state("domcontentloaded")
        try:
            page.evaluate("document.fonts.ready")
        except Exception:
            pass
        page.wait_for_timeout(800)
        if height is None:
            real_h = page.evaluate("document.body.scrollHeight")
            page.set_viewport_size({"width": width, "height": max(real_h, 100)})
            page.wait_for_timeout(200)
        page.screenshot(path=output, full_page=(height is None), animations="disabled")
        browser.close()
        print(json.dumps({"ok": True, "files": [output]}))

    elif renderer == "png_stories":
        browser = launch_browser(p)
        page = browser.new_page(
            viewport={"width": width, "height": height or 1920},
            device_scale_factor=2,
        )
        page.set_content(html, wait_until="networkidle")
        try:
            page.evaluate("document.fonts.ready")
        except Exception:
            pass
        page.wait_for_timeout(800)
        slides = page.query_selector_all(".story, .slide, [data-slide]")
        paths = []
        sd = Path(stories_dir)
        sd.mkdir(parents=True, exist_ok=True)
        if slides:
            for i, slide in enumerate(slides[:3], start=1):
                out = str(sd / f"story_{i:02d}.png")
                slide.screenshot(path=out)
                paths.append(out)
        else:
            out = str(sd / "story_01.png")
            page.screenshot(path=out, full_page=False, animations="disabled")
            paths.append(out)
        browser.close()
        print(json.dumps({"ok": True, "files": paths}))

    elif renderer == "pdf":
        browser = launch_browser(p)
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")
        try:
            page.evaluate("document.fonts.ready")
        except Exception:
            pass
        page.wait_for_timeout(600)
        page.pdf(
            path=output,
            format="A4",
            print_background=True,
            margin={"top": "10mm", "bottom": "10mm", "left": "0", "right": "0"},
        )
        browser.close()
        print(json.dumps({"ok": True, "files": [output]}))
"""


def _playwright_disponivel() -> bool:
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
        return True
    except ImportError:
        return False


def _run_in_subprocess(payload: dict) -> list[str]:
    """
    Executa o worker Playwright em subprocess isolado para evitar conflito
    de event loop no Windows quando chamado de dentro do uvicorn/asyncio.
    """
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as tf:
        tf.write(_WORKER_SCRIPT)
        script_path = tf.name

    try:
        result = subprocess.run(
            [sys.executable, script_path, json.dumps(payload)],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "subprocess falhou sem stderr")

        # Ultima linha do stdout e o JSON com resultado
        last_line = result.stdout.strip().splitlines()[-1]
        data = json.loads(last_line)
        return data["files"]

    finally:
        Path(script_path).unlink(missing_ok=True)


def renderizar(conteudo: str, material_key: str, output_dir: Path, nome_base: str) -> list:
    """
    Renderiza o conteudo gerado pelo LLM no formato correto para o material.

    Args:
        conteudo    : Texto/HTML retornado pelo LLM.
        material_key: Chave do material (ex: 'banner', 'ficha', 'instagram').
        output_dir  : Diretorio de saida.
        nome_base   : Nome base do arquivo (sem extensao).

    Returns:
        Lista de Path dos arquivos gerados.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp    = time.strftime("%Y%m%d_%H%M%S")
    nome_arquivo = f"{nome_base}_{timestamp}"

    config   = FORMAT_MAP.get(material_key.lower(), {"format": "txt", "renderer": "txt", "label": material_key})
    renderer = config["renderer"]
    fmt      = config["format"]
    label    = config["label"]
    width    = config.get("width") or 1200
    height   = config.get("height")

    logger.info("Renderizando '%s' como %s...", label, fmt.upper())

    # --- Formatos texto/HTML: sem Playwright ---
    if renderer == "txt":
        path = output_dir / f"{nome_arquivo}.txt"
        path.write_text(conteudo, encoding="utf-8")
        return [path]

    if renderer == "html":
        path = output_dir / f"{nome_arquivo}.html"
        path.write_text(conteudo, encoding="utf-8")
        return [path]

    # --- Formatos visuais: requerem Playwright ---
    if not _playwright_disponivel():
        logger.warning(
            "Playwright nao instalado. Salvando '%s' como HTML.\n"
            "Para ativar: pip install playwright && playwright install chromium",
            label
        )
        path = output_dir / f"{nome_arquivo}.html"
        path.write_text(conteudo, encoding="utf-8")
        return [path]

    try:
        if renderer == "png":
            output_path = str(output_dir / f"{nome_arquivo}.png")
            payload = {
                "renderer": "png",
                "html": conteudo,
                "output": output_path,
                "width": width,
                "height": height,
            }
            files = _run_in_subprocess(payload)
            return [Path(f) for f in files]

        elif renderer == "png_stories":
            stories_dir = output_dir / nome_arquivo
            payload = {
                "renderer": "png_stories",
                "html": conteudo,
                "output": "",
                "width": width,
                "height": height or 1920,
                "stories_dir": str(stories_dir),
            }
            files = _run_in_subprocess(payload)
            return [Path(f) for f in files]

        elif renderer == "pdf":
            output_path = str(output_dir / f"{nome_arquivo}.pdf")
            payload = {
                "renderer": "pdf",
                "html": conteudo,
                "output": output_path,
                "width": width,
                "height": height,
            }
            files = _run_in_subprocess(payload)
            return [Path(f) for f in files]

    except Exception as e:
        logger.error("Erro na renderizacao visual (%s): %s — salvando como HTML.", fmt.upper(), e)
        path = output_dir / f"{nome_arquivo}_fallback.html"
        path.write_text(conteudo, encoding="utf-8")
        return [path]

    # fallback final (nao deveria chegar aqui)
    path = output_dir / f"{nome_arquivo}.html"
    path.write_text(conteudo, encoding="utf-8")
    return [path]
