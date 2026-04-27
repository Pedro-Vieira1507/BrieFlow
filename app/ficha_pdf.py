# ficha_pdf.py
import os
import logging
from weasyprint import HTML as WeasyprintHTML

logger = logging.getLogger(__name__)


def _build_html(content: str, title: str = "Ficha Técnica") -> str:
    """Monta o HTML/CSS estilizado para a ficha técnica no formato A4."""
    sections_html = ""
    current_section_title = None
    current_items: list[str] = []
    intro_lines: list[str] = []
    in_intro = True

    def flush_section():
        nonlocal sections_html
        if current_section_title:
            items_html = "".join(
                f"<li>{item}</li>" for item in current_items if item
            )
            sections_html += f"""
            <div class="section">
                <h2>{current_section_title}</h2>
                <ul>{items_html}</ul>
            </div>"""

    for line in content.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue

        is_heading = stripped.startswith("##") or stripped.startswith("# ")
        is_all_caps = stripped.upper() == stripped and len(stripped) > 4 and stripped.isalpha() is False

        if is_heading or is_all_caps:
            in_intro = False
            flush_section()
            current_section_title = stripped.lstrip("# ").strip()
            current_items = []
        elif stripped.startswith(("- ", "* ", "• ")):
            in_intro = False
            current_items.append(stripped[2:])
        elif stripped.startswith("**") and stripped.endswith("**"):
            current_items.append(f"<strong>{stripped.strip('*')}</strong>")
        elif in_intro:
            intro_lines.append(stripped)
        else:
            current_items.append(stripped)

    flush_section()

    intro_html = ""
    if intro_lines:
        intro_html = f"""<div class="intro"><p>{' '.join(intro_lines)}</p></div>"""

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page {{
    size: A4;
    margin: 2cm 2.5cm 2.5cm 2.5cm;
  }}
  body {{
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.5pt;
    color: #1a1a2e;
    line-height: 1.6;
    margin: 0;
    padding: 0;
  }}
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 3px solid #01696f;
    padding-bottom: 14px;
    margin-bottom: 26px;
  }}
  .header-left h1 {{
    font-size: 20pt;
    color: #01696f;
    margin: 0 0 4px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }}
  .header-left .subtitle {{
    font-size: 9pt;
    color: #666;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }}
  .header-right .badge {{
    display: inline-block;
    background: #01696f;
    color: white;
    font-size: 8pt;
    padding: 3px 10px;
    border-radius: 20px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }}
  .intro {{
    background: #f0f7f7;
    border-left: 4px solid #01696f;
    padding: 10px 14px;
    margin-bottom: 22px;
    border-radius: 0 6px 6px 0;
    font-size: 10pt;
    color: #334;
  }}
  .section {{
    margin-bottom: 18px;
    page-break-inside: avoid;
  }}
  .section h2 {{
    font-size: 9.5pt;
    font-weight: 700;
    color: #0c4e54;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    border-left: 3px solid #01696f;
    padding-left: 8px;
    margin: 0 0 7px;
    line-height: 1.3;
  }}
  .section ul {{
    margin: 0;
    padding-left: 16px;
  }}
  .section ul li {{
    margin-bottom: 4px;
    font-size: 10pt;
  }}
  .footer-note {{
    margin-top: 32px;
    border-top: 1px solid #ddd;
    padding-top: 10px;
    font-size: 7.5pt;
    color: #aaa;
    text-align: center;
    position: running(footer);
  }}
  @page {{
    @bottom-center {{
      content: element(footer);
    }}
  }}
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>{title}</h1>
      <div class="subtitle">Campanha Compre 3 Leve 4 — DLAB • Forlab</div>
    </div>
    <div class="header-right">
      <span class="badge">FORLAB</span>
    </div>
  </div>

  {intro_html}
  {sections_html}

  <div class="footer-note">
    Documento gerado automaticamente pelo Agente de Documentação Forlab.
    Distribuição interna — proibida reprodução sem autorização.
  </div>
</body>
</html>"""


def save_ficha_as_pdf(
    content: str,
    output_path: str,
    title: str = "Ficha Técnica",
) -> str:
    """
    Gera a ficha técnica como PDF profissional usando WeasyPrint.

    Args:
        content: Texto da ficha (markdown simples ou texto corrido).
        output_path: Caminho completo do arquivo .pdf de saída.
        title: Título que aparece no cabeçalho da ficha.

    Returns:
        Caminho do PDF gerado.

    Raises:
        Exception: Em caso de erro na geração do PDF.
    """
    try:
        dest_dir = os.path.dirname(output_path)
        if dest_dir:
            os.makedirs(dest_dir, exist_ok=True)

        html_content = _build_html(content, title)
        WeasyprintHTML(string=html_content).write_pdf(output_path)
        logger.info(f"[FichaPDF] ✅ PDF gerado: {output_path}")
        return output_path
    except Exception as e:
        logger.error(f"[FichaPDF] Erro ao gerar PDF '{output_path}': {e}")
        raise
