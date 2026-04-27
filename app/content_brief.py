from pathlib import Path
import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

INBOX_DIR = Path("data/inbox")

SYSTEM_PROMPT = """
Você é um especialista em marketing técnico de equipamentos laboratoriais.
Sua tarefa é ler a transcrição de um vídeo de treinamento (por exemplo, sobre microcentrífugas
ou pipetadores) e produzir um RESUMO ESTRUTURADO que será usado para gerar vários conteúdos
(marketing e capacitação).

Responda SEMPRE em português (pt-BR) e em JSON bem-formatado com os campos:

{
  "contexto_marca": {
    "marca": "...",
    "posicionamento": "...",
    "segmento": "...",
    "publico_alvo_principal": "..."
  },
  "linha_produtos": {
    "categoria_geral": "Pipetadores DLAB",
    "subcategorias": [
      {
        "nome": "Micropipetas monocanal",
        "descricao": "...",
        "principais_caracteristicas": ["...", "..."],
        "diferenciais": ["...", "..."]
      }
    ]
  },
  "argumentos_comerciais": {
    "beneficios_para_revendedor": ["...", "..."],
    "beneficios_para_cliente_final": ["...", "..."],
    "motivos_para_comprar_agora": ["...", "..."]
  },
  "argumentos_tecnicos": {
    "performance": ["...", "..."],
    "ergonomia": ["...", "..."],
    "seguranca_qualidade": ["...", "..."]
  },
  "campanha_compre3_leve4": {
    "descricao_oferta": "...",
    "regras_principais": ["...", "..."],
    "observacoes_importantes": ["...", "..."]
  }
}

Use o texto da transcrição como base, mas complete lacunas
com suposições plausíveis e marcadas claramente como "assumido".
"""

MODEL_NAME = "gemini-3.1-flash-lite-preview"  # melhor custo/benefício disponível para você [web:305][web:306]


def get_client() -> genai.Client:
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY não definido no .env")

    return genai.Client(api_key=api_key)


def build_brief_for_file(txt_path: Path) -> Path:
    transcript = txt_path.read_text(encoding="utf-8")

    client = get_client()

    prompt = f"""{SYSTEM_PROMPT}

Transcrição do vídeo:

{transcript}
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=types.Part.from_text(text=prompt),
        config=types.GenerateContentConfig(
            temperature=0.3,
        ),
    )

    content = response.text or ""

    # tenta garantir JSON válido
    def try_parse_json(text: str) -> str:
        cleaned = text.strip()
        # tira ```json ``` se vier marcado
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        data = json.loads(cleaned)
        return json.dumps(data, ensure_ascii=False, indent=2)

    try:
        content = try_parse_json(content)
    except Exception:
        # salva bruto se não der pra parsear
        pass

    out_path = txt_path.with_suffix(".brief.json")
    out_path.write_text(content, encoding="utf-8")
    print(f"[OK] Brief estruturado salvo em: {out_path}")
    return out_path


def generate_brief_for_inbox():
    if not INBOX_DIR.exists():
        print(f"Pasta {INBOX_DIR} não existe.")
        return

    for path in INBOX_DIR.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() != ".txt":
            continue

        brief_path = path.with_suffix(".brief.json")
        if brief_path.exists():
            print(f"[IGNORADO] Já existe brief: {brief_path.name}")
            continue

        build_brief_for_file(path)


if __name__ == "__main__":
    generate_brief_for_inbox()