# slides_ppt.py
import io
import os
import logging
import re
from pptx import Presentation
from pptx.util import Pt
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SLIDES_TEMPLATE_URL = os.getenv(
    "SLIDES_TEMPLATE_URL",
    "https://docs.google.com/presentation/d/17e2hu5n3pZMNqy9J3BMO3-BylpSIAsJk/edit",
)
SLIDES_TEMPLATE_LOCAL = os.getenv(
    "SLIDES_TEMPLATE_PATH", "data/template_slides.pptx"
)


def _extract_file_id(url: str) -> str:
    """Extrai o ID do arquivo a partir de uma URL do Google Drive/Slides."""
    match = re.search(r"/d/([a-zA-Z0-9_-]{25,})", url)
    if match:
        return match.group(1)
    raise ValueError(
        f"Não foi possível extrair o ID do arquivo da URL: {url}"
    )


def download_template_from_drive(
    service, output_path: str = SLIDES_TEMPLATE_LOCAL
) -> str:
    """
    Baixa o template de slides do Google Drive via API.
    Exporta Google Slides → .pptx automaticamente.

    Args:
        service: Serviço autenticado do Google Drive API.
        output_path: Caminho local onde o template será salvo.

    Returns:
        Caminho local do template .pptx baixado.
    """
    if os.path.exists(output_path):
        logger.info(
            f"[SlidesTemplate] Template já existe localmente: {output_path}"
        )
        return output_path

    from googleapiclient.http import MediaIoBaseDownload

    PPTX_MIME = (
        "application/vnd.openxmlformats-officedocument"
        ".presentationml.presentation"
    )

    try:
        file_id = _extract_file_id(SLIDES_TEMPLATE_URL)
        logger.info(
            f"[SlidesTemplate] Baixando template do Drive (ID: {file_id})..."
        )

        request = service.files().export_media(
            fileId=file_id, mimeType=PPTX_MIME
        )
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            logger.info(
                f"[SlidesTemplate] Progresso: {int(status.progress() * 100)}%"
            )

        dest_dir = os.path.dirname(output_path)
        if dest_dir:
            os.makedirs(dest_dir, exist_ok=True)

        with open(output_path, "wb") as f:
            f.write(buffer.getvalue())

        logger.info(f"[SlidesTemplate] ✅ Template salvo: {output_path}")
        return output_path

    except Exception as e:
        logger.error(f"[SlidesTemplate] Erro ao baixar template: {e}")
        raise


def parse_slides_content(raw_text: str) -> list[dict]:
    """
    Converte o texto gerado pelo LLM em uma lista de dicts para o PPTX.
    Espera marcadores no formato:
        SLIDE 1 | Título do Slide
        - Bullet 1
        - Bullet 2

    Args:
        raw_text: Texto bruto retornado pelo LLM.

    Returns:
        Lista de dicts com keys 'title' e 'body' (list[str]).
    """
    slides = []
    current_title = None
    current_bullets: list[str] = []

    slide_marker = re.compile(
        r"^(?:SLIDE\s*\d+\s*[|:\-]?\s*)(.+)$", re.IGNORECASE
    )

    def flush():
        if current_title:
            slides.append({
                "title": current_title.strip(),
                "body": current_bullets[:],
            })

    for line in raw_text.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue

        match = slide_marker.match(stripped)
        if match:
            flush()
            current_title = match.group(1).strip()
            current_bullets = []
        elif stripped.startswith(("- ", "* ", "• ")):
            current_bullets.append(stripped[2:].strip())
        elif current_title:
            current_bullets.append(stripped)

    flush()

    if not slides:
        # Fallback: divide por linhas duplas se não encontrar marcadores
        blocks = [b.strip() for b in raw_text.split("\n\n") if b.strip()]
        for i, block in enumerate(blocks):
            lines = [ln.strip() for ln in block.split("\n") if ln.strip()]
            title = lines[0] if lines else f"Slide {i + 1}"
            body = lines[1:] if len(lines) > 1 else []
            slides.append({"title": title, "body": body})

    logger.info(f"[SlidesPPT] {len(slides)} slide(s) parseado(s)")
    return slides


def build_presentation_from_template(
    slides_content: list[dict],
    output_path: str,
    template_path: str = SLIDES_TEMPLATE_LOCAL,
) -> str:
    """
    Gera um .pptx preenchendo o template com o conteúdo dos slides.

    Args:
        slides_content: Lista de dicts com 'title' e 'body' (list[str] ou str).
        output_path: Caminho de saída do .pptx gerado.
        template_path: Caminho local do template .pptx.

    Returns:
        Caminho do .pptx gerado.

    Raises:
        FileNotFoundError: Se o template não for encontrado.
    """
    if not os.path.exists(template_path):
        raise FileNotFoundError(
            f"Template não encontrado: {template_path}. "
            "Execute download_template_from_drive(service) primeiro."
        )

    try:
        prs = Presentation(template_path)

        # Usa o layout 1 (Title and Content) como padrão
        # Se o template tiver layouts customizados, ajuste o índice
        available_layouts = prs.slide_layouts
        content_layout = available_layouts[1] if len(available_layouts) > 1 else available_layouts[0]

        # Remove slides de exemplo do template, mantendo apenas o de capa (índice 0)
        slide_id_list = prs.slides._sldIdLst
        while len(slide_id_list) > 1:
            last_rId = slide_id_list[-1].get("r:id")
            prs.part.drop_rel(last_rId)
            del slide_id_list[-1]

        for idx, slide_data in enumerate(slides_content):
            title_text = slide_data.get("title", f"Slide {idx + 1}")
            body_content = slide_data.get("body", "")

            slide = prs.slides.add_slide(content_layout)

            # Preenche o placeholder de título
            if slide.shapes.title:
                slide.shapes.title.text = title_text
                if slide.shapes.title.text_frame.paragraphs:
                    run = slide.shapes.title.text_frame.paragraphs[0].runs
                    if run:
                        run[0].font.size = Pt(28)

            # Preenche o placeholder de corpo
            body_placeholder = (
                slide.placeholders[1]
                if len(slide.placeholders) > 1
                else None
            )
            if body_placeholder:
                tf = body_placeholder.text_frame
                tf.clear()
                tf.word_wrap = True

                lines = (
                    body_content
                    if isinstance(body_content, list)
                    else body_content.split("\n")
                )
                lines = [ln.strip() for ln in lines if ln.strip()]

                for i, line in enumerate(lines):
                    if i == 0:
                        tf.text = line
                        if tf.paragraphs[0].runs:
                            tf.paragraphs[0].runs[0].font.size = Pt(16)
                    else:
                        p = tf.add_paragraph()
                        p.text = line
                        if p.runs:
                            p.runs[0].font.size = Pt(16)

        dest_dir = os.path.dirname(output_path)
        if dest_dir:
            os.makedirs(dest_dir, exist_ok=True)

        prs.save(output_path)
        logger.info(f"[SlidesPPT] ✅ Apresentação salva: {output_path}")
        return output_path

    except Exception as e:
        logger.error(f"[SlidesPPT] Erro ao gerar apresentação: {e}")
        raise
