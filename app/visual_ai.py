"""
visual_ai.py — Geração visual do pipeline BriefFlow.

Funciona 100% com as chaves gratuitas já disponíveis:
  - GEMINI_API_KEY  → Já usado no pipeline (Google AI Studio — gratuito)
  - PEXELS_API_KEY  → Imagens de stock gratuitas (https://www.pexels.com/api)

O que cada função faz:
  - Slides     → Gerado localmente via python-pptx (template existente do projeto)
  - E-mails    → HTML estático gerado pelo Gemini + renderizado em PDF com WeasyPrint
  - Folhetos   → HTML estático gerado pelo Gemini + renderizado em PDF com WeasyPrint
  - Ficha Téc. → HTML estático gerado pelo Gemini + renderizado em PDF com WeasyPrint
  - Posts      → Gemini Imagen (gratuito) com fallback automático para Pexels

NOTA sobre Gamma e Canva:
  - Gamma não possui API pública disponível (apenas plano Enterprise / waitlist).
  - Canva API requer conta Enterprise. Nenhuma delas tem plano gratuito via API.
  - Por isso, usamos soluções locais equivalentes que não precisam de chave.

Dependencias novas (adicionar ao requirements.txt):
  weasyprint>=61.0
  # python-pptx já está no projeto
  # google-genai já está no projeto
  # requests já está no projeto
"""

from __future__ import annotations

import json
import logging
import os
import textwrap
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configurações via .env
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "").strip()

PROVIDER_POSTS = os.getenv("VISUAL_AI_PROVIDER_POSTS", "gemini_imagen").strip().lower()
# gemini_imagen → tenta Gemini Imagen, fallback Pexels
# pexels        → usa Pexels direto (sem geração de imagem)
# skip          → não gera imagem de post


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    logger.info("[visual_ai] Salvo: %s", path)


def _save_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.strip() + "\n", encoding="utf-8")
    logger.info("[visual_ai] Salvo: %s", path)


def _gemini_client():
    """Retorna cliente Gemini reutilizando a chave já configurada no pipeline."""
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY não definido. Configure em https://aistudio.google.com/app/apikey"
        )
    from google import genai
    return genai.Client(api_key=GEMINI_API_KEY)


# ---------------------------------------------------------------------------
# HTML → PDF via WeasyPrint (geração local, sem API)
# ---------------------------------------------------------------------------

def _html_to_pdf(html: str, output_path: Path) -> Optional[Path]:
    """
    Converte HTML em PDF usando WeasyPrint (local, sem API, sem custo).
    Retorna o caminho do PDF gerado ou None em caso de erro.
    """
    try:
        from weasyprint import HTML as WeasyprintHTML
        WeasyprintHTML(string=html).write_pdf(str(output_path))
        logger.info("[visual_ai] PDF gerado: %s", output_path)
        return output_path
    except ImportError:
        logger.error(
            "[visual_ai] WeasyPrint não instalado. Execute: pip install weasyprint"
        )
    except Exception as e:
        logger.error("[visual_ai] Falha ao gerar PDF '%s': %s", output_path.name, e)
    return None


# ---------------------------------------------------------------------------
# PROMPT AUXILIAR: pede ao Gemini para gerar HTML formatado
# ---------------------------------------------------------------------------

