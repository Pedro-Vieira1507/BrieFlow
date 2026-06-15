"""
BriefFlow Image Generator
--------------------------
Gera imagens via Stable Diffusion local (AUTOMATIC1111) para usar
em banners e cards.

Pré-requisito: AUTOMATIC1111 rodando em http://localhost:7860
Guia de instalação: docs/stable_diffusion_setup.md

Fluxo:
  1. LLM gera o HTML do banner COM placeholder {{SD_IMAGE}}
  2. image_gen.py chama SD e recebe base64
  3. renderer.py substitui {{SD_IMAGE}} pela data URI antes de capturar PNG
"""

import base64
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SD_URL     = os.getenv("SD_BASE_URL", "http://127.0.0.1:7860")
SD_TIMEOUT = int(os.getenv("SD_TIMEOUT", "120"))
SD_ENABLED = os.getenv("SD_ENABLED", "true").lower() == "true"

# Configurações padrão de geração
DEFAULT_PARAMS = {
    "steps": 25,
    "cfg_scale": 7,
    "sampler_index": "DPM++ 2M Karras",
    "restore_faces": False,
    "tiling": False,
}

# Dimensões por tipo de material
IMAGE_SIZES = {
    "banner":    {"width": 512, "height": 512},   # produto no lado direito
    "card":      {"width": 512, "height": 512},
    "instagram": {"width": 512, "height": 512},
    "stories":   {"width": 384, "height": 512},
    "default":   {"width": 512, "height": 512},
}

# Sufixos de qualidade adicionados automaticamente ao prompt
QUALITY_SUFFIX = (
    ", product photography, studio lighting, white background, "
    "high detail, sharp focus, 4k, professional"
)

# Negative prompt padrão
NEGATIVE_DEFAULT = (
    "blurry, low quality, watermark, text, logo, humans, "
    "hands, distorted, ugly, duplicate, deformed"
)


def sd_disponivel() -> bool:
    """Verifica se o AUTOMATIC1111 está rodando e acessível."""
    if not SD_ENABLED:
        return False
    try:
        r = httpx.get(f"{SD_URL}/sdapi/v1/options", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def gerar_imagem_produto(
    prompt: str,
    material_key: str = "banner",
    negative_prompt: Optional[str] = None,
    seed: int = -1,
) -> Optional[str]:
    """
    Gera uma imagem do produto via Stable Diffusion e retorna base64.

    Args:
        prompt        : Descrição do produto em inglês (SD funciona melhor em inglês).
        material_key  : Tipo de material (define dimensões).
        negative_prompt: O que evitar na imagem.
        seed          : Semente para reprodução (-1 = aleatório).

    Returns:
        String base64 da imagem gerada, ou None se falhar.
    """
    if not SD_ENABLED:
        logger.info("SD desabilitado via SD_ENABLED=false")
        return None

    if not sd_disponivel():
        logger.warning(
            "AUTOMATIC1111 não encontrado em %s. "
            "Inicie com: python launch.py --api --listen",
            SD_URL
        )
        return None

    size    = IMAGE_SIZES.get(material_key, IMAGE_SIZES["default"])
    payload = {
        "prompt":          prompt + QUALITY_SUFFIX,
        "negative_prompt": negative_prompt or NEGATIVE_DEFAULT,
        "width":           size["width"],
        "height":          size["height"],
        "seed":            seed,
        **DEFAULT_PARAMS,
    }

    logger.info("Gerando imagem SD: %s (%dx%d)...", prompt[:60], size["width"], size["height"])

    try:
        r = httpx.post(
            f"{SD_URL}/sdapi/v1/txt2img",
            json=payload,
            timeout=SD_TIMEOUT,
        )
        r.raise_for_status()
        data = r.json()
        img_b64 = data["images"][0]
        logger.info("Imagem SD gerada com sucesso.")
        return img_b64

    except httpx.TimeoutException:
        logger.error("SD timeout após %ds. Aumente SD_TIMEOUT no .env.", SD_TIMEOUT)
    except Exception as e:
        logger.error("Erro ao gerar imagem SD: %s", e)

    return None


def injetar_imagem_no_html(html: str, img_b64: str, mime: str = "image/png") -> str:
    """
    Substitui o placeholder {{SD_IMAGE}} no HTML pela data URI da imagem gerada.

    Se o HTML não tiver o placeholder, injeta a imagem no primeiro elemento
    com class='hero-image' ou cria um bloco no topo.
    """
    data_uri = f"data:{mime};base64,{img_b64}"
    img_tag  = f'<img src="{data_uri}" alt="Imagem do produto" style="max-width:100%; height:auto; object-fit:contain; border-radius:8px;">'

    if "{{SD_IMAGE}}" in html:
        return html.replace("{{SD_IMAGE}}", img_tag)

    # Fallback: injeta dentro do primeiro .hero-image
    if 'class="hero-image"' in html:
        return html.replace(
            'class="hero-image"',
            f'class="hero-image">{img_tag}<!-- injected',
            1
        )

    return html


def construir_prompt_produto(contexto: str, nome_produto: str = "") -> str:
    """
    Constrói um prompt SD em inglês a partir do contexto do produto.
    O LLM não precisa gerar o prompt; esta função faz isso automaticamente.
    """
    # Extrai palavras-chave do contexto
    palavras_chave = []
    contexto_lower = contexto.lower()

    categorias = {
        "pipette": ["pipeta", "pipetagem", "pip"],
        "centrifuge": ["centrifuga", "microcentr"],
        "microscope": ["microscópio", "microscopio"],
        "lab glassware": ["vidraria", "becker", "erlenmeyer", "tubo"],
        "laboratory equipment": ["equipamento", "laboratório", "lab"],
        "medical device": ["médico", "clínico", "diagnóstico"],
        "scientific instrument": [],  # fallback
    }

    produto_en = "scientific instrument"
    for en_term, pt_terms in categorias.items():
        if any(t in contexto_lower for t in pt_terms) or (
            nome_produto and any(t in nome_produto.lower() for t in pt_terms)
        ):
            produto_en = en_term
            break

    if nome_produto:
        return f"{nome_produto}, {produto_en}"

    return produto_en
