from __future__ import annotations

import io
import logging
import os
import re
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

import requests
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import PP_PLACEHOLDER
from pptx.enum.text import PP_ALIGN, MSO_VERTICAL_ANCHOR
from pptx.util import Pt
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
# Template pode ser fornecido:
#   1. Via variável de ambiente SLIDES_TEMPLATE_DRIVE_FILE_ID  → baixa do Google Drive em runtime
#   2. Via variável SLIDES_TEMPLATE_PATH (caminho local)       → usa arquivo local
#   3. Fallback para o caminho padrão local abaixo
DEFAULT_TEMPLATE_LOCAL = Path("data/template_slides.pptx")
DEFAULT_OUTPUT_SUFFIX  = ".pptx"

# O ID do arquivo de template no Google Drive.
# Configure em .env: SLIDES_TEMPLATE_DRIVE_FILE_ID=17e2hu5n3pZMNqy9J3BMO3-BylpSIAsJk
TEMPLATE_DRIVE_FILE_ID = os.getenv("SLIDES_TEMPLATE_DRIVE_FILE_ID", "").strip()
TEMPLATE_LOCAL_PATH    = os.getenv("SLIDES_TEMPLATE_PATH", "").strip()

TITLE_FONT_SIZE = Pt(24)
BODY_FONT_SIZE  = Pt(16)
SMALL_FONT_SIZE = Pt(11)

COLOR_TEXT   = RGBColor(33, 37, 41)
COLOR_MUTED  = RGBColor(99, 110, 123)
COLOR_ACCENT = RGBColor(0, 91, 150)


# ---------------------------------------------------------------------------
# Template loader — Drive > local env path > default local
# ---------------------------------------------------------------------------

def _download_template_from_drive(file_id: str) -> BytesIO:
    """
    Baixa o arquivo PPTX do Google Drive usando a API REST com a credencial
    OAuth já autenticada pelo DriveMonitor (token.json).
    """
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload

    token_path = "credentials/token.json"
    creds_path = "credentials/credentials.json"
    scopes = ["https://www.googleapis.com/auth/drive.readonly"]

    creds = None
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, scopes)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            from google_auth_oauthlib.flow import InstalledAppFlow
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, scopes)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w", encoding="utf-8") as f:
            f.write(creds.to_json())

    service = build("drive", "v3", credentials=creds)
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)

    buffer = BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
        if status:
            logger.info(f"[Template] Download {int(status.progress() * 100)}%%")

    buffer.seek(0)
    logger.info(f"[OK] Template baixado do Drive (id={file_id})")
    return buffer


def load_presentation(template_path: Optional[Path] = None) -> Presentation:
    """
    Carrega o Presentation, em ordem de prioridade:
      1. template_path passado explicitamente
      2. SLIDES_TEMPLATE_DRIVE_FILE_ID  → baixa do Drive
      3. SLIDES_TEMPLATE_PATH           → arquivo local da env
      4. DEFAULT_TEMPLATE_LOCAL
    """
    if template_path:
        tpl = Path(template_path)
        if not tpl.exists():
            raise FileNotFoundError(f"Template PPTX não encontrado: {tpl}")
        logger.info(f"[Template] Usando arquivo local explícito: {tpl}")
        return Presentation(str(tpl))

    if TEMPLATE_DRIVE_FILE_ID:
        logger.info(f"[Template] Baixando do Google Drive id={TEMPLATE_DRIVE_FILE_ID}")
        buffer = _download_template_from_drive(TEMPLATE_DRIVE_FILE_ID)
        # Salva cache local para evitar novo download na mesma sessão
        DEFAULT_TEMPLATE_LOCAL.parent.mkdir(parents=True, exist_ok=True)
        DEFAULT_TEMPLATE_LOCAL.write_bytes(buffer.read())
        buffer.seek(0)
        return Presentation(buffer)

    if TEMPLATE_LOCAL_PATH:
        tpl = Path(TEMPLATE_LOCAL_PATH)
        if not tpl.exists():
            raise FileNotFoundError(f"Template PPTX (SLIDES_TEMPLATE_PATH) não encontrado: {tpl}")
        logger.info(f"[Template] Usando SLIDES_TEMPLATE_PATH: {tpl}")
        return Presentation(str(tpl))

    if DEFAULT_TEMPLATE_LOCAL.exists():
        logger.info(f"[Template] Usando template local padrão: {DEFAULT_TEMPLATE_LOCAL}")
        return Presentation(str(DEFAULT_TEMPLATE_LOCAL))

    raise FileNotFoundError(
        "Template PPTX não encontrado. Defina SLIDES_TEMPLATE_DRIVE_FILE_ID ou "
        "SLIDES_TEMPLATE_PATH no .env, ou coloque o arquivo em data/template_slides.pptx"
    )


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def normalize_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def get_output_pptx_path(slides_txt_path: Path) -> Path:
    return slides_txt_path.with_suffix(DEFAULT_OUTPUT_SUFFIX)


