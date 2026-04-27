import io
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from app.utils import ensure_dir, load_json, save_json

load_dotenv()

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive"]

# Tipos nativos do Google exportados para formatos open
GOOGLE_EXPORT_MAP = {
    "application/vnd.google-apps.document":     ("text/plain",   ".txt"),
    "application/vnd.google-apps.spreadsheet":  ("text/csv",     ".csv"),
    "application/vnd.google-apps.presentation": ("application/pdf", ".pdf"),
}

# Tipos binários que devem ser baixados diretamente (incluindo vídeos)
BINARY_DOWNLOAD_MIMES = {
    # Texto / documentos
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # Áudio
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    # Vídeo — todos os formatos comuns
    "video/mp4",
    "video/quicktime",       # .mov
    "video/x-msvideo",      # .avi
    "video/x-matroska",     # .mkv
    "video/webm",
    "video/mpeg",
    "video/3gpp",
    "video/x-ms-wmv",
    # Imagens
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

# MIME types de vídeo para identificar arquivos que precisam de transcrição
VIDEO_MIMES = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
    "video/mpeg",
    "video/3gpp",
    "video/x-ms-wmv",
}


class DriveMonitor:
    def __init__(self):
        self.folder_id         = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
        self.token_path        = "credentials/token.json"
        self.creds_path        = "credentials/credentials.json"
        self.inbox_dir         = "data/inbox"
        self.processed_dir     = "data/processed"
        self.processed_db_path = "data/processed_files.json"

        ensure_dir(self.inbox_dir)
        ensure_dir(self.processed_dir)

        if not os.path.exists(self.processed_db_path):
            save_json(self.processed_db_path, {"files": []})

        self.service = self._build_service()

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    def _build_service(self):
        creds = None
        if os.path.exists(self.token_path):
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow  = InstalledAppFlow.from_client_secrets_file(self.creds_path, SCOPES)
                creds = flow.run_local_server(port=0)
            with open(self.token_path, "w", encoding="utf-8") as token:
                token.write(creds.to_json())
        return build("drive", "v3", credentials=creds)

    # ------------------------------------------------------------------
    # Drive listing
    # ------------------------------------------------------------------

    def list_folder_files(self, folder_id: str | None = None):
        fid   = folder_id or self.folder_id
        query = f"'{fid}' in parents and trashed = false"
        fields = (
            "files("
            "id,name,mimeType,createdTime,webViewLink,"
            "size,capabilities(canDownload)"
            ")"
        )
        results = self.service.files().list(
            q=query,
            pageSize=200,
            fields=fields,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            orderBy="createdTime desc",
        ).execute()
        return results.get("files", [])

    # ------------------------------------------------------------------
    # Processed DB
    # ------------------------------------------------------------------

    def load_processed_ids(self) -> set[str]:
        data = load_json(self.processed_db_path, {"files": []})
        return {item["id"] for item in data.get("files", [])}

    def mark_as_processed_with_status(self, file_id: str, status: str, extra: dict | None = None):
        data  = load_json(self.processed_db_path, {"files": []})
        files = data.get("files", [])
        record = {"id": file_id, "status": status}
        if extra:
            record.update(extra)
        files  = [f for f in files if f.get("id") != file_id]
        files.append(record)
        save_json(self.processed_db_path, {"files": files})

    def save_processed_id(self, file_id: str):
        self.mark_as_processed_with_status(file_id, "processed")

    # ------------------------------------------------------------------
    # File name sanitizer
    # ------------------------------------------------------------------

    def sanitize_filename(self, name: str) -> str:
        for ch in '<>:"/\\|?*':
            name = name.replace(ch, "_")
        return name.strip()

    # ------------------------------------------------------------------
    # Downloaders
    # ------------------------------------------------------------------

    def download_binary_file(self, file_id: str, file_name: str) -> str:
        request = self.service.files().get_media(
            fileId=file_id, supportsAllDrives=True
        )
        safe_name   = self.sanitize_filename(file_name)
        output_path = os.path.join(self.inbox_dir, safe_name)
        with io.FileIO(output_path, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
                if status:
                    pct = int(status.progress() * 100)
                    logger.debug(f"[Download] {file_name}: {pct}%%")
        return output_path

    def export_google_file(self, file_id: str, file_name: str, mime_type: str, ext: str) -> str:
        request = self.service.files().export_media(
            fileId=file_id, mimeType=mime_type
        )
        base_name   = Path(self.sanitize_filename(file_name)).stem
        output_path = os.path.join(self.inbox_dir, f"{base_name}{ext}")
        with io.FileIO(output_path, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        return output_path

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    def process_new_files(self) -> list[dict]:
        """
        Varre a pasta do Drive e baixa arquivos novos.
        Retorna lista de dicts com informações dos arquivos processados.

        Para vídeos (VIDEO_MIMES), o campo 'needs_transcription' é True,
        sinalizando ao pipeline que o arquivo precisa passar pelo Whisper.
        """
        if not self.folder_id:
            raise ValueError("GOOGLE_DRIVE_FOLDER_ID não definido no .env")

        files         = self.list_folder_files()
        processed_ids = self.load_processed_ids()
        results: list[dict] = []

        if not files:
            logger.info("Nenhum arquivo encontrado na pasta monitorada.")
            return results

        for item in files:
            file_id      = item["id"]
            file_name    = item["name"]
            mime_type    = item["mimeType"]
            can_download = item.get("capabilities", {}).get("canDownload", True)
            web_link     = item.get("webViewLink", "")
            file_size    = int(item.get("size", 0) or 0)

            if file_id in processed_ids:
                logger.debug(f"[IGNORADO] Já processado: {file_name}")
                continue

            logger.info(f"[NOVO] {file_name} | {mime_type} | {file_size / 1024:.1f} KB")

            try:
                # ── Google Workspace → export
                if mime_type in GOOGLE_EXPORT_MAP:
                    export_mime, ext = GOOGLE_EXPORT_MAP[mime_type]
                    output_path = self.export_google_file(file_id, file_name, export_mime, ext)
                    logger.info(f"[EXPORTADO] {output_path}")
                    meta = {
                        "name":              file_name,
                        "mimeType":          mime_type,
                        "output_path":       output_path,
                        "needs_transcription": False,
                    }
                    self.mark_as_processed_with_status(file_id, "processed", meta)
                    results.append({"file_id": file_id, **meta})

                # ── Binários conhecidos (incluindo vídeos)
                elif mime_type in BINARY_DOWNLOAD_MIMES:
                    if not can_download:
                        logger.warning(f"[BLOQUEADO] {file_name}: canDownload=false")
                        self.mark_as_processed_with_status(
                            file_id, "blocked",
                            {"name": file_name, "mimeType": mime_type,
                             "reason": "capabilities.canDownload = false", "webViewLink": web_link},
                        )
                        continue

                    output_path          = self.download_binary_file(file_id, file_name)
                    is_video             = mime_type in VIDEO_MIMES
                    logger.info(f"[BAIXADO]{' [VÍDEO]' if is_video else ''} {output_path}")

                    meta = {
                        "name":              file_name,
                        "mimeType":          mime_type,
                        "output_path":       output_path,
                        "needs_transcription": is_video,
                    }
                    self.mark_as_processed_with_status(file_id, "processed", meta)
                    results.append({"file_id": file_id, **meta})

                # ── Tipo desconhecido — tenta download binário genérico
                else:
                    if not can_download:
                        logger.warning(f"[BLOQUEADO] {file_name}: tipo desconhecido e canDownload=false")
                        self.mark_as_processed_with_status(
                            file_id, "blocked",
                            {"name": file_name, "mimeType": mime_type,
                             "reason": "tipo desconhecido + canDownload=false", "webViewLink": web_link},
                        )
                        continue

                    output_path = self.download_binary_file(file_id, file_name)
                    logger.info(f"[BAIXADO genérico] {output_path}")
                    meta = {
                        "name":              file_name,
                        "mimeType":          mime_type,
                        "output_path":       output_path,
                        "needs_transcription": False,
                    }
                    self.mark_as_processed_with_status(file_id, "processed", meta)
                    results.append({"file_id": file_id, **meta})

            except Exception as exc:
                logger.error(f"[ERRO] {file_name}: {exc}")
                self.mark_as_processed_with_status(
                    file_id, "error",
                    {"name": file_name, "mimeType": mime_type,
                     "reason": str(exc), "webViewLink": web_link},
                )

        return results