def _generate_html_via_gemini(content_text: str, asset_type: str, campaign_name: str) -> Optional[str]:
    """
    Usa o Gemini (chave já disponível) para converter o texto do asset
    em um HTML bonito e formatado, pronto para impressão.
    """
    style_map = {
        "email": """
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; color: #222; }
            h1 { color: #005B96; font-size: 22px; border-bottom: 2px solid #005B96; padding-bottom: 8px; }
            h2 { color: #005B96; font-size: 16px; margin-top: 24px; }
            p { line-height: 1.7; font-size: 14px; }
            .cta { background: #005B96; color: white; padding: 12px 24px; border-radius: 4px; display: inline-block; margin-top: 16px; text-decoration: none; font-weight: bold; }
            .footer { margin-top: 32px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; }
        """,
        "folheto": """
            @page { size: A4; margin: 15mm; }
            body { font-family: Arial, sans-serif; color: #222; font-size: 13px; }
            h1 { background: #005B96; color: white; padding: 12px 16px; font-size: 20px; margin: 0 0 16px; }
            h2 { color: #005B96; font-size: 15px; margin-top: 20px; border-left: 4px solid #005B96; padding-left: 8px; }
            ul { padding-left: 20px; }
            li { line-height: 1.8; }
            .cta-box { background: #f0f7ff; border: 2px solid #005B96; padding: 16px; margin-top: 24px; border-radius: 4px; }
        """,
        "ficha": """
            @page { size: A4; margin: 15mm; }
            body { font-family: Arial, sans-serif; color: #222; font-size: 12px; }
            h1 { color: #005B96; font-size: 18px; border-bottom: 3px solid #005B96; padding-bottom: 6px; }
            h2 { background: #e8f4fd; color: #005B96; padding: 6px 10px; font-size: 13px; margin-top: 16px; }
            ul { padding-left: 18px; }
            li { line-height: 1.7; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #005B96; color: white; padding: 8px; text-align: left; }
            td { border: 1px solid #ddd; padding: 6px 8px; }
        """,
    }

    css = style_map.get(asset_type, style_map["folheto"])
    asset_label = {"email": "E-mail de Marketing", "folheto": "Folheto Promocional", "ficha": "Ficha Técnica"}.get(asset_type, asset_type)

    prompt = f"""Você é um designer HTML. Converta o texto abaixo em um HTML completo e bem formatado para impressão.

Tipo: {asset_label}
Campanha: {campaign_name}

Texto de conteúdo:
---
{content_text}
---

Regras:
- Retorne APENAS o código HTML, sem explicações, sem markdown, sem ```html.
- Use esta CSS embutida exatamente:
<style>{css}</style>
- Estruture semanticamente com <h1>, <h2>, <p>, <ul>, <li>.
- Adicione um rodapé sutil com o nome da campanha.
- Use cores corporativas azul #005B96.
- O HTML deve ser autocontido (nenhum arquivo externo).
"""

    try:
        from google.genai import types as gtypes
        client = _gemini_client()
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=gtypes.Part.from_text(text=prompt),
            config=gtypes.GenerateContentConfig(temperature=0.3),
        )
        html = (response.text or "").strip()
        # Remove possível bloco markdown que o modelo possa retornar
        if html.startswith("```"):
            html = html.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return html
    except Exception as e:
        logger.error("[visual_ai] Gemini falhou ao gerar HTML para '%s': %s", asset_type, e)
        return None


# ---------------------------------------------------------------------------
# E-MAILS → HTML + PDF (Gemini gera HTML, WeasyPrint renderiza PDF)
# ---------------------------------------------------------------------------

def generate_email_visual(content_text: str, campaign_name: str, out_dir: Path) -> dict:
    """
    Gera e-mail em HTML formatado (para disparar) e PDF (para impressão / aprovação).
    Usa Gemini para formatar + WeasyPrint para renderizar. Sem API externa paga.
    """
    results: dict = {}
    logger.info("[visual_ai] Gerando e-mail visual (Gemini + WeasyPrint)...")

    html = _generate_html_via_gemini(content_text, "email", campaign_name)
    if not html:
        logger.warning("[visual_ai] HTML de e-mail não foi gerado.")
        return results

    html_path = out_dir / "email_formatado.html"
    _save_text(html_path, html)
    results["email_html"] = str(html_path)

    pdf_path = out_dir / "email_formatado.pdf"
    pdf = _html_to_pdf(html, pdf_path)
    if pdf:
        results["email_pdf"] = str(pdf)

    return results


# ---------------------------------------------------------------------------
# FOLHETO → HTML + PDF
# ---------------------------------------------------------------------------

def generate_folheto_visual(content_text: str, campaign_name: str, out_dir: Path) -> dict:
    """Gera folheto A4 em HTML + PDF via Gemini + WeasyPrint."""
    results: dict = {}
    logger.info("[visual_ai] Gerando folheto visual (Gemini + WeasyPrint)...")

    html = _generate_html_via_gemini(content_text, "folheto", campaign_name)
    if not html:
        logger.warning("[visual_ai] HTML de folheto não foi gerado.")
        return results

    html_path = out_dir / "folheto_formatado.html"
    _save_text(html_path, html)
    results["folheto_html"] = str(html_path)

    pdf_path = out_dir / "folheto_formatado.pdf"
    pdf = _html_to_pdf(html, pdf_path)
    if pdf:
        results["folheto_pdf"] = str(pdf)

    return results


# ---------------------------------------------------------------------------
# FICHA TÉCNICA → HTML + PDF
# ---------------------------------------------------------------------------

def generate_ficha_visual(content_text: str, campaign_name: str, out_dir: Path) -> dict:
    """Gera ficha técnica formatada em HTML + PDF via Gemini + WeasyPrint."""
    results: dict = {}
    logger.info("[visual_ai] Gerando ficha técnica visual (Gemini + WeasyPrint)...")

    html = _generate_html_via_gemini(content_text, "ficha", campaign_name)
    if not html:
        logger.warning("[visual_ai] HTML de ficha técnica não foi gerado.")
        return results

    html_path = out_dir / "ficha_formatada.html"
    _save_text(html_path, html)
    results["ficha_html"] = str(html_path)

    pdf_path = out_dir / "ficha_formatada.pdf"
    pdf = _html_to_pdf(html, pdf_path)
    if pdf:
        results["ficha_pdf"] = str(pdf)

    return results


# ---------------------------------------------------------------------------
# POSTS → Gemini Imagen (gratuito) com fallback Pexels (gratuito)
# ---------------------------------------------------------------------------