# ---------------------------------------------------------------------------
# Slide content parser
# ---------------------------------------------------------------------------

def parse_slides_txt(slides_txt_path: Path) -> list[dict[str, Any]]:
    raw = normalize_text(slides_txt_path.read_text(encoding="utf-8"))

    pattern = re.compile(
        r"Slide\s+(\d+)\s*-\s*([^\n:]+):\s*(.*?)(?=\nSlide\s+\d+\s*-\s*[^\n:]+:|\Z)",
        re.IGNORECASE | re.DOTALL,
    )

    slides_data: list[dict[str, Any]] = []

    for match in pattern.finditer(raw):
        number = int(match.group(1))
        label  = normalize_text(match.group(2))
        body   = match.group(3).strip()

        lines   = [normalize_text(line) for line in body.splitlines() if normalize_text(line)]
        bullets = []
        for line in lines:
            if line.startswith(("- ", "• ")):
                bullets.append(line[2:].strip())
            else:
                bullets.append(line)

        title = label if label.lower() != "título" else (bullets[0] if bullets else f"Slide {number}")

        slides_data.append(
            {
                "number":  number,
                "label":   label,
                "title":   title,
                "bullets": bullets[:5],
            }
        )

    if not slides_data:
        raise ValueError("Não foi possível interpretar o arquivo de slides.")

    if slides_data[0]["label"].lower() == "título" and slides_data[0]["bullets"]:
        slides_data[0]["title"]    = slides_data[0]["bullets"][0]
        slides_data[0]["subtitle"] = slides_data[0]["bullets"][1] if len(slides_data[0]["bullets"]) > 1 else "Capacitação técnica"
    else:
        slides_data[0]["subtitle"] = "Capacitação técnica"

    for slide in slides_data[1:]:
        slide["subtitle"] = ""

    return slides_data


# ---------------------------------------------------------------------------
# Placeholder helpers
# ---------------------------------------------------------------------------

def debug_slide_placeholders(slide) -> list[dict[str, Any]]:
    items = []
    for shape in slide.shapes:
        if not shape.is_placeholder:
            continue
        ph = shape.placeholder_format
        items.append({
            "idx":  ph.idx,
            "type": str(ph.type),
            "name": shape.name,
            "text": getattr(shape, "text", ""),
        })
    return items


def get_title_placeholder(slide):
    return slide.shapes.title


def find_body_placeholder(slide):
    for shape in slide.placeholders:
        if shape.placeholder_format.type in (PP_PLACEHOLDER.BODY, PP_PLACEHOLDER.OBJECT):
            if getattr(shape, "has_text_frame", False):
                return shape
    return None


def find_picture_placeholder(slide):
    for shape in slide.placeholders:
        if shape.placeholder_format.type == PP_PLACEHOLDER.PICTURE:
            return shape
    return None


# ---------------------------------------------------------------------------
# Text / bullet writers
# ---------------------------------------------------------------------------

def set_text(shape, text: str, font_size=None, bold=None, color=None, align=PP_ALIGN.LEFT):
    if not shape or not shape.has_text_frame:
        return
    tf = shape.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = MSO_VERTICAL_ANCHOR.TOP
    p   = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text.strip()
    if font_size or bold is not None or color is not None:
        font = run.font
        if font_size:    font.size      = font_size
        if bold is not None: font.bold  = bold
        if color is not None: font.color.rgb = color


