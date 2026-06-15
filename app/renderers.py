# app/renderers.py
# Módulo de renderizadores: converte o texto gerado pelo LLM no formato final correto.
# Cada função recebe (content: str, output_path: Path) e salva o arquivo.

from pathlib import Path
import textwrap


# ── TXT ────────────────────────────────────────────────────────────────────────
def render_txt(content: str, output_path: Path) -> None:
    """Salva o conteúdo como arquivo de texto simples."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content.strip() + "\n", encoding="utf-8")
    print(f"[OK] TXT salvo: {output_path}")


# ── PDF (Ficha Técnica) ────────────────────────────────────────────────────────
def render_pdf(content: str, output_path: Path) -> None:
    """
    Converte texto estruturado da ficha técnica em PDF via ReportLab.
    Requer: pip install reportlab
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas as pdf_canvas
    except ImportError as e:
        raise ImportError(
            "ReportLab não instalado. Execute: pip install reportlab"
        ) from e

    output_path.parent.mkdir(parents=True, exist_ok=True)
    c = pdf_canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    margin = 50
    y = height - margin

    # Cabeçalho
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, y, "Ficha Técnica")
    y -= 10
    c.setLineWidth(0.5)
    c.line(margin, y, width - margin, y)
    y -= 24

    c.setFont("Helvetica", 10)
    for line in content.splitlines():
        if y < margin + 20:
            c.showPage()
            y = height - margin
            c.setFont("Helvetica", 10)

        stripped = line.strip()

        if stripped.startswith("Subcategoria:"):
            y -= 6
            c.setFont("Helvetica-Bold", 11)
            c.drawString(margin, y, stripped)
            c.setFont("Helvetica", 10)
            y -= 18
        elif stripped.startswith("-"):
            # item de lista
            wrapped = textwrap.wrap(stripped, width=90)
            for i, sub in enumerate(wrapped):
                indent = margin + 12 if i == 0 else margin + 20
                c.drawString(indent, y, sub)
                y -= 14
        elif stripped:
            wrapped = textwrap.wrap(stripped, width=95)
            for sub in wrapped:
                c.drawString(margin, y, sub)
                y -= 14
        else:
            y -= 8  # linha em branco

    c.save()
    print(f"[OK] PDF gerado: {output_path}")


# ── PNG / JPG (Banner) ─────────────────────────────────────────────────────────
def render_banner_image(content: str, output_path: Path) -> None:
    """
    Gera um banner visual com Pillow a partir do copy retornado pelo LLM.
    Para produção, substitua ou complemente com uma API de geração de imagem
    (ex: Imagen, DALL-E, Stability AI).
    Requer: pip install Pillow
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as e:
        raise ImportError(
            "Pillow não instalado. Execute: pip install Pillow"
        ) from e

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Dimensões padrão para banner horizontal (ex: LinkedIn, e-mail marketing)
    IMG_W, IMG_H = 1200, 628
    BG_COLOR = (12, 70, 110)       # azul corporativo
    ACCENT   = (0, 180, 160)       # teal
    TEXT_MAIN   = (255, 255, 255)
    TEXT_SECOND = (180, 220, 230)

    img  = Image.new("RGB", (IMG_W, IMG_H), color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Barra de destaque lateral
    draw.rectangle([(0, 0), (8, IMG_H)], fill=ACCENT)

    # Fontes — usa DejaVu se disponível, senão default
    FONT_PATHS = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]

    def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
        for path in FONT_PATHS:
            try:
                return ImageFont.truetype(path, size)
            except IOError:
                pass
        return ImageFont.load_default()

    font_title  = load_font(52, bold=True)
    font_body   = load_font(30)
    font_footer = load_font(20)

    lines   = [l.strip() for l in content.splitlines() if l.strip()]
    title   = lines[0] if lines else "Banner"
    body    = "  |  ".join(lines[1:3]) if len(lines) > 1 else ""
    footer  = lines[3] if len(lines) > 3 else ""

    draw.text((60, 160), title,  fill=TEXT_MAIN,   font=font_title)
    draw.text((60, 280), body,   fill=TEXT_SECOND, font=font_body)
    draw.text((60, 560), footer, fill=ACCENT,      font=font_footer)

    # Salva como PNG ou JPEG conforme extensão
    fmt = "JPEG" if output_path.suffix.lower() in (".jpg", ".jpeg") else "PNG"
    img.save(str(output_path), format=fmt, quality=92)
    print(f"[OK] Banner ({fmt}) gerado: {output_path}")


# ── PPTX (usa slides_ppt.py existente) ────────────────────────────────────────
def render_pptx(content: str, output_path: Path) -> None:
    """
    Converte o texto de slides gerado pelo LLM em arquivo PPTX.
    Usa o módulo slides_ppt.py já existente no projeto.
    """
    import tempfile
    from pathlib import Path as P

    try:
        from app.slides_ppt import slides_txt_to_ppt
    except ImportError as e:
        raise ImportError(
            "Módulo app.slides_ppt não encontrado. Verifique o projeto."
        ) from e

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(content)
        tmp_path = P(tmp.name)

    try:
        slides_txt_to_ppt(tmp_path, output_path=output_path)
    finally:
        tmp_path.unlink(missing_ok=True)

    print(f"[OK] PPTX gerado: {output_path}")
