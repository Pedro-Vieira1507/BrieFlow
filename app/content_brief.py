# content_brief.py
from pathlib import Path
import json
import os
import logging
import tempfile

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
logger = logging.getLogger(__name__)

INBOX_DIR = Path("data/inbox")

SYSTEM_PROMPT = """
Você é um especialista em marketing técnico de produtos laboratoriais.
Sua tarefa é ler a transcrição de um vídeo de treinamento sobre a linha DLAB
(Vidraria, Plásticos, Reagentes, Equipamentos, EPI, Descartáveis, Papelaria Técnica)
e produzir um RESUMO ESTRUTURADO que será usado para gerar materiais de marketing
da campanha \"Compre 3 Leve 4 — DLAB\" da Forlab.

Responda SEMPRE em português (pt-BR) e em JSON bem-formatado com os campos:

{
  "contexto_marca": {
    "marca": "...",
    "posicionamento": "...",
    "segmento": "...",
    "publico_alvo_principal": "..."
  },
  "linha_produtos": {
    "categoria_geral": "DLAB",
    "subcategorias": [
      {
        "nome": "Vidraria",
        "descricao": "...",
        "principais_caracteristicas": ["...", "..."],
        "diferenciais": ["...", "..."]
      },
      {
        "nome": "Plásticos",
        "descricao": "...",
        "principais_caracteristicas": ["..."],
        "diferenciais": ["..."]
      },
      {
        "nome": "Reagentes",
        "descricao": "...",
        "principais_caracteristicas": ["..."],
        "diferenciais": ["..."]
      },
      {
        "nome": "Equipamentos",
        "descricao": "...",
        "principais_caracteristicas": ["..."],
        "diferenciais": ["..."]
      },
      {
        "nome": "EPI",
        "descricao": "...",
        "principais_caracteristicas": ["..."],
        "diferenciais": ["..."]
      },
      {
        "nome": "Descartáveis",
        "descricao": "...",
        "principais_caracteristicas": ["..."],
        "diferenciais": ["..."]
      },
      {
        "nome": "Papelaria Técnica",
        "descricao": "...",
        "principais_caracteristicas": ["..."],
        "diferenciais": ["..."]
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
com suposições plausíveis e marcadas claramente como \"assumido\".
"""

# Modelo Gemini — use gemini-2.0-flash para melhor custo/benefício
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY não definido no .env. "
            "Obtenha sua chave em https://aistudio.google.com/app/apikey"
        )
    return genai.Client(api_key=api_key)


def build_brief_for_file(txt_path: Path) -> Path:
    """
    Lê a transcrição em txt_path, chama o Gemini para estruturar o brief
    e salva o JSON em txt_path.with_suffix('.brief.json').

    Args:
        txt_path: Caminho para o arquivo de transcrição (.txt).

    Returns:
        Caminho do arquivo .brief.json gerado.
    """
    transcript = txt_path.read_text(encoding="utf-8")
    logger.info(f"[ContentBrief] Processando: {txt_path.name} ({len(transcript)} chars)")

    client = get_client()

    prompt = f"""{SYSTEM_PROMPT}

Transcrição do vídeo:

{transcript}
"""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=types.Part.from_text(text=prompt),
            config=types.GenerateContentConfig(
                temperature=0.3,
            ),
        )
        content = response.text or ""
    except Exception as e:
        logger.error(f"[ContentBrief] Erro na chamada Gemini: {e}")
        raise

    def try_parse_json(text: str) -> str:
        """Remove blocos ```json ``` e garante JSON válido."""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        data = json.loads(cleaned)
        return json.dumps(data, ensure_ascii=False, indent=2)

    try:
        content = try_parse_json(content)
        logger.info(f"[ContentBrief] ✅ JSON válido gerado para: {txt_path.name}")
    except Exception:
        logger.warning(
            f"[ContentBrief] Resposta não é JSON puro — salvando como texto: {txt_path.name}"
        )

    out_path = txt_path.with_suffix(".brief.json")
    out_path.write_text(content, encoding="utf-8")
    logger.info(f"[ContentBrief] Brief salvo: {out_path}")
    return out_path


# ─────────────────────────────────────────────────────────────
# FUNÇÃO PÚBLICA — importada por drive_monitor e outros módulos
# ─────────────────────────────────────────────────────────────

