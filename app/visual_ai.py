"""
visual_ai.py — Geração visual de assets (HTML/PDF + imagens de posts).

Provedores suportados (configurados via .env):
  VISUAL_AI_PROVIDER_DOCS=weasyprint | skip
  VISUAL_AI_PROVIDER_POSTS=pexels | skip

A função principal `run_visual_generation` é chamada pelo generate_assets.py
na Etapa 3. Retorna um dict com os caminhos dos arquivos gerados (ou None
quando o provedor é "skip" ou ocorre falha).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

VISUAL_AI_PROVIDER_DOCS  = os.getenv("VISUAL_AI_PROVIDER_DOCS",  "weasyprint").strip().lower()
VISUAL_AI_PROVIDER_POSTS = os.getenv("VISUAL_AI_PROVIDER_POSTS", "pexels"    ).strip().lower()


# ---------------------------------------------------------------------------
# Renderização de documentos (HTML → PDF via WeasyPrint)
# ---------------------------------------------------------------------------

def _render_html_to_pdf(html_content: str, out_path: Path) -> Optional[Path]:
    """Converte uma string HTML em PDF usando WeasyPrint. Retorna o Path ou None."""
    try:
        from weasyprint import HTML  # type: ignore
        HTML(string=html_content).write_pdf(str(out_path))
        logger.info("[visual_ai] PDF gerado: %s", out_path.name)
        return out_path
    except ImportError:
        logger.warning("[visual_ai] WeasyPrint não instalado. Pulando geração de PDF.")
        return None
    except Exception as exc:
        logger.error("[visual_ai] Falha ao gerar PDF %s: %s", out_path.name, exc)
        return None


def _text_to_html(title: str, body: str) -> str:
    """Envolve texto plano em um HTML minimalista para renderização."""
    safe_body = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    paragraphs = "".join(
        f"<p>{line}</p>" for line in safe_body.splitlines() if line.strip()
    )
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto;
           font-size: 13pt; line-height: 1.6; color: #222; }}
    h1   {{ font-size: 20pt; margin-bottom: 24px; }}
    p    {{ margin-bottom: 10px; }}
  </style>
</head>
<body>
  <h1>{title}</h1>
  {paragraphs}
</body>
</html>"""


# ---------------------------------------------------------------------------
# Imagens de posts (Pexels)
# ---------------------------------------------------------------------------

def _fetch_pexels_image(query: str, out_path: Path) -> Optional[Path]:
    """Baixa a primeira imagem do Pexels que corresponda ao query."""
    api_key = os.getenv("PEXELS_API_KEY", "").strip()
    if not api_key:
        logger.warning("[visual_ai] PEXELS_API_KEY não definido. Pulando imagem de post.")
        return None

    import urllib.request
    import urllib.parse
    import json

    url = (
        "https://api.pexels.com/v1/search?"
        + urllib.parse.urlencode({"query": query, "per_page": 1, "orientation": "landscape"})
    )
    req = urllib.request.Request(url, headers={"Authorization": api_key})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        photos = data.get("photos", [])
        if not photos:
            logger.warning("[visual_ai] Pexels: nenhuma imagem para '%s'.", query)
            return None
        img_url = photos[0]["src"]["large"]
        urllib.request.urlretrieve(img_url, str(out_path))
        logger.info("[visual_ai] Imagem Pexels salva: %s", out_path.name)
        return out_path
    except Exception as exc:
        logger.error("[visual_ai] Falha ao buscar imagem Pexels: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Ponto de entrada público
# ---------------------------------------------------------------------------

def run_visual_generation(
    *,
    brief: dict,
    out_dir: Path,
    slides_text: Optional[str] = None,
    emails_text: Optional[str] = None,
    folheto_text: Optional[str] = None,
    ficha_text: Optional[str] = None,
    post_text: Optional[str] = None,
) -> dict:
    """
    Gera os assets visuais conforme os provedores configurados.

    Retorna dict com chaves:
      emails_pdf, folheto_pdf, ficha_pdf, post_image
    Cada valor é o str do Path gerado ou None se pulado/falhou.
    """
    results: dict[str, Optional[str]] = {
        "emails_pdf":  None,
        "folheto_pdf": None,
        "ficha_pdf":   None,
        "post_image":  None,
    }

    produto = brief.get("produto", brief.get("nome", "Produto"))

    # ----------------------------------------------------------------
    # Documentos → HTML + PDF (WeasyPrint)
    # ----------------------------------------------------------------
    if VISUAL_AI_PROVIDER_DOCS == "weasyprint":
        doc_tasks = [
            ("emails_pdf",  "E-mails de Marketing", emails_text),
            ("folheto_pdf", "Folheto Promocional",   folheto_text),
            ("ficha_pdf",   "Ficha Técnica",          ficha_text),
        ]
        for key, title, text in doc_tasks:
            if not text:
                logger.info("[visual_ai] Texto ausente para '%s', pulando.", key)
                continue
            html = _text_to_html(f"{title} — {produto}", text)
            pdf_path = out_dir / f"{key.replace('_pdf', '')}.pdf"
            result = _render_html_to_pdf(html, pdf_path)
            results[key] = str(result) if result else None
    else:
        logger.info("[visual_ai] VISUAL_AI_PROVIDER_DOCS=%s → docs pulados.", VISUAL_AI_PROVIDER_DOCS)

    # ----------------------------------------------------------------
    # Imagem de post (Pexels)
    # ----------------------------------------------------------------
    if VISUAL_AI_PROVIDER_POSTS == "pexels":
        img_path = out_dir / "post_imagem.jpg"
        result = _fetch_pexels_image(produto, img_path)
        results["post_image"] = str(result) if result else None
    else:
        logger.info("[visual_ai] VISUAL_AI_PROVIDER_POSTS=%s → imagens puladas.", VISUAL_AI_PROVIDER_POSTS)

    return results
