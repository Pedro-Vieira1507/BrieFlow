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
from google import genai
from google.genai import types
from google.genai import errors as genai_errors

# ── Configurações (lidas APÓS load_dotenv) ──────────────────────────────────
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "data/output"))
INPUT_DIR = Path(os.getenv("INPUT_DIR", "data/inbox"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
SYSTEM_PROMPT_PATH = Path(os.getenv("SYSTEM_PROMPT_PATH", "prompts/system_prompt.txt"))

MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "5"))
TOTAL_MATERIALS = int(os.getenv("TOTAL_MATERIALS", "8"))

# ── Logger ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Google Drive ─────────────────────────────────────────────────────────────

def get_drive_service():
    """Autentica no Google Drive e retorna o service. Inclui try/except robusto."""
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


def get_drive_files(service, folder_id: str) -> List[Dict]:
    """Lista TODOS os arquivos da pasta, implementando paginação com nextPageToken.

    BUG CORRIGIDO: a versão anterior usava pageSize=100 sem paginação,
    silenciosamente ignorando arquivos além do limite.
    """
    if not folder_id:
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID não definido no .env")

    query = f"'{folder_id}' in parents and trashed = false"
    fields = "nextPageToken, files(id,name,mimeType,createdTime,webViewLink,capabilities(canDownload))"
    all_files = []
    page_token = None

    try:
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
            batch = result.get("files", [])
            all_files.extend(batch)

            page_token = result.get("nextPageToken")
            if not page_token:
                break

        logger.info("Encontrados %s arquivo(s) no Drive (todas as páginas).", len(all_files))
        return all_files

    except Exception as e:
        logger.exception("Falha ao listar arquivos do Drive")
        raise RuntimeError(f"Erro ao listar arquivos do Drive: {e}")


def download_drive_file(service, file_id: str, file_name: str, mime_type: str) -> Path:
    """Baixa ou exporta um arquivo do Drive para INPUT_DIR."""
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r'[<>:"/\\|?*]', "_", file_name).strip()

    try:
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
        return out_path

    except Exception as e:
        logger.exception("Falha ao baixar/exportar arquivo '%s'", file_name)
        raise RuntimeError(f"Erro ao baixar/exportar arquivo: {e}")


# ── LLM (Gemini) ─────────────────────────────────────────────────────────────

def load_system_prompt() -> str:
    """Carrega o system prompt do arquivo configurado via SYSTEM_PROMPT_PATH."""
    if SYSTEM_PROMPT_PATH.exists():
        return SYSTEM_PROMPT_PATH.read_text(encoding="utf-8").strip()
    logger.warning("System prompt não encontrado em '%s'. Usando prompt padrão.", SYSTEM_PROMPT_PATH)
    return "Você é um assistente especializado em marketing e conteúdo."


def call_llm_api(transcription_text: str, system_prompt: str) -> str:
    """Chama a API Gemini com retry + backoff exponencial para erros de servidor.

    BUG CORRIGIDO: GEMINI_API_KEY agora validada antes de instanciar o client.
    MELHORIA: retry com backoff exponencial para ServerError (5xx).
    """
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY não definido no .env. "
            "Adicione a chave antes de executar o pipeline."
        )

    client = genai.Client(api_key=GEMINI_API_KEY)

    prompt = f"{system_prompt}\n\nTRANSCRIÇÃO:\n{transcription_text}".strip()
    last_error: Optional[Exception] = None

    for attempt in range(MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=types.Part.from_text(text=prompt),
                config=types.GenerateContentConfig(temperature=0.4),
            )

            text = (response.text or "").strip()
            if not text:
                raise RuntimeError("A API do LLM retornou resposta vazia.")

            logger.info("Resposta do LLM recebida com sucesso (tentativa %d).", attempt + 1)
            return text

        except genai_errors.ServerError as e:
            last_error = e
            wait = (2 ** attempt) + random.uniform(0.2, 1.2)
            logger.warning(
                "ServerError na tentativa %d/%d. Aguardando %.1fs...",
                attempt + 1, MAX_RETRIES, wait,
            )
            if attempt < MAX_RETRIES - 1:
                time.sleep(wait)

        except genai_errors.APIError as e:
            logger.exception("APIError não recuperável ao chamar LLM")
            raise RuntimeError(f"Erro na chamada ao LLM: {e}")

        except Exception as e:
            logger.exception("Falha inesperada ao chamar LLM")
            raise RuntimeError(f"Erro inesperado ao chamar LLM: {e}")

    raise RuntimeError(
        f"LLM falhou após {MAX_RETRIES} tentativas. Último erro: {last_error}"
    )


# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_content(raw_text: str) -> Dict[str, str]:
    """Fatia o texto retornado pelo LLM em materiais separados.

    MELHORIA: usa loop dinâmico em vez de 8 padrões duplicados.
    Loga aviso quando um material não é encontrado no texto.
    """
    materials = {}

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


# ── Output ────────────────────────────────────────────────────────────────────

def save_to_output(materials: Dict[str, str], source_name: str) -> Path:
    """Salva cada material como arquivo .txt e gera um manifest.json.

    MELHORIA: materiais vazios recebem conteúdo indicativo em vez de
    arquivo em branco silencioso.
    """
    output_dir = OUTPUT_DIR / Path(source_name).stem
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
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
        return output_dir

    except OSError as e:
        logger.exception("Falha de I/O ao salvar materiais")
        raise RuntimeError(f"Erro ao salvar materiais em disco: {e}")


# ── Orquestração ──────────────────────────────────────────────────────────────

def process_file(service, file_info: Dict) -> None:
    """Orquestra o fluxo completo para um único arquivo: download → LLM → parse → save."""
    name = file_info["name"]
    file_id = file_info["id"]
    mime_type = file_info["mimeType"]

    logger.info("── Iniciando processamento: %s ──", name)

    logger.info("[1/4] Baixando arquivo do Drive...")
    local_path = download_drive_file(service, file_id, name, mime_type)

    logger.info("[2/4] Lendo transcrição...")
    transcription_text = local_path.read_text(encoding="utf-8")
    if not transcription_text.strip():
        logger.warning("Arquivo '%s' está vazio. Pulando.", name)
        return

    logger.info("[3/4] Chamando LLM...")
    system_prompt = load_system_prompt()
    raw_output = call_llm_api(transcription_text, system_prompt)

    logger.info("[4/4] Parseando e salvando materiais...")
    materials = parse_content(raw_output)
    save_to_output(materials, name)

    logger.info("── Concluído: %s ──", name)


def main() -> None:
    """Ponto de entrada principal do pipeline."""
    # load_dotenv() já foi chamado no topo do módulo; chamada aqui é no-op seguro
    load_dotenv()

    if not DRIVE_FOLDER_ID:
        logger.error("GOOGLE_DRIVE_FOLDER_ID não está definido no .env. Abortando.")
        return

    logger.info("Conectando ao Google Drive...")
    service = get_drive_service()

    logger.info("Listando arquivos da pasta: %s", DRIVE_FOLDER_ID)
    files = get_drive_files(service, DRIVE_FOLDER_ID)

    processable_mimes = {
        "text/plain",
        "application/vnd.google-apps.document",
    }
    processable_exts = (".txt", ".docx")

    targets = [
        f for f in files
        if f["mimeType"] in processable_mimes
        or f["name"].lower().endswith(processable_exts)
    ]

    if not targets:
        logger.warning("Nenhum arquivo processável encontrado na pasta.")
        return

    logger.info("%d arquivo(s) elegível(is) para processamento.", len(targets))

    for file_info in targets:
        try:
            process_file(service, file_info)
        except Exception as e:
            logger.error("Falha ao processar '%s': %s", file_info["name"], e)


if __name__ == "__main__":
    main()
