# ficha_pdf.py
"""
Gera a Ficha Técnica em PDF usando ReportLab (100% Python, sem libs C externas).
Substitui WeasyPrint que exige GTK/libgobject não disponível no Windows por padrão.
"""
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Paleta Forlab
FORLAB_TEAL   = (1 / 255, 105 / 255, 111 / 255)   # #01696f
FORLAB_DARK   = (12 / 255,  78 / 255,  84 / 255)   # #0c4e54
FORLAB_LIGHT  = (240 / 255, 247 / 255, 247 / 255)  # #f0f7f7
FORLAB_TEXT   = (26 / 255,  26 / 255,  46 / 255)   # #1a1a2e
FORLAB_MUTED  = (100 / 255, 100 / 255, 100 / 255)
FORLAB_WHITE  = (1.0, 1.0, 1.0)
FORLAB_BORDER = (221 / 255, 221 / 255, 221 / 255)  # #dddddd


def _parse_sections(content: str) -> tuple[str, list[tuple[str, list[str]]]]:
    """
    Faz parse simples do conteúdo em:
      - intro_text: parágrafo inicial (antes de qualquer seção)
      - sections: lista de (título, [itens])
    """
    intro_lines: list[str] = []
    sections: list[tuple[str, list[str]]] = []
    current_title: str | None = None
    current_items: list[str] = []
    in_intro = True

    def flush():
        if current_title is not None:
            sections.append((current_title, list(current_items)))

    for raw in content.split("\n"):
        line = raw.strip()
        if not line:
            continue

        is_heading = line.startswith("## ") or line.startswith("# ")
        is_allcaps = (
            len(line) > 4
            and line == line.upper()
            and any(c.isalpha() for c in line)
        )

        if is_heading or is_allcaps:
            in_intro = False
            flush()
            current_title = line.lstrip("# ").strip()
            current_items = []
        elif line.startswith(("- ", "* ", "• ")):
            in_intro = False
            current_items.append(line[2:].strip())
        elif in_intro:
            intro_lines.append(line)
        else:
            current_items.append(line)

    flush()
    return " ".join(intro_lines), sections


