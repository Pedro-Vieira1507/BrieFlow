"""
visual_ai.py — Geração visual do pipeline BriefFlow.

Funciona 100% com as chaves gratuitas já disponíveis:
  GEMINI_API_KEY  → Google AI Studio (gratuito) — https://aistudio.google.com/app/apikey
  PEXELS_API_KEY  → Pexels stock gratuito       — https://www.pexels.com/api

O que cada função gera:
  E-mails    → HTML formatado + PDF (via WeasyPrint, local)
  Folheto    → HTML A4 + PDF
  Ficha Téc. → HTML A4 + PDF
  Posts      → PNG via Gemini Imagen OU JPG via Pexels (fallback automático)

Configurações no .env que controlam esta etapa:
  SKIP_VISUAL_AI=false            → true para pular tudo
  VISUAL_AI_PROVIDER_POSTS=...    → gemini_imagen | pexels | skip
  VISUAL_AI_PROVIDER_DOCS=...     → weasyprint | skip

Dependencias novas:
  pip install weasyprint
  # google-genai e requests já estão no projeto
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configurações via .env
# ---------------------------------------------------------------------------
GEMINI_API_KEY           = os.getenv("GEMINI_API_KEY",           "").strip()
GEMINI_MODEL             = os.getenv("GEMINI_MODEL",             "gemini-2.0-flash")
PEXELS_API_KEY           = os.getenv("PEXELS_API_KEY",           "").strip()
PROVIDER_POSTS           = os.getenv("VISUAL_AI_PROVIDER_POSTS", "gemini_imagen").strip().lower()
PROVIDER_DOCS            = os.getenv("VISUAL_AI_PROVIDER_DOCS",  "weasyprint"   ).strip().lower()


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _save_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    logger.info("[visual_ai] Salvo: %s", path.name)


def _save_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.strip() + "\n", encoding="utf-8")
    logger.info("[visual_ai] Salvo: %s", path.name)


def _gemini_client():
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY não definido. Obtenha gratuitamente em: "
            "https://aistudio.google.com/app/apikey"
        )
    from google import genai
    return genai.Client(api_key=GEMINI_API_KEY)


# ---------------------------------------------------------------------------
# HTML → PDF via WeasyPrint (local, sem API, sem custo)
# ---------------------------------------------------------------------------

def _html_to_pdf(html: str, output_path: Path) -> Optional[Path]:
    """
    Renderiza HTML como PDF localmente usando WeasyPrint.
    VISUAL_AI_PROVIDER_DOCS=skip pula esta etapa.
    """
    if PROVIDER_DOCS == "skip":
        logger.info("[visual_ai] VISUAL_AI_PROVIDER_DOCS=skip, PDF ignorado.")
        return None

    try:
        from weasyprint import HTML as WeasyprintHTML
        WeasyprintHTML(string=html).write_pdf(str(output_path))
        logger.info("[visual_ai] PDF gerado: %s", output_path.name)
        return output_path
    except ImportError:
        logger.error(
            "[visual_ai] WeasyPrint não instalado. "
            "Execute: pip install weasyprint"
        )
    except Exception as e:
        logger.error("[visual_ai] Falha ao gerar PDF '%s': %s", output_path.name, e)
    return None


# ---------------------------------------------------------------------------
# Gemini formata texto → HTML bonito
# ---------------------------------------------------------------------------

_CSS_MAP = {
    "email": """
        body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#222}
        h1{color:#005B96;font-size:22px;border-bottom:2px solid #005B96;padding-bottom:8px}
        h2{color:#005B96;font-size:16px;margin-top:24px}
        p{line-height:1.7;font-size:14px}
        .cta{background:#005B96;color:#fff;padding:12px 24px;border-radius:4px;
             display:inline-block;margin-top:16px;text-decoration:none;font-weight:bold}
        .footer{margin-top:32px;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:12px}
    """,
    "folheto": """
        @page{size:A4;margin:15mm}
        body{font-family:Arial,sans-serif;color:#222;font-size:13px}
        h1{background:#005B96;color:#fff;padding:12px 16px;font-size:20px;margin:0 0 16px}
        h2{color:#005B96;font-size:15px;margin-top:20px;border-left:4px solid #005B96;padding-left:8px}
        ul{padding-left:20px} li{line-height:1.8}
        .cta-box{background:#f0f7ff;border:2px solid #005B96;padding:16px;margin-top:24px;border-radius:4px}
    """,
    "ficha": """
        @page{size:A4;margin:15mm}
        body{font-family:Arial,sans-serif;color:#222;font-size:12px}
        h1{color:#005B96;font-size:18px;border-bottom:3px solid #005B96;padding-bottom:6px}
        h2{background:#e8f4fd;color:#005B96;padding:6px 10px;font-size:13px;margin-top:16px}
        ul{padding-left:18px} li{line-height:1.7}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th{background:#005B96;color:#fff;padding:8px;text-align:left}
        td{border:1px solid #ddd;padding:6px 8px}
    """,
}

_LABEL_MAP = {
    "email":   "E-mail de Marketing",
    "folheto": "Folheto Promocional",
    "ficha":   "Ficha Técnica",
}


def _generate_html_via_gemini(
    content_text: str, asset_type: str, campaign_name: str
) -> Optional[str]:
    """Pede ao Gemini para formatar o texto já gerado como HTML bonito."""
    if PROVIDER_DOCS == "skip":
        logger.info("[visual_ai] VISUAL_AI_PROVIDER_DOCS=skip, HTML ignorado.")
        return None

    css   = _CSS_MAP.get(asset_type, _CSS_MAP["folheto"])
    label = _LABEL_MAP.get(asset_type, asset_type)

    prompt = (
        f"Você é um designer HTML. Converta o texto abaixo em HTML completo "
        f"para impressão.\n"
        f"Tipo: {label}\nCampanha: {campaign_name}\n\n"
        f"Texto:\n---\n{content_text}\n---\n\n"
        f"Regras:\n"
        f"- Retorne APENAS o código HTML, sem explicações nem ```html.\n"
        f"- Use esta CSS embutida:\n<style>{css}</style>\n"
        f"- Estruture com <h1>, <h2>, <p>, <ul>, <li>.\n"
        f"- Adicione rodapé com o nome da campanha.\n"
        f"- HTML autocontido, sem arquivos externos."
    )

    try:
        from google.genai import types as gtypes
        client = _gemini_client()
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=gtypes.Part.from_text(text=prompt),
            config=gtypes.GenerateContentConfig(temperature=0.3),
        )
        html = (response.text or "").strip()
        # Remove bloco markdown caso o modelo retorne ```html ... ```
        if html.startswith("```"):
            html = html.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return html
    except Exception as e:
        logger.error("[visual_ai] Gemini falhou ao formatar HTML '%s': %s", asset_type, e)
        return None


# ---------------------------------------------------------------------------
# Geradores de documentos (email / folheto / ficha)
# ---------------------------------------------------------------------------

def _generate_doc_visual(
    content_text: str,
    campaign_name: str,
    asset_type: str,
    html_filename: str,
    pdf_filename: str,
    out_dir: Path,
) -> dict:
    results: dict = {}
    logger.info("[visual_ai] Gerando %s visual...", _LABEL_MAP.get(asset_type, asset_type))

    html = _generate_html_via_gemini(content_text, asset_type, campaign_name)
    if not html:
        return results

    html_path = out_dir / html_filename
    _save_text(html_path, html)
    results[f"{asset_type}_html"] = str(html_path)

    pdf_path = out_dir / pdf_filename
    pdf = _html_to_pdf(html, pdf_path)
    if pdf:
        results[f"{asset_type}_pdf"] = str(pdf)

    return results


def generate_email_visual(content_text: str, campaign_name: str, out_dir: Path) -> dict:
    return _generate_doc_visual(
        content_text, campaign_name, "email",
        "email_formatado.html", "email_formatado.pdf", out_dir,
    )


def generate_folheto_visual(content_text: str, campaign_name: str, out_dir: Path) -> dict:
    return _generate_doc_visual(
        content_text, campaign_name, "folheto",
        "folheto_formatado.html", "folheto_formatado.pdf", out_dir,
    )


def generate_ficha_visual(content_text: str, campaign_name: str, out_dir: Path) -> dict:
    return _generate_doc_visual(
        content_text, campaign_name, "ficha",
        "ficha_formatada.html", "ficha_formatada.pdf", out_dir,
    )


# ---------------------------------------------------------------------------
# Gerador de imagens para posts
# ---------------------------------------------------------------------------

def _generate_post_gemini_imagen(content_text: str, asset_key: str, out_dir: Path) -> Optional[Path]:
    """Gera imagem via Gemini Imagen (gratuito via Google AI Studio)."""
    if not GEMINI_API_KEY:
        logger.warning("[visual_ai] GEMINI_API_KEY não definido.")
        return None
    try:
        from google import genai
        from google.genai import types as gtypes
        client = genai.Client(api_key=GEMINI_API_KEY)
        image_prompt = (
            f"Imagem profissional para post de marketing B2B corporativo. "
            f"Tema: {content_text[:200].replace(chr(10), ' ')}. "
            f"Estilo: fotografia editorial, cores azul corporativo e branco, "
            f"ambiente laboratorial. Sem texto."
        )
        logger.info("[visual_ai] Gerando imagem via Gemini Imagen para '%s'...", asset_key)
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=image_prompt,
            config=gtypes.GenerateImagesConfig(number_of_images=1),
        )
        if response.generated_images:
            img_bytes = response.generated_images[0].image.image_bytes
            output_path = out_dir / f"{asset_key}_post.png"
            _save_bytes(output_path, img_bytes)
            return output_path
        logger.warning("[visual_ai] Gemini Imagen: nenhuma imagem retornada.")
    except Exception as e:
        logger.error("[visual_ai] Gemini Imagen erro: %s", e)
    return None


def _fetch_pexels_image(query: str, asset_key: str, out_dir: Path) -> Optional[Path]:
    """Busca imagem no Pexels (100%% gratuito). Usado como fallback."""
    if not PEXELS_API_KEY:
        logger.warning(
            "[visual_ai] PEXELS_API_KEY não definido. "
            "Registre-se gratuitamente em https://www.pexels.com/api"
        )
        return None
    try:
        response = requests.get(
            "https://api.pexels.com/v1/search",
            params={"query": query[:80], "per_page": 1, "orientation": "landscape"},
            headers={"Authorization": PEXELS_API_KEY},
            timeout=20,
        )
        response.raise_for_status()
        photos = response.json().get("photos", [])
        if not photos:
            logger.warning("[visual_ai] Pexels: nenhuma foto para '%s'.", query)
            return None
        img_resp = requests.get(photos[0]["src"]["large2x"], timeout=30)
        img_resp.raise_for_status()
        output_path = out_dir / f"{asset_key}_post_pexels.jpg"
        _save_bytes(output_path, img_resp.content)
        return output_path
    except Exception as e:
        logger.error("[visual_ai] Pexels erro: %s", e)
    return None


def generate_post_image(
    content_text: str, asset_key: str, out_dir: Path
) -> Optional[Path]:
    """
    Gera imagem de post com fallback automático:
      VISUAL_AI_PROVIDER_POSTS=gemini_imagen → Gemini Imagen → Pexels (fallback)
      VISUAL_AI_PROVIDER_POSTS=pexels        → Pexels direto
      VISUAL_AI_PROVIDER_POSTS=skip          → não gera imagem
    """
    if PROVIDER_POSTS == "skip":
        logger.info("[visual_ai] VISUAL_AI_PROVIDER_POSTS=skip, imagem de post ignorada.")
        return None

    keyword = content_text[:150].replace("\n", " ").strip()

    if PROVIDER_POSTS in ("gemini_imagen", "gemini"):
        logger.info("[visual_ai] Provider de posts: Gemini Imagen (fallback: Pexels)")
        result = _generate_post_gemini_imagen(content_text, asset_key, out_dir)
        if result:
            return result
        logger.info("[visual_ai] Gemini Imagen não disponivel — usando Pexels como fallback...")
        return _fetch_pexels_image(keyword, asset_key, out_dir)

    if PROVIDER_POSTS == "pexels":
        logger.info("[visual_ai] Provider de posts: Pexels direto")
        return _fetch_pexels_image(keyword, asset_key, out_dir)

    logger.warning(
        "[visual_ai] VISUAL_AI_PROVIDER_POSTS='%s' inválido. "
        "Use: gemini_imagen, pexels ou skip.", PROVIDER_POSTS
    )
    return None


# ---------------------------------------------------------------------------
# Interface pública: orquestrador desta etapa
# ---------------------------------------------------------------------------

def run_visual_generation(
    brief: dict,
    out_dir: Path,
    slides_text: Optional[str] = None,
    emails_text: Optional[str] = None,
    folheto_text: Optional[str] = None,
    ficha_text: Optional[str] = None,
    post_text: Optional[str] = None,
) -> dict:
    """
    Orquestra toda a geração visual para um brief.
    Retorna dicionário com caminhos de todos os arquivos gerados.

    Controlado pelas variáveis:
      VISUAL_AI_PROVIDER_DOCS=weasyprint|skip
      VISUAL_AI_PROVIDER_POSTS=gemini_imagen|pexels|skip
    """
    campaign = brief.get("campanha") or brief.get("titulo") or brief.get("nome", "Campanha")
    results: dict = {}

    logger.info(
        "[visual_ai] Iniciando geração visual | docs=%s | posts=%s",
        PROVIDER_DOCS, PROVIDER_POSTS,
    )

    if emails_text:
        results.update(generate_email_visual(emails_text, campaign, out_dir))

    if folheto_text:
        results.update(generate_folheto_visual(folheto_text, campaign, out_dir))

    if ficha_text:
        results.update(generate_ficha_visual(ficha_text, campaign, out_dir))

    if post_text:
        post_keyword = brief.get("produto") or brief.get("linha") or campaign
        post_img = generate_post_image(
            content_text=f"{post_keyword} {post_text[:100]}",
            asset_key="post_instagram",
            out_dir=out_dir,
        )
        if post_img:
            results["post_image"] = str(post_img)

    return results
