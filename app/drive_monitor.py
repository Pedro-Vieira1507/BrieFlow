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
