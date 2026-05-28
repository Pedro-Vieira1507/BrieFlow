"""
visual_ai.py — Módulo de geração visual para o pipeline BriefFlow.

Integrações disponíveis (com opções gratuitas):
  - Gamma API         → Slides (plano gratuito: 400 créditos/mês)
  - Canva API         → E-mails, Folhetos, Ficha Técnica (plano gratuito disponível)
  - DALL-E 3          → Posts (pago, ~$0.04/imagem)
  - Gemini Imagen     → Posts (gratuito via Google AI Studio até cota mensal)
  - Pexels API        → Imagens de stock gratuitas (totalmente free)

Variáveis necessárias no .env:
  GAMMA_API_KEY           → https://gamma.app (gratuito)
  CANVA_API_KEY           → https://www.canva.com/developers (gratuito)
  OPENAI_API_KEY          → https://platform.openai.com (pago, DALL-E 3)
  GEMINI_API_KEY          → já existente no pipeline (gratuito, Imagen)
  PEXELS_API_KEY          → https://www.pexels.com/api (totalmente gratuito)

Controle via .env:
  VISUAL_AI_PROVIDER_SLIDES=gamma        # gamma | skip
  VISUAL_AI_PROVIDER_DESIGN=canva        # canva | skip
  VISUAL_AI_PROVIDER_POSTS=gemini_imagen # gemini_imagen | dalle | pexels | skip
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuração de providers via .env
# ---------------------------------------------------------------------------
PROVIDER_SLIDES = os.getenv("VISUAL_AI_PROVIDER_SLIDES", "gamma").strip().lower()
PROVIDER_DESIGN = os.getenv("VISUAL_AI_PROVIDER_DESIGN", "canva").strip().lower()
PROVIDER_POSTS  = os.getenv("VISUAL_AI_PROVIDER_POSTS", "gemini_imagen").strip().lower()

GAMMA_API_KEY   = os.getenv("GAMMA_API_KEY", "").strip()
CANVA_API_KEY   = os.getenv("CANVA_API_KEY", "").strip()
OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY", "").strip()
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "").strip()
PEXELS_API_KEY  = os.getenv("PEXELS_API_KEY", "").strip()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    logger.info("[visual_ai] Arquivo salvo: %s", path)


def _save_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.strip() + "\n", encoding="utf-8")
    logger.info("[visual_ai] Arquivo salvo: %s", path)


# ---------------------------------------------------------------------------
# SLIDES → Gamma API (gratuito: 400 créditos/mês)
# Documentação: https://gamma.app/developers
# ---------------------------------------------------------------------------

def send_to_gamma(slides_text: str, title: str, out_dir: Path) -> Optional[Path]:
    """
    Envia o texto de slides para a Gamma API e salva o link gerado.
    Plano gratuito: 400 créditos/mês em https://gamma.app.
    Retorna o caminho do arquivo .txt com o link da apresentação.
    """
    if PROVIDER_SLIDES == "skip":
        logger.info("[visual_ai] PROVIDER_SLIDES=skip, slides visuais ignorados.")
        return None

    if not GAMMA_API_KEY:
        logger.warning(
            "[visual_ai] GAMMA_API_KEY não definido. "
            "Obtenha gratuitamente em https://gamma.app → Settings → API. "
            "Slides visuais não serão gerados."
        )
        return None

    url = "https://api.gamma.app/generate"
    payload = {
        "title": title,
        "text": slides_text,
        "mode": "presentation",
        "language": "pt",
    }
    headers = {
        "Authorization": f"Bearer {GAMMA_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        logger.info("[visual_ai] Enviando slides para Gamma API...")
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        data = response.json()

        presentation_url = data.get("url") or data.get("presentationUrl") or str(data)
        output_path = out_dir / "slides_gamma_link.txt"
        _save_text(output_path, f"Apresentação gerada no Gamma:\n{presentation_url}\n")
        logger.info("[visual_ai] Gamma: apresentação criada em %s", presentation_url)
        return output_path

    except requests.HTTPError as e:
        logger.error("[visual_ai] Gamma HTTPError: %s — %s", e, e.response.text if e.response else "")
    except Exception as e:
        logger.error("[visual_ai] Gamma erro inesperado: %s", e)

    return None


# ---------------------------------------------------------------------------
# DESIGN (E-mails, Folhetos, Ficha Técnica) → Canva Connect API
# Plano gratuito disponível em: https://www.canva.com/developers
# ---------------------------------------------------------------------------

def send_to_canva(
    content_text: str,
    asset_type: str,          # "email" | "folheto" | "ficha"
    title: str,
    out_dir: Path,
    template_id: Optional[str] = None,
) -> Optional[Path]:
    """
    Cria um design no Canva via Connect API com o conteúdo do asset.
    Plano gratuito disponível: https://www.canva.com/developers.
    Retorna o caminho do arquivo .txt com o link do design.
    """
    if PROVIDER_DESIGN == "skip":
        logger.info("[visual_ai] PROVIDER_DESIGN=skip, design visual ignorado para '%s'.", asset_type)
        return None

    if not CANVA_API_KEY:
        logger.warning(
            "[visual_ai] CANVA_API_KEY não definido. "
            "Registre-se gratuitamente em https://www.canva.com/developers. "
            "Design visual não será gerado para '%s'.",
            asset_type,
        )
        return None

    # Mapeamento de tipo para nome amigável no Canva
    type_label_map = {
        "email": "Email Marketing",
        "folheto": "Folheto A4",
        "ficha": "Ficha Técnica",
        "post": "Post para Redes Sociais",
    }
    design_title = f"{type_label_map.get(asset_type, asset_type)} — {title}"

    url = "https://api.canva.com/rest/v1/designs"
    payload: dict = {
        "title": design_title,
        "design_type": {"name": "doc"},
    }
    if template_id:
        payload["asset_id"] = template_id

    headers = {
        "Authorization": f"Bearer {CANVA_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        logger.info("[visual_ai] Criando design Canva para '%s'...", asset_type)
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()

        design_url = (
            data.get("design", {}).get("urls", {}).get("edit_url")
            or data.get("url")
            or str(data)
        )
        output_path = out_dir / f"{asset_type}_canva_link.txt"
        _save_text(
            output_path,
            f"Design '{asset_type}' criado no Canva:\n{design_url}\n\n"
            f"--- Conteúdo para preenchimento manual ---\n{content_text}",
        )
        logger.info("[visual_ai] Canva: design '%s' criado em %s", asset_type, design_url)
        return output_path

    except requests.HTTPError as e:
        logger.error("[visual_ai] Canva HTTPError ('%s'): %s — %s", asset_type, e, e.response.text if e.response else "")
    except Exception as e:
        logger.error("[visual_ai] Canva erro inesperado ('%s'): %s", asset_type, e)

    return None


# ---------------------------------------------------------------------------
# POSTS → Gemini Imagen (GRATUITO via Google AI Studio)
# Cota gratuita: https://ai.google.dev/pricing
# ---------------------------------------------------------------------------

def generate_post_image_gemini(
    prompt_text: str,
    asset_key: str,
    out_dir: Path,
) -> Optional[Path]:
    """
    Gera imagem para post usando Gemini Imagen (google-genai).
    GRATUITO via Google AI Studio até a cota mensal.
    Requer GEMINI_API_KEY já definido no .env.
    """
    if not GEMINI_API_KEY:
        logger.warning("[visual_ai] GEMINI_API_KEY não definido. Imagem de post não será gerada.")
        return None

    try:
        from google import genai
        from google.genai import types as gtypes

        client = genai.Client(api_key=GEMINI_API_KEY)
        image_prompt = (
            f"Crie uma imagem profissional e atraente para post de marketing B2B no estilo editorial. "
            f"Tema: {prompt_text[:300]}. "
            f"Estilo: limpo, cores neutras com destaque em azul corporativo, sem texto na imagem."
        )
        logger.info("[visual_ai] Gerando imagem via Gemini Imagen para '%s'...", asset_key)
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=image_prompt,
            config=gtypes.GenerateImagesConfig(number_of_images=1),
        )
        if response.generated_images:
            img_bytes = response.generated_images[0].image.image_bytes
            output_path = out_dir / f"{asset_key}_post_gemini.png"
            _save_bytes(output_path, img_bytes)
            return output_path
        else:
            logger.warning("[visual_ai] Gemini Imagen: nenhuma imagem retornada para '%s'.", asset_key)
    except ImportError:
        logger.error("[visual_ai] google-genai não instalado. Execute: pip install google-genai")
    except Exception as e:
        logger.error("[visual_ai] Gemini Imagen erro ('%s'): %s", asset_key, e)

    return None


# ---------------------------------------------------------------------------
# POSTS → DALL-E 3 via OpenAI API (pago, ~$0.04/imagem)
# ---------------------------------------------------------------------------

def generate_post_image_dalle(
    prompt_text: str,
    asset_key: str,
    out_dir: Path,
) -> Optional[Path]:
    """
    Gera imagem para post usando DALL-E 3 (OpenAI).
    Requer OPENAI_API_KEY no .env. Custo: ~$0.04 por imagem.
    """
    if not OPENAI_API_KEY:
        logger.warning("[visual_ai] OPENAI_API_KEY não definido. Imagem DALL-E não será gerada.")
        return None

    url = "https://api.openai.com/v1/images/generations"
    image_prompt = (
        f"Imagem profissional para post de marketing B2B. "
        f"Tema: {prompt_text[:300]}. "
        f"Estilo editorial, limpo, cores corporativas, sem texto."
    )
    payload = {
        "model": "dall-e-3",
        "prompt": image_prompt,
        "n": 1,
        "size": "1024x1024",
        "response_format": "url",
    }
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        logger.info("[visual_ai] Gerando imagem DALL-E 3 para '%s'...", asset_key)
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        data = response.json()
        image_url = data["data"][0]["url"]

        img_response = requests.get(image_url, timeout=30)
        img_response.raise_for_status()
        output_path = out_dir / f"{asset_key}_post_dalle.png"
        _save_bytes(output_path, img_response.content)
        return output_path

    except requests.HTTPError as e:
        logger.error("[visual_ai] DALL-E HTTPError ('%s'): %s", asset_key, e)
    except Exception as e:
        logger.error("[visual_ai] DALL-E erro ('%s'): %s", asset_key, e)

    return None


# ---------------------------------------------------------------------------
# FALLBACK GRATUITO → Pexels (stock photos 100% gratuitas)
# Registro gratuito: https://www.pexels.com/api
# ---------------------------------------------------------------------------

def fetch_pexels_image(
    query: str,
    asset_key: str,
    out_dir: Path,
) -> Optional[Path]:
    """
    Busca uma imagem relevante no Pexels (API totalmente gratuita).
    Útil como fallback quando as outras APIs não estiverem disponíveis.
    Registro gratuito: https://www.pexels.com/api.
    """
    if not PEXELS_API_KEY:
        logger.warning(
            "[visual_ai] PEXELS_API_KEY não definido. "
            "Registre-se gratuitamente em https://www.pexels.com/api."
        )
        return None

    url = "https://api.pexels.com/v1/search"
    params = {"query": query[:100], "per_page": 1, "orientation": "landscape"}
    headers = {"Authorization": PEXELS_API_KEY}

    try:
        logger.info("[visual_ai] Buscando imagem Pexels para '%s' (query: %s)...", asset_key, query[:50])
        response = requests.get(url, params=params, headers=headers, timeout=20)
        response.raise_for_status()
        data = response.json()

        photos = data.get("photos", [])
        if not photos:
            logger.warning("[visual_ai] Pexels: nenhuma foto encontrada para '%s'.", query)
            return None

        photo_url = photos[0]["src"]["large2x"]
        img_response = requests.get(photo_url, timeout=30)
        img_response.raise_for_status()

        output_path = out_dir / f"{asset_key}_post_pexels.jpg"
        _save_bytes(output_path, img_response.content)
        return output_path

    except requests.HTTPError as e:
        logger.error("[visual_ai] Pexels HTTPError ('%s'): %s", asset_key, e)
    except Exception as e:
        logger.error("[visual_ai] Pexels erro ('%s'): %s", asset_key, e)

    return None


# ---------------------------------------------------------------------------
# Interface pública principal
# ---------------------------------------------------------------------------

def generate_post_image(
    content_text: str,
    asset_key: str,
    out_dir: Path,
) -> Optional[Path]:
    """
    Gera imagem para post usando o provider configurado em VISUAL_AI_PROVIDER_POSTS.
    Ordem de prioridade: gemini_imagen → dalle → pexels → skip.
    """
    if PROVIDER_POSTS == "skip":
        return None

    # Extrai palavras-chave do conteúdo para usar como prompt/query
    keyword_summary = content_text[:200].replace("\n", " ").strip()

    if PROVIDER_POSTS == "gemini_imagen":
        result = generate_post_image_gemini(keyword_summary, asset_key, out_dir)
        if result:
            return result
        logger.info("[visual_ai] Gemini Imagen falhou, tentando Pexels como fallback...")
        return fetch_pexels_image(keyword_summary, asset_key, out_dir)

    if PROVIDER_POSTS == "dalle":
        result = generate_post_image_dalle(keyword_summary, asset_key, out_dir)
        if result:
            return result
        logger.info("[visual_ai] DALL-E falhou, tentando Pexels como fallback...")
        return fetch_pexels_image(keyword_summary, asset_key, out_dir)

    if PROVIDER_POSTS == "pexels":
        return fetch_pexels_image(keyword_summary, asset_key, out_dir)

    logger.warning("[visual_ai] PROVIDER_POSTS='%s' desconhecido. Use: gemini_imagen, dalle, pexels ou skip.", PROVIDER_POSTS)
    return None


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
    Retorna um dicionário com os resultados de cada etapa.
    """
    campaign_name = brief.get("campanha", brief.get("titulo", "Campanha"))
    results: dict = {}

    # 1. Slides → Gamma
    if slides_text:
        logger.info("[visual_ai] Iniciando geração visual de slides (Gamma)...")
        results["slides_gamma"] = send_to_gamma(slides_text, campaign_name, out_dir)
        time.sleep(1)

    # 2. E-mails → Canva
    if emails_text:
        logger.info("[visual_ai] Iniciando geração visual de e-mails (Canva)...")
        results["emails_canva"] = send_to_canva(emails_text, "email", campaign_name, out_dir)
        time.sleep(1)

    # 3. Folheto → Canva
    if folheto_text:
        logger.info("[visual_ai] Iniciando geração visual de folheto (Canva)...")
        results["folheto_canva"] = send_to_canva(folheto_text, "folheto", campaign_name, out_dir)
        time.sleep(1)

    # 4. Ficha Técnica → Canva
    if ficha_text:
        logger.info("[visual_ai] Iniciando geração visual de ficha técnica (Canva)...")
        results["ficha_canva"] = send_to_canva(ficha_text, "ficha", campaign_name, out_dir)
        time.sleep(1)

    # 5. Posts → Gemini Imagen / DALL-E / Pexels
    if post_text:
        logger.info("[visual_ai] Iniciando geração visual de post (provider: %s)...", PROVIDER_POSTS)
        results["post_image"] = generate_post_image(post_text, "post_instagram", out_dir)

    # Converte Path para str para serialização no manifest
    return {k: str(v) if v else None for k, v in results.items()}