def set_bullets(shape, bullets: list[str]):
    if not shape or not shape.has_text_frame:
        return
    tf = shape.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = MSO_VERTICAL_ANCHOR.TOP
    for i, bullet in enumerate(bullets[:5]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text      = bullet
        p.level     = 0
        p.alignment = PP_ALIGN.LEFT


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def load_image_bytes(
    image_path: Optional[Path] = None,
    image_url:  Optional[str]  = None,
) -> Optional[BytesIO]:
    try:
        if image_path and image_path.exists():
            img = Image.open(image_path)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            buffer.seek(0)
            return buffer
        if image_url:
            headers  = {"User-Agent": "Mozilla/5.0"}
            response = requests.get(image_url, timeout=20, headers=headers)
            response.raise_for_status()
            img = Image.open(BytesIO(response.content))
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            buffer.seek(0)
            return buffer
    except Exception as e:
        logger.warning(f"[WARN] Falha ao carregar imagem: {e}")
    return None


def insert_picture_into_placeholder(
    slide,
    image_path: Optional[Path] = None,
    image_url:  Optional[str]  = None,
):
    picture_ph = find_picture_placeholder(slide)
    if not picture_ph:
        return
    img_stream = load_image_bytes(image_path=image_path, image_url=image_url)
    if not img_stream:
        return
    picture_ph.insert_picture(img_stream)


# ---------------------------------------------------------------------------
# Slide populators
# ---------------------------------------------------------------------------

def populate_title_slide(slide, slide_data: dict[str, Any]):
    title_ph = get_title_placeholder(slide)
    body_ph  = find_body_placeholder(slide)
    set_text(title_ph, slide_data.get("title", "Capacitação técnica"))
    if body_ph:
        set_text(body_ph, slide_data.get("subtitle", "Treinamento de usuários"), color=COLOR_MUTED)


def populate_content_slide(slide, slide_data: dict[str, Any], image_path: Optional[Path] = None):
    title_ph = get_title_placeholder(slide)
    body_ph  = find_body_placeholder(slide)
    set_text(title_ph, slide_data.get("title", f"Slide {slide_data.get('number', '')}"), color=COLOR_ACCENT)
    if body_ph:
        set_bullets(body_ph, slide_data.get("bullets", []))
    insert_picture_into_placeholder(slide, image_path=image_path)


def build_image_map(
    slides_data: list[dict[str, Any]],
    images_dir:  Optional[Path] = None,
) -> dict[int, Optional[Path]]:
    image_map: dict[int, Optional[Path]] = {}
    if not images_dir or not images_dir.exists():
        for item in slides_data:
            image_map[item["number"]] = None
        return image_map
    candidates = list(images_dir.glob("*"))
    for item in slides_data:
        number = item["number"]
        found  = None
        for file in candidates:
            name = file.stem.lower()
            if name.startswith(f"{number}_") or name == str(number):
                found = file
                break
        image_map[number] = found
    return image_map


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------

def slides_txt_to_ppt(
    slides_txt_path: Path | str,
    template_path:   Path | str | None = None,
    images_dir:      Path | str | None = None,
) -> Path:
    """
    Converte o arquivo de texto de slides em um PPTX usando o template
    definido por (em ordem de prioridade):
      1. template_path (argumento explícito)
      2. SLIDES_TEMPLATE_DRIVE_FILE_ID no .env  → baixa do Google Drive
      3. SLIDES_TEMPLATE_PATH no .env            → arquivo local
      4. data/template_slides.pptx               → fallback local
    """
    slides_txt_path = Path(slides_txt_path)
    template_path   = Path(template_path) if template_path else None
    images_dir      = Path(images_dir)    if images_dir    else None

    slides_data = parse_slides_txt(slides_txt_path)
    prs         = load_presentation(template_path)
    image_map   = build_image_map(slides_data, images_dir=images_dir)

    if len(prs.slides) < len(slides_data):
        raise ValueError(
            f"O template tem {len(prs.slides)} slides, mas o conteúdo pede "
            f"{len(slides_data)}. Adicione slides-modelo ao template."
        )

    for i, slide_data in enumerate(slides_data):
        slide = prs.slides[i]
        if i == 0:
            populate_title_slide(slide, slide_data)
        else:
            populate_content_slide(slide, slide_data, image_path=image_map.get(slide_data["number"]))

    output_path = get_output_pptx_path(slides_txt_path)
    prs.save(str(output_path))
    logger.info(f"[OK] Slides PPTX gerados em: {output_path}")
    return output_path
