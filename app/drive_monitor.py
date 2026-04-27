import io
import os
from pathlib import Path

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from app.utils import ensure_dir, load_json, save_json

SCOPES = ["https://www.googleapis.com/auth/drive"]

GOOGLE_EXPORT_MAP = {
    "application/vnd.google-apps.document": ("text/plain", ".txt"),
    "application/vnd.google-apps.spreadsheet": ("text/csv", ".csv"),
    "application/vnd.google-apps.presentation": ("application/pdf", ".pdf"),
}


class DriveMonitor:
    def __init__(self):
        load_dotenv()

        self.folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
        self.token_path = "credentials/token.json"
        self.creds_path = "credentials/credentials.json"
        self.inbox_dir = "data/inbox"
        self.processed_dir = "data/processed"
        self.processed_db_path = "data/processed_files.json"

        ensure_dir(self.inbox_dir)
        ensure_dir(self.processed_dir)

        if not os.path.exists(self.processed_db_path):
            save_json(self.processed_db_path, {"files": []})

        self.service = self._build_service()

    def _build_service(self):
        creds = None

        if os.path.exists(self.token_path):
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.creds_path, SCOPES
                )
                creds = flow.run_local_server(port=0)

            with open(self.token_path, "w", encoding="utf-8") as token:
                token.write(creds.to_json())

        return build("drive", "v3", credentials=creds)

    def list_folder_files(self):
        query = f"'{self.folder_id}' in parents and trashed = false"

        fields = (
            "files("
            "id,"
            "name,"
            "mimeType,"
            "createdTime,"
            "webViewLink,"
            "capabilities(canDownload)"
            ")"
        )

        results = self.service.files().list(
            q=query,
            pageSize=100,
            fields=fields,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
        ).execute()

        return results.get("files", [])

    def load_processed_ids(self):
        data = load_json(self.processed_db_path, {"files": []})
        return {item["id"] for item in data.get("files", [])}

    def mark_as_processed_with_status(self, file_id: str, status: str, extra=None):
        data = load_json(self.processed_db_path, {"files": []})
        files = data.get("files", [])

        record = {
            "id": file_id,
            "status": status,
        }

        if extra:
            record.update(extra)

        files = [f for f in files if f.get("id") != file_id]
        files.append(record)

        save_json(self.processed_db_path, {"files": files})

    def save_processed_id(self, file_id: str):
        self.mark_as_processed_with_status(file_id, "processed")

    def sanitize_filename(self, name: str):
        invalid_chars = '<>:"/\\|?*'
        for ch in invalid_chars:
            name = name.replace(ch, "_")
        return name.strip()

    def download_binary_file(self, file_id: str, file_name: str):
        request = self.service.files().get_media(
            fileId=file_id,
            supportsAllDrives=True,
        )

        safe_name = self.sanitize_filename(file_name)
        output_path = os.path.join(self.inbox_dir, safe_name)

        with io.FileIO(output_path, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()

        return output_path

    def export_google_file(self, file_id: str, file_name: str, mime_type: str, ext: str):
        request = self.service.files().export_media(
            fileId=file_id,
            mimeType=mime_type,
        )

        base_name = Path(self.sanitize_filename(file_name)).stem
        output_path = os.path.join(self.inbox_dir, f"{base_name}{ext}")

        with io.FileIO(output_path, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()

        return output_path

    def process_new_files(self):
        if not self.folder_id:
            raise ValueError("GOOGLE_DRIVE_FOLDER_ID não definido no .env")

        files = self.list_folder_files()
        processed_ids = self.load_processed_ids()

        if not files:
            print("Nenhum arquivo encontrado na pasta monitorada.")
            return

        for item in files:
            file_id = item["id"]
            file_name = item["name"]
            mime_type = item["mimeType"]
            can_download = item.get("capabilities", {}).get("canDownload", True)
            web_view_link = item.get("webViewLink", "")

            if file_id in processed_ids:
                print(f"[IGNORADO] Já processado: {file_name}")
                continue

            print(f"[NOVO] {file_name} | {mime_type}")

            try:
                if mime_type in GOOGLE_EXPORT_MAP:
                    export_mime, ext = GOOGLE_EXPORT_MAP[mime_type]
                    output_path = self.export_google_file(
                        file_id, file_name, export_mime, ext
                    )
                    print(f"[EXPORTADO] {output_path}")
                    self.mark_as_processed_with_status(
                        file_id,
                        "processed",
                        {
                            "name": file_name,
                            "mimeType": mime_type,
                            "output_path": output_path,
                        },
                    )
                    print(f"[OK] Marcado como processado: {file_id}")

                else:
                    if not can_download:
                        print(f"[BLOQUEADO] Download não permitido: {file_name}")
                        print(f"[LINK] {web_view_link}")
                        self.mark_as_processed_with_status(
                            file_id,
                            "blocked",
                            {
                                "name": file_name,
                                "mimeType": mime_type,
                                "reason": "capabilities.canDownload = false",
                                "webViewLink": web_view_link,
                            },
                        )
                        continue

                    output_path = self.download_binary_file(file_id, file_name)
                    print(f"[BAIXADO] {output_path}")
                    self.mark_as_processed_with_status(
                        file_id,
                        "processed",
                        {
                            "name": file_name,
                            "mimeType": mime_type,
                            "output_path": output_path,
                        },
                    )
                    print(f"[OK] Marcado como processado: {file_id}")

            except Exception as e:
                print(f"[ERRO] {file_name}: {e}")
                self.mark_as_processed_with_status(
                    file_id,
                    "error",
                    {
                        "name": file_name,
                        "mimeType": mime_type,
                        "reason": str(e),
                        "webViewLink": web_view_link,
                    },
                )