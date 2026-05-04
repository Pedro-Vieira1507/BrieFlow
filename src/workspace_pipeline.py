import os
import re
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google import genai
from google.genai import types

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "data/output"))
INPUT_DIR = Path(os.getenv("INPUT_DIR", "data/inbox"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
SYSTEM_PROMPT_PATH = Path(os.getenv("SYSTEM_PROMPT_PATH", "prompts/system_prompt.txt"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)


def get_drive_service():
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
                flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
                creds = flow.run_local_server(port=0)

            token_path.parent.mkdir(parents=True, exist_ok=True)
            token_path.write_text(creds.to_json(), encoding="utf-8")

        return build("drive", "v3", credentials=creds)
    except Exception as e:
        logger.exception("Falha ao autenticar no Google Drive")
        raise RuntimeError(f"Erro de autenticação no Google Drive: {e}")


def get_drive_files(service, folder_id: str) -> List[Dict]:
    if not folder_id:
        raise ValueError("GOOGLE_DRIVE_FOLDER_ID não definido.")

    try:
        query = f"'{folder_id}' in parents and trashed = false"
        fields = "files(id,name,mimeType,createdTime,webViewLink,capabilities(canDownload))"

        result = service.files().list(
            q=query,
            fields=fields,
            pageSize=100,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
        ).execute()

        files = result.get("files", [])
        logger.info("Encontrados %s arquivos no Drive.", len(files))
        return files
    except Exception as e:
        logger.exception("Falha ao listar arquivos do Drive")
        raise RuntimeError(f"Erro ao listar arquivos do Drive: {e}")


def download_drive_file(service, file_id: str, file_name: str, mime_type: str) -> Path:
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r'[<>:"/\\\\|?*]', "_", file_name).strip()

    try:
        if mime_type == "application/vnd.google-apps.document":
            request = service.files().export_media(fileId=file_id, mimeType="text/plain")
            out_path = INPUT_DIR / f"{Path(safe_name).stem}.txt"
        else:
            request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
            out_path = INPUT_DIR / safe_name

        with open(out_path, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()

        logger.info("Arquivo salvo em %s", out_path)
        return out_path
    except Exception as e:
        logger.exception("Falha ao baixar/exportar arquivo")
        raise RuntimeError(f"Erro ao baixar/exportar arquivo: {e}")


def load_system_prompt() -> str:
    if SYSTEM_PROMPT_PATH.exists():
        return SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    return """Você é um assistente especializado em marketing e conteúdo."""


def call_llm_api(transcription_text: str, system_prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY não definido no .env")

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f"""
{system_prompt}

TRANSCRIÇÃO:
{transcription_text}
""".strip()

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=types.Part.from_text(text=prompt),
            config=types.GenerateContentConfig(
                temperature=0.4,
            ),
        )

        text = (response.text or "").strip()
        if not text:
            raise RuntimeError("A API do LLM retornou resposta vazia.")

        logger.info("Resposta do LLM recebida com sucesso.")
        return text
    except Exception as e:
        logger.exception("Falha ao chamar a API do LLM")
        raise RuntimeError(f"Erro na chamada ao LLM: {e}")


def parse_content(raw_text: str) -> Dict[str, str]:
    patterns = [
        r"(MATERIAL\s*1.*?)(?=\nMATERIAL\s*2|\Z)",
        r"(MATERIAL\s*2.*?)(?=\nMATERIAL\s*3|\Z)",
        r"(MATERIAL\s*3.*?)(?=\nMATERIAL\s*4|\Z)",
        r"(MATERIAL\s*4.*?)(?=\nMATERIAL\s*5|\Z)",
        r"(MATERIAL\s*5.*?)(?=\nMATERIAL\s*6|\Z)",
        r"(MATERIAL\s*6.*?)(?=\nMATERIAL\s*7|\Z)",
        r"(MATERIAL\s*7.*?)(?=\nMATERIAL\s*8|\Z)",
        r"(MATERIAL\s*8.*?)(?=\Z)",
    ]

    materials = {}
    for i, pattern in enumerate(patterns, start=1):
        match = re.search(pattern, raw_text, flags=re.IGNORECASE | re.DOTALL)
        materials[f"material_{i}"] = match.group(1).strip() if match else ""

    return materials


def save_to_output(materials: Dict[str, str], source_name: str) -> Path:
    output_dir = OUTPUT_DIR / Path(source_name).stem
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        manifest = {
            "source": source_name,
            "materials": list(materials.keys()),
        }

        for key, content in materials.items():
            file_path = output_dir / f"{key}.txt"
            file_path.write_text(content.strip() + "\n", encoding="utf-8")

        manifest_path = output_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

        logger.info("Materiais salvos em %s", output_dir)
        return output_dir
    except Exception as e:
        logger.exception("Falha ao salvar materiais")
        raise RuntimeError(f"Erro ao salvar materiais: {e}")


def process_file(service, file_info: Dict):
    file_id = file_info["id"]
    name = file_info["name"]
    mime_type = file_info["mimeType"]

    logger.info("Processando: %s", name)
    local_path = download_drive_file(service, file_id, name, mime_type)
    transcription_text = local_path.read_text(encoding="utf-8")

    system_prompt = load_system_prompt()
    raw_output = call_llm_api(transcription_text, system_prompt)
    materials = parse_content(raw_output)
    save_to_output(materials, name)


def main():
    load_dotenv()
    service = get_drive_service()
    files = get_drive_files(service, DRIVE_FOLDER_ID)

    for file_info in files:
        if file_info["mimeType"] in [
            "text/plain",
            "application/vnd.google-apps.document",
        ] or file_info["name"].lower().endswith((".txt", ".docx")):
            try:
                process_file(service, file_info)
            except Exception as e:
                logger.error("Falha ao processar %s: %s", file_info["name"], e)


if __name__ == "__main__":
    main()