from pathlib import Path

from weasyprint import HTML


def ficha_txt_to_pdf(txt_path: Path) -> Path:
    """
    Converte o texto da ficha técnica (txt) em um PDF simples.

    txt_path: caminho do arquivo .txt (ex.: ficha_tecnica_vendedores.txt)
    retorna: caminho do .pdf gerado
    """
    text = txt_path.read_text(encoding="utf-8")

    # Aqui fazemos uma conversão simples: texto em <pre>, mantendo quebras.
    # Se quiser, depois dá pra formatar em HTML mais elaborado.
    html = f"""
    <html>
      <head>
        <meta charset="utf-8">
        <title>Ficha técnica</title>
        <style>
          body {{
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.5;
            padding: 24px;
          }}
          h1, h2, h3 {{
            font-weight: bold;
          }}
          pre {{
            white-space: pre-wrap;
          }}
        </style>
      </head>
      <body>
        <pre>{text}</pre>
      </body>
    </html>
    """

    pdf_path = txt_path.with_suffix(".pdf")
    HTML(string=html).write_pdf(str(pdf_path))
    print(f"[OK] Ficha técnica PDF gerada em: {pdf_path}")
    return pdf_path