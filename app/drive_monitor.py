# drive_monitor.py
import os
import io
import logging
from googleapiclient.http import MediaIoBaseDownload

logger = logging.getLogger(__name__)

SUPPORTED_MIME_TYPES = {
    "text/plain": ".txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.google-apps.document": ".docx",
    # Suporte a vídeo
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/webm": ".webm",
    # Suporte a áudio direto
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
}

GOOGLE_DOCS_EXPORT_MIME = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

# Tipos de mídia que precisam de transcrição antes de entrar no pipeline
MEDIA_MIME_TYPES = {
    "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm",
    "audio/mpeg", "audio/mp4", "audio/wav",
}


# ─────────────────────────────────────────────
# FUNÇÕES UTILITÁRIAS (usadas pela classe e externamente)
# ─────────────────────────────────────────────

def get_drive_files(service, folder_id: str) -> list[dict]:
    """Lista todos os arquivos suportados dentro da pasta do Google Drive."""
    try:
        results = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed=false",
                fields="files(id, name, mimeType, modifiedTime)",
                pageSize=50,
            )
            .execute()
        )
        files = results.get("files", [])
        logger.info(
            f"[Drive] {len(files)} arquivo(s) encontrado(s) na pasta {folder_id}"
        )
        return files
    except Exception as e:
        logger.error(f"[Drive] Erro ao listar arquivos: {e}")
        return []


def download_file(service, file: dict, dest_folder: str) -> str | None:
    """
    Baixa um arquivo do Google Drive para dest_folder.
    Suporta textos, documentos, vídeos e áudios.
    Retorna o caminho local do arquivo baixado, ou None em caso de erro.
    """
    file_id = file["id"]
    file_name = file["name"]
    mime_type = file["mimeType"]

    ext = SUPPORTED_MIME_TYPES.get(mime_type)
    if ext is None:
        logger.warning(
            f"[Drive] MIME type não suportado: {mime_type} — {file_name}"
        )
        return None

    os.makedirs(dest_folder, exist_ok=True)
    base_name = os.path.splitext(file_name)[0]
    dest_path = os.path.join(dest_folder, f"{base_name}{ext}")

    # Não re-baixa se já existir
    if os.path.exists(dest_path):
        logger.info(f"[Drive] Arquivo já existe localmente: {dest_path}")
        return dest_path

    try:
        if mime_type == "application/vnd.google-apps.document":
            request = service.files().export_media(
                fileId=file_id, mimeType=GOOGLE_DOCS_EXPORT_MIME
            )
        else:
            request = service.files().get_media(fileId=file_id)

        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                logger.info(
                    f"[Drive] Download {file_name}: "
                    f"{int(status.progress() * 100)}%"
                )

        with open(dest_path, "wb") as f:
            f.write(buffer.getvalue())

        logger.info(f"[Drive] ✅ Arquivo salvo: {dest_path}")
        return dest_path

    except Exception as e:
        logger.error(f"[Drive] Erro ao baixar {file_name}: {e}")
        return None


def upload_file(service, local_path: str, folder_id: str) -> str | None:
    """
    Faz upload de um arquivo local para uma pasta do Google Drive.
    Retorna o ID do arquivo criado no Drive, ou None em caso de erro.
    """
    from googleapiclient.http import MediaFileUpload
    import mimetypes

    file_name = os.path.basename(local_path)
    mime_type, _ = mimetypes.guess_type(local_path)
    mime_type = mime_type or "application/octet-stream"

    file_metadata = {"name": file_name, "parents": [folder_id]}
    media = MediaFileUpload(local_path, mimetype=mime_type, resumable=True)

    try:
        uploaded = (
            service.files()
            .create(body=file_metadata, media_body=media, fields="id, name")
            .execute()
        )
        logger.info(
            f"[Drive] ✅ Upload concluído: {file_name} (ID: {uploaded.get('id')})"
        )
        return uploaded.get("id")
    except Exception as e:
        logger.error(f"[Drive] Erro ao fazer upload de {file_name}: {e}")
        return None


# ─────────────────────────────────────────────
# CLASSE ORQUESTRADORA
# ─────────────────────────────────────────────

