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
"""

import time
import logging
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


def _playwright_disponivel() -> bool:
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
        return True
    except ImportError:
        return False


def _renderizar_png(html: str, output_path: Path, width: int, height: Optional[int]) -> Path:
    """Captura screenshot PNG aguardando carregamento completo de fontes e imagens."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"]
        )
        page = browser.new_page(
            viewport={"width": width, "height": height or 900},
            device_scale_factor=2,  # alta resolucao (2x)
        )

        # Injeta HTML e aguarda rede + fontes
        page.set_content(html, wait_until="networkidle")
        page.wait_for_load_state("domcontentloaded")

        # Aguarda fontes web carregarem via JS
        try:
            page.evaluate("document.fonts.ready")
        except Exception:
            pass

        # Pausa extra para animacoes CSS e imagens lazy
        page.wait_for_timeout(800)

        if height is None:
            real_height = page.evaluate("document.body.scrollHeight")
            page.set_viewport_size({"width": width, "height": max(real_height, 100)})
            page.wait_for_timeout(200)

        page.screenshot(
            path=str(output_path),
            full_page=(height is None),
            animations="disabled",
        )
        browser.close()

    return output_path


def _renderizar_png_stories(html: str, output_dir: Path, width: int, height: int) -> list:
    from playwright.sync_api import sync_playwright

    paths = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        page = browser.new_page(
            viewport={"width": width, "height": height},
            device_scale_factor=2,
        )
        page.set_content(html, wait_until="networkidle")
        try:
            page.evaluate("document.fonts.ready")
        except Exception:
            pass
        page.wait_for_timeout(800)

        slides = page.query_selector_all(".story, .slide, [data-slide]")
        if slides:
            for i, slide in enumerate(slides[:3], start=1):
                out = output_dir / f"story_{i:02d}.png"
                slide.screenshot(path=str(out))
                paths.append(out)
        else:
            out = output_dir / "story_01.png"
            page.screenshot(path=str(out), full_page=False, animations="disabled")
            paths.append(out)
        browser.close()
    return paths


def _renderizar_pdf(html: str, output_path: Path) -> Path:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")
        try:
            page.evaluate("document.fonts.ready")
        except Exception:
            pass
        page.wait_for_timeout(600)
        page.pdf(
            path=str(output_path),
            format="A4",
            print_background=True,
            margin={"top": "10mm", "bottom": "10mm", "left": "0", "right": "0"},
        )
        browser.close()
    return output_path


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

    if renderer == "txt":
        path = output_dir / f"{nome_arquivo}.txt"
        path.write_text(conteudo, encoding="utf-8")
        return [path]

    if renderer == "html":
        path = output_dir / f"{nome_arquivo}.html"
        path.write_text(conteudo, encoding="utf-8")
        return [path]

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
            path = output_dir / f"{nome_arquivo}.png"
            _renderizar_png(conteudo, path, width, height)
            return [path]

        elif renderer == "png_stories":
            stories_dir = output_dir / nome_arquivo
            stories_dir.mkdir(parents=True, exist_ok=True)
            paths = _renderizar_png_stories(conteudo, stories_dir, width, height or 1920)
            return paths

        elif renderer == "pdf":
            path = output_dir / f"{nome_arquivo}.pdf"
            _renderizar_pdf(conteudo, path)
            return [path]

    except Exception as e:
        logger.error("Erro na renderizacao visual (%s): %s — salvando como HTML.", fmt.upper(), e)
        path = output_dir / f"{nome_arquivo}_fallback.html"
        path.write_text(conteudo, encoding="utf-8")
        return [path]

    path = output_dir / f"{nome_arquivo}.html"
    path.write_text(conteudo, encoding="utf-8")
    return [path]
