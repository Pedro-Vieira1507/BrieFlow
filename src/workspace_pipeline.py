import io
import os
import re
import json
import logging
import time
import random
from pathlib import Path
from typing import List, Dict, Optional

from dotenv import load_dotenv

# ── CRÍTICO: load_dotenv() deve ser chamado ANTES de qualquer os.getenv() ──
load_dotenv()

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from strands import Agent, tool
from strands.models import BedrockModel

# ── Configurações ────────────────────────────────────────────────────────────
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "data/output"))
INPUT_DIR = Path(os.getenv("INPUT_DIR", "data/inbox"))

SYSTEM_PROMPT_PATH = Path(os.getenv("SYSTEM_PROMPT_PATH", "prompts/system_prompt.txt"))
TOTAL_MATERIALS = int(os.getenv("TOTAL_MATERIALS", "8"))

# Strands / Bedrock
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-3-7-sonnet-20250219-v1:0")
BEDROCK_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

# ── Logger ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logging.getLogger("strands").setLevel(logging.DEBUG)
logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────────
# Google Drive helpers (sem alteração de lógica)
# ────────────────────────────────────────────────────────────────────────────

def get_drive_service():
    """Autentica no Google Drive e retorna o service."""
    creds = None
    token_path = Path("credentials/token.json")
    creds_path = Path("credentials/credentials.json")

    try:
        if token_path.exists():
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not creds_path.exists():
                    raise FileNotFoundError(
                        f"Arquivo de credenciais não encontrado: {creds_path}"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
                creds = flow.run_local_server(port=0)

            token_path.parent.mkdir(parents=True, exist_ok=True)
            token_path.write_text(creds.to_json(), encoding="utf-8")

        return build("drive", "v3", credentials=creds)

    except Exception as e:
        logger.exception("Falha ao autenticar no Google Drive")
        raise RuntimeError(f"Erro de autenticação no Google Drive: {e}")


# ────────────────────────────────────────────────────────────────────────────
# TOOLS do Strands Agents
# ────────────────────────────────────────────────────────────────────────────

@tool
def listar_arquivos_drive(folder_id: str) -> List[Dict]:
    """
    Lista todos os arquivos de texto/docx em uma pasta do Google Drive.

    Args:
        folder_id (str): ID da pasta no Google Drive.

    Returns:
        List[Dict]: Lista de dicts com 'id', 'name', 'mimeType' de cada arquivo.
    """
    if not folder_id:
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID não definido no .env")

    service = get_drive_service()
    query = f"'{folder_id}' in parents and trashed = false"
    fields = "nextPageToken, files(id,name,mimeType)"
    all_files: List[Dict] = []
    page_token = None

    while True:
        params = dict(
            q=query,
            fields=fields,
            pageSize=100,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
        )
        if page_token:
            params["pageToken"] = page_token

        result = service.files().list(**params).execute()
        all_files.extend(result.get("files", []))
        page_token = result.get("nextPageToken")
        if not page_token:
            break

    processable_mimes = {"text/plain", "application/vnd.google-apps.document"}
    processable_exts = (".txt", ".docx")
    targets = [
        f for f in all_files
        if f["mimeType"] in processable_mimes
        or f["name"].lower().endswith(processable_exts)
    ]

    logger.info("Drive: %d arquivo(s) elegíveis encontrados.", len(targets))
    return targets


@tool
def baixar_arquivo_drive(file_id: str, file_name: str, mime_type: str) -> str:
    """
    Baixa ou exporta um arquivo do Google Drive para o diretório local de entrada.

    Args:
        file_id (str): ID do arquivo no Google Drive.
        file_name (str): Nome original do arquivo.
        mime_type (str): MIME type do arquivo.

    Returns:
        str: Caminho absoluto do arquivo baixado localmente.
    """
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    service = get_drive_service()
    safe_name = re.sub(r'[<>:"/\\|?*]', "_", file_name).strip()

    if mime_type == "application/vnd.google-apps.document":
        request = service.files().export_media(fileId=file_id, mimeType="text/plain")
        out_path = INPUT_DIR / f"{Path(safe_name).stem}.txt"
    else:
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        out_path = INPUT_DIR / safe_name

    with io.FileIO(str(out_path), "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                logger.info("Download %s: %.0f%%", safe_name, status.progress() * 100)

    logger.info("Arquivo salvo em: %s", out_path)
    return str(out_path)


@tool
def ler_transcricao(file_path: str) -> str:
    """
    Lê o conteúdo de texto de um arquivo local (transcrição).

    Args:
        file_path (str): Caminho do arquivo local.

    Returns:
        str: Conteúdo completo do arquivo como string.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")

    content = path.read_text(encoding="utf-8")
    if not content.strip():
        logger.warning("Arquivo '%s' está vazio.", file_path)
    return content


@tool
def carregar_system_prompt() -> str:
    """
    Carrega o system prompt do arquivo configurado via SYSTEM_PROMPT_PATH.

    Returns:
        str: Conteúdo do system prompt.
    """
    if SYSTEM_PROMPT_PATH.exists():
        return SYSTEM_PROMPT_PATH.read_text(encoding="utf-8").strip()
    logger.warning("System prompt não encontrado em '%s'. Usando prompt padrão.", SYSTEM_PROMPT_PATH)
    return "Você é um assistente especializado em marketing e conteúdo."


@tool
def parsear_materiais(raw_text: str) -> Dict[str, str]:
    """
    Fatia o texto retornado pelo LLM em materiais individuais separados por marcadores
    no formato 'MATERIAL N' (onde N vai de 1 até TOTAL_MATERIALS).

    Args:
        raw_text (str): Texto bruto retornado pelo LLM.

    Returns:
        Dict[str, str]: Dicionário com chaves 'material_1' ... 'material_N'
                        e o conteúdo correspondente de cada material.
    """
    materials: Dict[str, str] = {}

    for i in range(1, TOTAL_MATERIALS + 1):
        next_marker = f"MATERIAL\\s*{i + 1}" if i < TOTAL_MATERIALS else None
        lookahead = f"(?=\\n{next_marker}|\\Z)" if next_marker else "(?=\\Z)"
        pattern = rf"(MATERIAL\s*{i}.*?){lookahead}"

        match = re.search(pattern, raw_text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            materials[f"material_{i}"] = match.group(1).strip()
        else:
            logger.warning("MATERIAL %d não encontrado na resposta do LLM.", i)
            materials[f"material_{i}"] = ""

    found = sum(1 for v in materials.values() if v)
    logger.info("Parse concluído: %d/%d materiais extraídos.", found, TOTAL_MATERIALS)
    return materials


@tool
def salvar_materiais(materials_json: str, source_name: str) -> str:
    """
    Salva cada material como arquivo .txt em OUTPUT_DIR/<source_name>/
    e gera um manifest.json com o resumo do processamento.

    Args:
        materials_json (str): JSON serializado do dicionário de materiais
                              (chaves 'material_1' ... 'material_N').
        source_name (str): Nome do arquivo fonte (usado como nome do subdiretório).

    Returns:
        str: Caminho absoluto do diretório de saída criado.
    """
    materials: Dict[str, str] = json.loads(materials_json)
    output_dir = OUTPUT_DIR / Path(source_name).stem
    output_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for key, content in materials.items():
        file_path = output_dir / f"{key}.txt"
        body = content.strip() if content.strip() else f"[{key} não gerado pelo LLM]"
        file_path.write_text(body + "\n", encoding="utf-8")
        saved.append(key)

    manifest = {
        "source": source_name,
        "materials": saved,
        "total_generated": sum(1 for v in materials.values() if v.strip()),
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    logger.info("Materiais salvos em: %s", output_dir)
    return str(output_dir)


# ────────────────────────────────────────────────────────────────────────────
# Agente Strands
# ────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Você é um pipeline de automação de conteúdo de marketing especializado.
Sua missão é processar transcrições de reuniões armazenadas no Google Drive e gerar
materiais de marketing estruturados.

Fluxo obrigatório para CADA arquivo:
1. Use 'listar_arquivos_drive' com o folder_id fornecido para obter a lista de arquivos.
2. Para cada arquivo da lista:
   a. Use 'baixar_arquivo_drive' passando id, name e mimeType do arquivo.
   b. Use 'ler_transcricao' com o caminho retornado para obter o texto.
   c. Se o texto estiver vazio, pule este arquivo e vá ao próximo.
   d. Use 'carregar_system_prompt' para obter as instruções de geração de materiais.
   e. Combine o system prompt + transcrição e gere os 8 materiais de marketing diretamente,
      usando os marcadores 'MATERIAL 1', 'MATERIAL 2', ..., 'MATERIAL 8' para separar cada um.
   f. Use 'parsear_materiais' com o texto gerado para extrair os materiais individuais.
   g. Serialize o dicionário retornado para JSON e use 'salvar_materiais' para persistir
      os arquivos no disco, passando o JSON e o nome do arquivo fonte.
3. Ao final, reporte: quantos arquivos foram processados, quantos materiais foram gerados
   no total e os caminhos dos diretórios de saída criados.

Regras de robustez:
- Se um arquivo falhar em qualquer etapa, registre o erro e continue com o próximo.
- Nunca interrompa o pipeline por falha em um único arquivo.
"""

bedrock_model = BedrockModel(
    model_id=BEDROCK_MODEL_ID,
    region_name=BEDROCK_REGION,
    temperature=0.4,
)

agent = Agent(
    model=bedrock_model,
    system_prompt=SYSTEM_PROMPT,
    tools=[
        listar_arquivos_drive,
        baixar_arquivo_drive,
        ler_transcricao,
        carregar_system_prompt,
        parsear_materiais,
        salvar_materiais,
    ],
)


def main() -> None:
    """Ponto de entrada principal do pipeline."""
    load_dotenv()

    if not DRIVE_FOLDER_ID:
        logger.error("GOOGLE_DRIVE_FOLDER_ID não está definido no .env. Abortando.")
        return

    logger.info("Iniciando BriefFlow Pipeline (Strands Agents)...")

    result = agent(
        f"Processe todos os arquivos de transcrição da pasta do Google Drive com ID: '{DRIVE_FOLDER_ID}'. "
        f"Siga o fluxo completo: listar → baixar → ler → gerar materiais → parsear → salvar. "
        f"Ao final, me dê um resumo do que foi processado."
    )

    print(result.message)


if __name__ == "__main__":
    main()
