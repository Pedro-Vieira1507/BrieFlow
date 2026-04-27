from __future__ import annotations

import html as html_lib
import logging
import re
from pathlib import Path

from weasyprint import HTML

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers de formatação
# ---------------------------------------------------------------------------

def _parse_sections(text: str) -> list[dict]:
    """
    Quebra o texto em seções usando linhas em MAIÚSCULAS como cabeçalhos.
    Cada seção tem um 'title' e uma lista de 'items'.
    """
    sections: list[dict] = []
    current: dict | None = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        # Linha toda em maiúsculas (pelo menos 4 chars) = título de seção
        if re.match(r'^[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇÀÜÑ\s\-\.\:\/]{4,}$', line) and line == line.upper():
            current = {"title": line.title(), "items": []}
            sections.append(current)
        else:
            if current is None:
                current = {"title": "Informações Gerais", "items": []}
                sections.append(current)
            current["items"].append(line)

    return sections


def _render_item(line: str) -> str:
    """Converte uma linha em HTML semântico (bullet, par chave:valor ou parágrafo)."""
    escaped = html_lib.escape(line)

    # Bullet: começa com - ou •
    if re.match(r'^[-•]\s+', escaped):
        content = re.sub(r'^[-•]\s+', '', escaped)
        return f'<li>{content}</li>'

    # Par chave: valor
    if ':' in escaped:
        parts = escaped.split(':', 1)
        key, value = parts[0].strip(), parts[1].strip()
        if key and value:
            return (
                f'<div class="kv-row">'
                f'<span class="kv-key">{key}</span>'
                f'<span class="kv-value">{value}</span>'
                f'</div>'
            )

    return f'<p>{escaped}</p>'


def _sections_to_html(sections: list[dict], title: str = "Ficha Técnica") -> str:
    body_parts: list[str] = []

    for section in sections:
        sec_title = html_lib.escape(section["title"])
        items     = section["items"]

        body_parts.append(f'<div class="section">')
        body_parts.append(f'<h2>{sec_title}</h2>')

        # Detecta se há bullets misturados com outros itens
        bullets = [i for i in items if re.match(r'^[-•]\s+', i)]
        others  = [i for i in items if not re.match(r'^[-•]\s+', i)]

        # Renderiza itens não-bullet primeiro
        for item in others:
            body_parts.append(_render_item(item))

        # Agrupa bullets em <ul>
        if bullets:
            body_parts.append('<ul>')
            for b in bullets:
                content = re.sub(r'^[-•]\s+', '', html_lib.escape(b))
                body_parts.append(f'<li>{content}</li>')
            body_parts.append('</ul>')

        body_parts.append('</div>')

    body_html = '\n'.join(body_parts)
    doc_title = html_lib.escape(title)

    return f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>{doc_title}</title>
  <style>
    @page {{
      size: A4;
      margin: 20mm 18mm 22mm 18mm;
      @bottom-center {{
        content: counter(page) " / " counter(pages);
        font-size: 9pt;
        color: #888;
      }}
    }}

    :root {{
      --brand: #005B96;
      --brand-light: #E8F4FD;
      --accent: #0077B6;
      --text: #1a1a2e;
      --muted: #555;
      --border: #d0dde8;
    }}

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
      font-family: "Helvetica Neue", Arial, sans-serif;
      font-size: 10.5pt;
      color: var(--text);
      line-height: 1.55;
    }}

    /* ── Header ── */
    .header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid var(--brand);
      padding-bottom: 8px;
      margin-bottom: 18px;
    }}
    .header .brand {{
      font-size: 18pt;
      font-weight: 700;
      color: var(--brand);
      letter-spacing: -0.5px;
    }}
    .header .doc-meta {{
      font-size: 8.5pt;
      color: var(--muted);
      text-align: right;
    }}

    /* ── Page title ── */
    h1 {{
      font-size: 16pt;
      font-weight: 700;
      color: var(--brand);
      margin-bottom: 16px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
    }}

    /* ── Sections ── */
    .section {{
      margin-bottom: 18px;
      page-break-inside: avoid;
    }}
    h2 {{
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: white;
      background: var(--brand);
      padding: 4px 8px;
      border-radius: 3px;
      margin-bottom: 8px;
    }}

    /* ── Key-value rows ── */
    .kv-row {{
      display: flex;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px solid var(--border);
    }}
    .kv-key {{
      min-width: 180px;
      font-weight: 600;
      color: var(--accent);
      flex-shrink: 0;
    }}
    .kv-value {{
      color: var(--text);
    }}

    /* ── Bullet lists ── */
    ul {{
      margin: 4px 0 6px 16px;
      padding: 0;
    }}
    li {{
      margin-bottom: 3px;
      color: var(--text);
    }}
    li::marker {{
      color: var(--brand);
    }}

    /* ── Paragraphs ── */
    p {{
      margin: 4px 0;
      color: var(--muted);
    }}

    /* ── Footer note ── */
    .footer-note {{
      margin-top: 28px;
      font-size: 8pt;
      color: #aaa;
      border-top: 1px solid var(--border);
      padding-top: 6px;
    }}
  </style>
</head>
<body>

  <div class="header">
    <span class="brand">Forlab</span>
    <div class="doc-meta">
      Ficha Técnica DLAB<br>
      Campanha: Compre 3 Leve 4
    </div>
  </div>

  <h1>{doc_title}</h1>

  {body_html}

  <div class="footer-note">
    Documento gerado automaticamente pelo agente de documentação Forlab.
    Uso interno e para revendedores autorizados.
  </div>

</body>
</html>
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def ficha_txt_to_pdf(txt_path: Path, document_title: str | None = None) -> Path:
    """
    Converte o texto da ficha técnica em um PDF com layout profissional.

    Args:
        txt_path: caminho do arquivo .txt gerado pelo LLM
        document_title: título exibido no PDF (padrão: nome do arquivo)

    Returns:
        caminho do .pdf gerado
    """
    txt_path = Path(txt_path)
    text     = txt_path.read_text(encoding="utf-8")

    title    = document_title or txt_path.stem.replace("_", " ").title()
    sections = _parse_sections(text)
    html_str = _sections_to_html(sections, title=title)

    pdf_path = txt_path.with_suffix(".pdf")
    HTML(string=html_str).write_pdf(str(pdf_path))

    logger.info(f"[OK] Ficha técnica PDF gerada em: {pdf_path}")
    return pdf_path