def save_ficha_as_pdf(
    content: str,
    output_path: str,
    title: str = "Ficha Técnica",
) -> str:
    """
    Gera a ficha técnica como PDF profissional usando ReportLab.

    Args:
        content: Texto da ficha (markdown simples ou texto corrido).
        output_path: Caminho completo do arquivo .pdf de saída.
        title: Título que aparece no cabeçalho da ficha.

    Returns:
        Caminho do PDF gerado.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm, mm
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_LEFT, TA_CENTER
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
            Table, TableStyle, KeepTogether,
        )
        from reportlab.platypus.flowables import HRFlowable
    except ImportError as exc:
        raise ImportError(
            "reportlab não instalado. Execute: pip install reportlab"
        ) from exc

    dest_dir = os.path.dirname(output_path)
    if dest_dir:
        os.makedirs(dest_dir, exist_ok=True)

    # ── Configurações do documento ──────────────────────────────────────
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
        topMargin=2.2 * cm,
        bottomMargin=2.5 * cm,
        title=title,
        author="Agente Documentação Forlab",
    )

    W = A4[0] - 5 * cm  # largura útil

    # ── Estilos ──────────────────────────────────────────────────────────
    teal   = colors.Color(*FORLAB_TEAL)
    dark   = colors.Color(*FORLAB_DARK)
    light  = colors.Color(*FORLAB_LIGHT)
    muted  = colors.Color(*FORLAB_MUTED)
    txt    = colors.Color(*FORLAB_TEXT)
    border = colors.Color(*FORLAB_BORDER)

    base = getSampleStyleSheet()

    style_title = ParagraphStyle(
        "FichaTitle",
        fontSize=20,
        textColor=teal,
        fontName="Helvetica-Bold",
        leading=24,
        spaceAfter=2,
    )
    style_subtitle = ParagraphStyle(
        "FichaSubtitle",
        fontSize=8,
        textColor=muted,
        fontName="Helvetica",
        letterSpacing=1.2,
        spaceAfter=0,
    )
    style_badge = ParagraphStyle(
        "FichaBadge",
        fontSize=8,
        textColor=colors.white,
        fontName="Helvetica-Bold",
        alignment=TA_CENTER,
    )
    style_intro = ParagraphStyle(
        "FichaIntro",
        fontSize=9.5,
        textColor=txt,
        fontName="Helvetica",
        leading=14,
        leftIndent=10,
        borderPad=8,
        spaceAfter=0,
    )
    style_section_head = ParagraphStyle(
        "FichaSectionHead",
        fontSize=9,
        textColor=dark,
        fontName="Helvetica-Bold",
        leading=12,
        spaceBefore=6,
        spaceAfter=4,
        leftIndent=10,
    )
    style_item = ParagraphStyle(
        "FichaItem",
        fontSize=9.5,
        textColor=txt,
        fontName="Helvetica",
        leading=13,
        leftIndent=16,
        bulletIndent=6,
        spaceAfter=2,
    )
    style_footer = ParagraphStyle(
        "FichaFooter",
        fontSize=7,
        textColor=muted,
        fontName="Helvetica",
        alignment=TA_CENTER,
        spaceBefore=8,
    )

    # ── Parse do conteúdo ────────────────────────────────────────────────
    intro_text, sections = _parse_sections(content)

    # ── Monta o fluxo de elementos ───────────────────────────────────────
    story = []

    # Cabeçalho: título à esquerda + badge à direita
    badge_cell = Paragraph("FORLAB", style_badge)
    header_table = Table(
        data=[
            [
                [Paragraph(title, style_title),
                 Paragraph("Campanha Compre 3 Leve 4 — DLAB • Forlab", style_subtitle)],
                badge_cell,
            ]
        ],
        colWidths=[W - 2.2 * cm, 2.2 * cm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN",      (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN",       (1, 0), (1, 0),  "RIGHT"),
        ("BACKGROUND",  (1, 0), (1, 0),  teal),
        ("ROUNDEDCORNERS", (1, 0), (1, 0), [10]),
        ("TOPPADDING",  (1, 0), (1, 0),  5),
        ("BOTTOMPADDING", (1, 0), (1, 0), 5),
        ("LEFTPADDING", (1, 0), (1, 0),  8),
        ("RIGHTPADDING", (1, 0), (1, 0), 8),
        ("LEFTPADDING", (0, 0), (0, 0),  0),
        ("TOPPADDING",  (0, 0), (0, 0),  0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=2.5, color=teal, spaceAfter=4 * mm))

    # Bloco intro (fundo claro + borda esquerda teal)
    if intro_text:
        intro_table = Table(
            data=[[Paragraph(intro_text, style_intro)]],
            colWidths=[W],
        )
        intro_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), light),
            ("LEFTPADDING",   (0, 0), (-1, -1), 14),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
            ("TOPPADDING",    (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LINEAFTER",     (0, 0), (0, -1),  0, teal, 0),
            ("LINEBEFORE",    (0, 0), (0, -1),  3.5, teal),
            ("ROUNDEDCORNERS", (0, 0), (-1, -1), [0, 4, 4, 0]),
        ]))
        story.append(intro_table)
        story.append(Spacer(1, 5 * mm))

    # Seções
    for sec_title, items in sections:
        block = []
        # Título da seção com borda esquerda teal
        sec_head = Table(
            data=[[Paragraph(sec_title.upper(), style_section_head)]],
            colWidths=[W],
        )
        sec_head.setStyle(TableStyle([
            ("LINEBEFORE",    (0, 0), (0, -1), 3, teal),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        block.append(sec_head)
        for item in items:
            if item:
                block.append(Paragraph(f"• {item}", style_item))
        block.append(Spacer(1, 3 * mm))
        story.append(KeepTogether(block))

    # Rodapé
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=border, spaceAfter=3 * mm))
    story.append(Paragraph(
        "Documento gerado automaticamente pelo Agente de Documentação Forlab. "
        "Distribuição interna — proibida reprodução sem autorização.",
        style_footer,
    ))

    # ── Gera o PDF ───────────────────────────────────────────────────────
    doc.build(story)
    logger.info(f"[FichaPDF] ✅ PDF gerado: {output_path}")
    return output_path
