from __future__ import annotations

from pathlib import Path
import re
from io import BytesIO
from typing import Any, Optional

import requests
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import PP_PLACEHOLDER
from pptx.enum.text import PP_ALIGN, MSO_VERTICAL_ANCHOR
from pptx.util import Pt


DEFAULT_TEMPLATE_PATH = Path(r"data/tempalate slides/APRESENTAÇÃO - MODELO [todos copiar].pptx")
DEFAULT_OUTPUT_SUFFIX = ".pptx"

TITLE_FONT_SIZE = Pt(24)
BODY_FONT_SIZE = Pt(16)
SMALL_FONT_SIZE = Pt(11)

COLOR_TEXT = RGBColor(33, 37, 41)
COLOR_MUTED = RGBColor(99, 110, 123)
COLOR_ACCENT = RGBColor(0, 91, 150)


def log(message: str) -> None:
    print(message)


def normalize_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def get_output_pptx_path(slides_txt_path: Path) -> Path:
    return slides_txt_path.with_suffix(DEFAULT_OUTPUT_SUFFIX)


def load_presentation(template_path: Optional[Path] = None) -> Presentation:
    tpl = template_path or DEFAULT_TEMPLATE_PATH
    if not tpl.exists():
        raise FileNotFoundError(f"Template PPTX não encontrado: {tpl}")
    return Presentation(str(tpl))


def parse_slides_txt(slides_txt_path: Path) -> list[dict[str, Any]]:
    raw = normalize_text(slides_txt_path.read_text(encoding="utf-8"))

    pattern = re.compile(
        r"Slide\s+(\d+)\s*-\s*([^\n:]+):\s*(.*?)(?=\nSlide\s+\d+\s*-\s*[^\n:]+:|\Z)",
        re.IGNORECASE | re.DOTALL,
    )

    slides_data: list[dict[str, Any]] = []

    for match in pattern.finditer(raw):
        number = int(match.group(1))
        label = normalize_text(match.group(2))
        body = match.group(3).strip()

        lines = [normalize_text(line) for line in body.splitlines() if normalize_text(line)]
        bullets = []
        for line in lines:
            if line.startswith("- "):
                bullets.append(line[2:].strip())
            elif line.startswith("• "):
                bullets.append(line[2:].strip())
            else:
                bullets.append(line)

        title = label if label.lower() != "título" else (bullets[0] if bullets else f"Slide {number}")

        slides_data.append(
            {
                "number": number,
                "label": label,
                "title": title,
                "bullets": bullets[:5],
            }
        )

    if not slides_data:
        raise ValueError("Não foi possível interpretar o arquivo de slides.")

    if slides_data[0]["label"].lower() == "título" and slides_data[0]["bullets"]:
        slides_data[0]["title"] = slides_data[0]["bullets"][0]
        slides_data[0]["subtitle"] = slides_data[0]["bullets"][1] if len(slides_data[0]["bullets"]) > 1 else "Capacitação técnica"
    else:
        slides_data[0]["subtitle"] = "Capacitação técnica"

    for slide in slides_data[1:]:
        slide["subtitle"] = ""

    return slides_data


def debug_slide_placeholders(slide) -> list[dict[str, Any]]:
    items = []
    for shape in slide.shapes:
        if not shape.is_placeholder:
            continue
        ph = shape.placeholder_format
        items.append({
            "idx": ph.idx,
            "type": str(ph.type),
            "name": shape.name,
            "text": getattr(shape, "text", ""),
        })
    return items


def get_placeholder_by_idx(slide, idx: int):
    try:
        return slide.placeholders[idx]
    except KeyError:
        return None


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


def set_text(shape, text: str, font_size=None, bold=None, color=None, align=PP_ALIGN.LEFT):
    if not shape or not shape.has_text_frame:
        return

    tf = shape.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = MSO_VERTICAL_ANCHOR.TOP

    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text.strip()

    if font_size or bold is not None or color is not None:
        font = run.font
        if font_size:
            font.size = font_size
        if bold is not None:
            font.bold = bold
        if color is not None:
            font.color.rgb = color


def set_bullets(shape, bullets: list[str]):
    if not shape or not shape.has_text_frame:
        return

    tf = shape.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = MSO_VERTICAL_ANCHOR.TOP

    for i, bullet in enumerate(bullets[:5]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = bullet
        p.level = 0
        p.alignment = PP_ALIGN.LEFT


def load_image_bytes(image_path: Optional[Path] = None, image_url: Optional[str] = None) -> Optional[BytesIO]:
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
            headers = {"User-Agent": "Mozilla/5.0"}
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
        log(f"[WARN] Falha ao carregar imagem: {e}")

    return None


def insert_picture_into_placeholder(slide, image_path: Optional[Path] = None, image_url: Optional[str] = None):
    picture_ph = find_picture_placeholder(slide)
    if not picture_ph:
        return

    img_stream = load_image_bytes(image_path=image_path, image_url=image_url)
    if not img_stream:
        return

    picture_ph.insert_picture(img_stream)


def populate_title_slide(slide, slide_data: dict[str, Any]):
    title_ph = get_title_placeholder(slide)
    body_ph = find_body_placeholder(slide)

    set_text(title_ph, slide_data.get("title", "Capacitação técnica"))
    if body_ph:
        set_text(body_ph, slide_data.get("subtitle", "Treinamento de usuários"), color=COLOR_MUTED)


def populate_content_slide(slide, slide_data: dict[str, Any], image_path: Optional[Path] = None):
    title_ph = get_title_placeholder(slide)
    body_ph = find_body_placeholder(slide)

    set_text(title_ph, slide_data.get("title", f"Slide {slide_data.get('number', '')}"), color=COLOR_ACCENT)
    if body_ph:
        set_bullets(body_ph, slide_data.get("bullets", []))

    insert_picture_into_placeholder(slide, image_path=image_path)


def build_image_map(slides_data: list[dict[str, Any]], images_dir: Optional[Path] = None) -> dict[int, Optional[Path]]:
    image_map: dict[int, Optional[Path]] = {}

    if not images_dir or not images_dir.exists():
        for item in slides_data:
            image_map[item["number"]] = None
        return image_map

    candidates = list(images_dir.glob("*"))
    for item in slides_data:
        number = item["number"]
        found = None
        for file in candidates:
            name = file.stem.lower()
            if name.startswith(f"{number}_") or name == str(number):
                found = file
                break
        image_map[number] = found

    return image_map


def slides_txt_to_ppt(
    slides_txt_path: Path | str,
    template_path: Path | str | None = None,
    images_dir: Path | str | None = None,
) -> Path:
    slides_txt_path = Path(slides_txt_path)
    template_path = Path(template_path) if template_path else DEFAULT_TEMPLATE_PATH
    images_dir = Path(images_dir) if images_dir else None

    slides_data = parse_slides_txt(slides_txt_path)
    prs = load_presentation(template_path)
    image_map = build_image_map(slides_data, images_dir=images_dir)

    if len(prs.slides) < len(slides_data):
        raise ValueError(
            f"O template tem {len(prs.slides)} slides, mas o conteúdo pede {len(slides_data)}. "
            "Crie slides-modelo suficientes no template."
        )

    for i, slide_data in enumerate(slides_data):
        slide = prs.slides[i]

        if i == 0:
            populate_title_slide(slide, slide_data)
        else:
            populate_content_slide(
                slide,
                slide_data,
                image_path=image_map.get(slide_data["number"]),
            )

    output_path = get_output_pptx_path(slides_txt_path)
    prs.save(str(output_path))
    log(f"[OK] Slides PPTX gerados em: {output_path}")
    return output_path