def generate_post_image_gemini(content_text: str, asset_key: str, out_dir: Path) -> Optional[Path]:
    """
    Gera imagem para post usando Gemini Imagen.
    Gratuito via Google AI Studio até a cota mensal.
    Modelo: imagen-3.0-generate-002
    """
    if not GEMINI_API_KEY:
        logger.warning("[visual_ai] GEMINI_API_KEY não definido. Imagem não será gerada.")
        return None

    try:
        from google import genai
        from google.genai import types as gtypes

        client = genai.Client(api_key=GEMINI_API_KEY)
        image_prompt = (
            f"Imagem profissional para post de marketing B2B corporativo. "
            f"Tema: {content_text[:250].replace(chr(10), ' ')}. "
            f"Estilo: fotografia editorial limpa, cores azul corporativo e branco, "
            f"ambiente laboratorial ou técnico. Sem texto na imagem."
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
        logger.warning("[visual_ai] Gemini Imagen: nenhuma imagem retornada para '%s'.", asset_key)
    except Exception as e:
        logger.error("[visual_ai] Gemini Imagen erro ('%s'): %s", asset_key, e)
    return None


def fetch_pexels_image(query: str, asset_key: str, out_dir: Path) -> Optional[Path]:
    """
    Busca imagem relevante no Pexels (100% gratuito).
    Usado como fallback quando Gemini Imagen não está disponível.
    Registro gratuito: https://www.pexels.com/api
    """
    if not PEXELS_API_KEY:
        logger.warning(
            "[visual_ai] PEXELS_API_KEY não definido. "
            "Registre-se gratuitamente em https://www.pexels.com/api"
        )
        return None

    try:
        url = "https://api.pexels.com/v1/search"
        params = {"query": query[:80], "per_page": 1, "orientation": "landscape"}
        headers = {"Authorization": PEXELS_API_KEY}

        logger.info("[visual_ai] Buscando imagem Pexels para '%s'...", asset_key)
        response = requests.get(url, params=params, headers=headers, timeout=20)
        response.raise_for_status()
        data = response.json()

        photos = data.get("photos", [])
        if not photos:
            logger.warning("[visual_ai] Pexels: nenhuma foto para query '%s'.", query)
            return None

        photo_url = photos[0]["src"]["large2x"]
        img_resp = requests.get(photo_url, timeout=30)
        img_resp.raise_for_status()

        output_path = out_dir / f"{asset_key}_post_pexels.jpg"
        _save_bytes(output_path, img_resp.content)
        return output_path
    except Exception as e:
        logger.error("[visual_ai] Pexels erro ('%s'): %s", asset_key, e)
    return None


def generate_post_image(content_text: str, asset_key: str, out_dir: Path) -> Optional[Path]:
    """
    Gera imagem de post com fallback automático:
      1. Gemini Imagen (gratuito, cota mensal)
      2. Pexels (100% gratuito, sem limite)
    Configurado por VISUAL_AI_PROVIDER_POSTS no .env.
    """
    if PROVIDER_POSTS == "skip":
        return None

    keyword = content_text[:150].replace("\n", " ").strip()

    if PROVIDER_POSTS in ("gemini_imagen", "gemini"):
        result = generate_post_image_gemini(content_text, asset_key, out_dir)
        if result:
            return result
        logger.info("[visual_ai] Gemini Imagen falhou — usando Pexels como fallback...")
        return fetch_pexels_image(keyword, asset_key, out_dir)

    if PROVIDER_POSTS == "pexels":
        return fetch_pexels_image(keyword, asset_key, out_dir)

    logger.warning("[visual_ai] PROVIDER_POSTS='%s' inválido. Use: gemini_imagen, pexels ou skip.", PROVIDER_POSTS)
    return None


# ---------------------------------------------------------------------------
# Interface pública: orquestrador principal
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
    Retorna dicionário com os caminhos de todos os arquivos gerados.

    Nota: Slides visuais já são gerados pelo módulo slides_ppt.py (PPTX).
    Este módulo complementa com: PDFs (emails, folheto, ficha) + imagens de post.
    """
    campaign_name = brief.get("campanha", brief.get("titulo", brief.get("nome", "Campanha")))
    results: dict = {}

    # E-mails → HTML + PDF
    if emails_text:
        results.update(generate_email_visual(emails_text, campaign_name, out_dir))

    # Folheto → HTML + PDF
    if folheto_text:
        results.update(generate_folheto_visual(folheto_text, campaign_name, out_dir))

    # Ficha Técnica → HTML + PDF
    if ficha_text:
        results.update(generate_ficha_visual(ficha_text, campaign_name, out_dir))

    # Posts → Gemini Imagen (fallback: Pexels)
    if post_text:
        post_keyword = brief.get("produto", brief.get("linha", campaign_name))
        post_img = generate_post_image(
            content_text=f"{post_keyword} {post_text[:100]}",
            asset_key="post_instagram",
            out_dir=out_dir,
        )
        if post_img:
            results["post_image"] = str(post_img)

    return results