class DriveMonitor:
    """
    Orquestra o ciclo completo:
      1. Autentica no Google Drive
      2. Lista arquivos novos na pasta de entrada (DRIVE_INPUT_FOLDER_ID)
      3. Baixa cada arquivo para data/downloads/
      4. Se for vídeo/áudio → transcreve com Whisper
      5. Envia o texto para o pipeline de geração de assets
      6. Faz upload dos entregáveis para a pasta de saída (DRIVE_OUTPUT_FOLDER_ID)
    """

    def __init__(self):
        from dotenv import load_dotenv
        load_dotenv()

        self.input_folder_id = os.getenv("DRIVE_INPUT_FOLDER_ID", "")
        self.output_folder_id = os.getenv("DRIVE_OUTPUT_FOLDER_ID", "")
        self.download_dir = os.getenv("DOWNLOAD_DIR", "data/downloads")
        self.output_dir = os.getenv("OUTPUT_DIR", "data/output")

        if not self.input_folder_id:
            raise EnvironmentError(
                "[DriveMonitor] Variável DRIVE_INPUT_FOLDER_ID não definida no .env"
            )

        self.service = self._authenticate()
        logger.info("[DriveMonitor] Inicializado com sucesso.")

    # ------------------------------------------------------------------
    # Autenticação
    # ------------------------------------------------------------------

    def _authenticate(self):
        """
        Autentica com a conta de serviço do Google (service account).
        Espera o arquivo JSON em GOOGLE_SERVICE_ACCOUNT_FILE ou credenciais
        via GOOGLE_APPLICATION_CREDENTIALS.
        """
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        scopes = ["https://www.googleapis.com/auth/drive"]
        credentials_path = os.getenv(
            "GOOGLE_SERVICE_ACCOUNT_FILE",
            os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "credentials.json"),
        )

        if not os.path.exists(credentials_path):
            raise FileNotFoundError(
                f"[DriveMonitor] Arquivo de credenciais não encontrado: {credentials_path}\n"
                "Configure a variável GOOGLE_SERVICE_ACCOUNT_FILE no .env."
            )

        credentials = service_account.Credentials.from_service_account_file(
            credentials_path, scopes=scopes
        )
        service = build("drive", "v3", credentials=credentials)
        logger.info("[DriveMonitor] ✅ Autenticado no Google Drive.")
        return service

    # ------------------------------------------------------------------
    # Processamento
    # ------------------------------------------------------------------

    def process_new_files(self) -> None:
        """
        Ponto de entrada principal. Lista, baixa, transcreve (se necessário)
        e aciona o pipeline de geração de assets para cada arquivo.
        """
        from app.transcriber import transcribe_media
        from app.content_brief import extract_brief_from_text
        from app.generate_assets import generate_assets_for_brief

        logger.info(
            f"[DriveMonitor] Verificando pasta de entrada: {self.input_folder_id}"
        )
        files = get_drive_files(self.service, self.input_folder_id)

        if not files:
            logger.info("[DriveMonitor] Nenhum arquivo encontrado. Encerrando.")
            return

        processed = 0
        for file in files:
            try:
                result = self._process_single_file(file)
                if result:
                    processed += 1
            except Exception as e:
                logger.error(
                    f"[DriveMonitor] ❌ Erro ao processar '{file.get('name')}': {e}"
                )

        logger.info(
            f"[DriveMonitor] Concluído. {processed}/{len(files)} arquivo(s) processado(s)."
        )

    def _process_single_file(self, file: dict) -> bool:
        """
        Processa um único arquivo:
          - Baixa do Drive
          - Transcreve se for mídia
          - Extrai brief
          - Gera assets
          - Faz upload dos resultados

        Retorna True se concluído com sucesso.
        """
        from app.transcriber import transcribe_media
        from app.content_brief import extract_brief_from_text
        from app.generate_assets import generate_assets_for_brief

        file_name = file.get("name", "sem_nome")
        mime_type = file.get("mimeType", "")
        logger.info(f"[DriveMonitor] ▶ Processando: {file_name} ({mime_type})")

        # 1. Baixar arquivo
        local_path = download_file(self.service, file, self.download_dir)
        if not local_path:
            logger.warning(f"[DriveMonitor] Pulando '{file_name}' (download falhou).")
            return False

        # 2. Transcrever se for vídeo ou áudio
        if mime_type in MEDIA_MIME_TYPES:
            logger.info(f"[DriveMonitor] Transcrevendo mídia: {file_name}")
            transcript_path = transcribe_media(local_path)
            if not transcript_path:
                logger.error(
                    f"[DriveMonitor] Transcrição falhou para '{file_name}'. Pulando."
                )
                return False
            with open(transcript_path, "r", encoding="utf-8") as f:
                raw_text = f.read()
        else:
            # Texto ou DOCX — lê diretamente
            raw_text = self._read_text_file(local_path)

        if not raw_text.strip():
            logger.warning(
                f"[DriveMonitor] Conteúdo vazio em '{file_name}'. Pulando."
            )
            return False

        # 3. Extrair brief estruturado
        brief_text = extract_brief_from_text(raw_text)

        # 4. Pasta de saída por arquivo
        base_name = os.path.splitext(os.path.basename(local_path))[0]
        output_folder = os.path.join(self.output_dir, base_name)
        os.makedirs(output_folder, exist_ok=True)

        # 5. Gerar todos os assets
        results = generate_assets_for_brief(
            brief_text=brief_text,
            output_folder=output_folder,
            drive_service=self.service,
        )

        # 6. Upload dos entregáveis para o Drive (se configurado)
        if self.output_folder_id:
            self._upload_results(results)

        return True

    def _read_text_file(self, path: str) -> str:
        """Lê .txt ou .docx e retorna o texto puro."""
        if path.endswith(".docx"):
            try:
                from docx import Document
                doc = Document(path)
                return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            except Exception as e:
                logger.error(f"[DriveMonitor] Erro ao ler DOCX '{path}': {e}")
                return ""
        else:
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()
            except Exception as e:
                logger.error(f"[DriveMonitor] Erro ao ler arquivo '{path}': {e}")
                return ""

    def _upload_results(self, results: dict[str, str]) -> None:
        """Faz upload de todos os assets gerados para a pasta de saída no Drive."""
        for key, path in results.items():
            if path.startswith("ERRO") or not os.path.exists(path):
                logger.warning(
                    f"[DriveMonitor] Pulando upload de '{key}' (arquivo não encontrado ou com erro)."
                )
                continue
            drive_id = upload_file(self.service, path, self.output_folder_id)
            if drive_id:
                logger.info(
                    f"[DriveMonitor] ✅ Upload OK: {key} → Drive ID {drive_id}"
                )
            else:
                logger.warning(f"[DriveMonitor] Upload falhou para: {key}")