def extract_brief_from_text(raw_text: str) -> str:
    """
    Alias público para uso direto pelo drive_monitor e outros módulos.

    Recebe o texto bruto da transcrição (string), chama o Gemini para
    estruturar o brief e retorna o conteúdo JSON como string.

    Se a API Gemini não estiver configurada (GEMINI_API_KEY ausente),
    retorna o próprio texto bruto como fallback para não travar o pipeline.

    Args:
        raw_text: Texto bruto da transcrição ou documento.

    Returns:
        String com o JSON do brief estruturado (ou texto bruto em fallback).
    """
    try:
        # Escreve em arquivo temporário para reutilizar build_brief_for_file
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".txt",
            encoding="utf-8",
            delete=False,
        ) as tmp:
            tmp.write(raw_text)
            tmp_path = Path(tmp.name)

        brief_path = build_brief_for_file(tmp_path)
        result = brief_path.read_text(encoding="utf-8")

        # Limpeza dos temporários
        tmp_path.unlink(missing_ok=True)
        brief_path.unlink(missing_ok=True)

        return result

    except RuntimeError as e:
        # GEMINI_API_KEY não configurado — retorna texto bruto como fallback
        logger.warning(
            f"[ContentBrief] Gemini não configurado, usando texto bruto como brief: {e}"
        )
        return raw_text
    except Exception as e:
        logger.error(f"[ContentBrief] Erro em extract_brief_from_text: {e}")
        # Fallback: retorna o texto bruto para não travar o pipeline
        return raw_text


def build_brief_from_drive(
    service,
    video_folder_id: str,
) -> list[Path]:
    """
    Integração completa Drive → Transcrição → Brief.

    Baixa vídeos/áudios da pasta do Google Drive, transcreve via Whisper
    e gera o brief estruturado para cada arquivo.

    Args:
        service: Serviço autenticado do Google Drive API.
        video_folder_id: ID da pasta no Drive com os vídeos de treinamento.

    Returns:
        Lista de Paths para os arquivos .brief.json gerados.
    """
    from app.transcriber import download_and_transcribe_from_drive

    logger.info(
        f"[ContentBrief] Iniciando pipeline Drive → Transcrição → Brief"
        f" (pasta: {video_folder_id})"
    )

    results = download_and_transcribe_from_drive(
        service=service,
        folder_id=video_folder_id,
        dest_folder=str(INBOX_DIR),
    )

    briefs: list[Path] = []
    for item in results:
        if not item.get("transcript_path"):
            logger.warning(
                f"[ContentBrief] Sem transcrição para: {item.get('file_name')}"
            )
            continue

        txt_path = Path(item["transcript_path"])
        if not txt_path.exists():
            logger.warning(f"[ContentBrief] Arquivo não encontrado: {txt_path}")
            continue

        brief_path = txt_path.with_suffix(".brief.json")
        if brief_path.exists():
            logger.info(f"[ContentBrief] Brief já existe: {brief_path.name}")
            briefs.append(brief_path)
            continue

        try:
            brief = build_brief_for_file(txt_path)
            briefs.append(brief)
        except Exception as e:
            logger.error(
                f"[ContentBrief] Erro ao gerar brief para {txt_path.name}: {e}"
            )

    logger.info(
        f"[ContentBrief] Pipeline concluído. "
        f"{len(briefs)} brief(s) gerado(s)."
    )
    return briefs


def generate_brief_for_inbox():
    """Processa todos os .txt na pasta data/inbox que ainda não têm brief."""
    if not INBOX_DIR.exists():
        logger.warning(f"Pasta {INBOX_DIR} não existe.")
        return

    for path in sorted(INBOX_DIR.iterdir()):
        if not path.is_file() or path.suffix.lower() != ".txt":
            continue
        # Ignora arquivos de transcrição já gerados
        if "_transcricao" in path.stem:
            continue

        brief_path = path.with_suffix(".brief.json")
        if brief_path.exists():
            logger.info(f"[IGNORADO] Já existe brief: {brief_path.name}")
            continue

        try:
            build_brief_for_file(path)
        except Exception as e:
            logger.error(f"[ContentBrief] Falha em {path.name}: {e}")


if __name__ == "__main__":
    generate_brief_for_inbox()
