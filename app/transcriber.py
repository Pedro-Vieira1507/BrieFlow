# transcriber.py
import io
import os
import logging
import subprocess
import openai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

openai.api_key = os.getenv("OPENAI_API_KEY")

# Pasta local onde vídeos do Drive são baixados antes da transcrição
VIDEO_DOWNLOAD_DIR = os.getenv("VIDEO_DOWNLOAD_DIR", "data/videos")

# MIME types de vídeo suportados para download do Drive
VIDEO_MIME_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
}


def _get_ffmpeg_binary() -> str:
    """
    Resolve o binário do ffmpeg com a seguinte prioridade:
      1. Variável de ambiente FFMPEG_PATH (path completo)
      2. imageio-ffmpeg (binário embutido — dispensa instalação manual no Windows)
      3. 'ffmpeg' no PATH do sistema
    Levanta RuntimeError se nenhuma das opções estiver disponível.

    NOTA: imageio-ffmpeg tem prioridade sobre o PATH do sistema porque no Windows
    o subprocess.run(["ffmpeg", ...]) lança OSError/WinError 2 quando ffmpeg não
    está instalado, o que encerrava o processo antes de tentar o fallback.
    """
    # 1. Variável de ambiente explicitada pelo usuário
    env_path = os.getenv("FFMPEG_PATH")
    if env_path and os.path.isfile(env_path):
        logger.debug(f"[Transcriber] ffmpeg via FFMPEG_PATH: {env_path}")
        return env_path

    # 2. imageio-ffmpeg (binário embutido no pacote Python)
    #    Tem prioridade sobre o PATH para evitar WinError 2 no Windows.
    try:
        import imageio_ffmpeg
        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        if ffmpeg_path and os.path.isfile(ffmpeg_path):
            logger.info(
                f"[Transcriber] ffmpeg via imageio-ffmpeg: {ffmpeg_path}"
            )
            return ffmpeg_path
    except Exception as exc:
        logger.debug(f"[Transcriber] imageio-ffmpeg não disponível: {exc}")

    # 3. ffmpeg nativo no PATH do sistema
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=5,
        )
        if result.returncode == 0:
            logger.debug("[Transcriber] ffmpeg encontrado no PATH do sistema.")
            return "ffmpeg"
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        # FileNotFoundError e OSError cobrem WinError 2 no Windows
        pass

    raise RuntimeError(
        "[Transcriber] ffmpeg não encontrado.\n"
        "Para corrigir, execute UM dos comandos abaixo:\n\n"
        "  Opção 1 (recomendada — sem instalação manual):\n"
        "    pip install imageio-ffmpeg\n\n"
        "  Opção 2 (instalar ffmpeg no sistema):\n"
        "    Windows: winget install ffmpeg   ou   choco install ffmpeg\n"
        "    macOS  : brew install ffmpeg\n"
        "    Linux  : sudo apt install ffmpeg\n\n"
        "  Opção 3 (path manual no .env):\n"
        "    FFMPEG_PATH=C:/caminho/para/ffmpeg.exe"
    )


def extract_audio_from_video(video_path: str) -> str:
    """
    Extrai o áudio de um vídeo (.mp4, .mov, .avi, .webm) usando ffmpeg.
    Usa imageio-ffmpeg automaticamente se o ffmpeg não estiver no PATH.
    Retorna o caminho do .mp3 gerado (temporário).
    """
    ffmpeg_bin = _get_ffmpeg_binary()
    audio_path = video_path.rsplit(".", 1)[0] + "_audio.mp3"
    try:
        subprocess.run(
            [
                ffmpeg_bin, "-y", "-i", video_path,
                "-vn", "-ar", "16000", "-ac", "1",
                "-b:a", "64k", audio_path,
            ],
            check=True,
            capture_output=True,
        )
        logger.info(f"[Transcriber] Áudio extraído: {audio_path}")
        return audio_path
    except subprocess.CalledProcessError as e:
        logger.error(
            f"[Transcriber] Erro ao extrair áudio com ffmpeg: "
            f"{e.stderr.decode(errors='replace')}"
        )
        raise


def transcribe_audio(audio_path: str) -> str:
    """
    Transcreve um arquivo de áudio usando Whisper (OpenAI API).
    Retorna o texto transcrito em português.
    """
    try:
        with open(audio_path, "rb") as f:
            logger.info(f"[Transcriber] Transcrevendo: {audio_path}")
            response = openai.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language="pt",
                response_format="text",
            )
        logger.info(
            f"[Transcriber] ✅ Transcrição concluída ({len(response)} caracteres)"
        )
        return response
    except openai.APIError as e:
        logger.error(f"[Transcriber] Erro na API Whisper: {e}")
        raise


def transcribe_video(video_path: str) -> str:
    """
    Pipeline completo: vídeo → extração de áudio → transcrição Whisper.
    Remove o arquivo de áudio temporário após a transcrição.
    """
    audio_path = extract_audio_from_video(video_path)
    try:
        transcript = transcribe_audio(audio_path)
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)
            logger.info(f"[Transcriber] Áudio temporário removido: {audio_path}")
    return transcript


def read_or_transcribe(file_path: str) -> str:
    """
    Entry point unificado do pipeline:
    - .mp4 / .mov / .avi / .webm  → extrai áudio + Whisper
    - .mp3 / .wav / .m4a / .ogg   → Whisper direto
    - .txt                         → leitura direta
    - .docx                        → extração de texto com python-docx
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext in (".mp4", ".mov", ".avi", ".webm"):
        logger.info(
            f"[Transcriber] Detectado vídeo — iniciando pipeline completo: {file_path}"
        )
        return transcribe_video(file_path)

    if ext in (".mp3", ".wav", ".m4a", ".ogg"):
        logger.info(f"[Transcriber] Detectado áudio — transcrevendo: {file_path}")
        return transcribe_audio(file_path)

    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        logger.info(
            f"[Transcriber] Texto lido: {file_path} ({len(content)} caracteres)"
        )
        return content

    if ext == ".docx":
        try:
            from docx import Document
        except ImportError:
            raise ImportError(
                "[Transcriber] python-docx não instalado. "
                "Execute: pip install python-docx"
            )
        doc = Document(file_path)
        content = "\n".join(
            p.text for p in doc.paragraphs if p.text.strip()
        )
        logger.info(
            f"[Transcriber] DOCX lido: {file_path} ({len(content)} caracteres)"
        )
        return content

    raise ValueError(
        f"[Transcriber] Formato de arquivo não suportado: {ext}. "
        f"Formatos aceitos: .mp4, .mov, .avi, .webm, .mp3, .wav, .m4a, .ogg, .txt, .docx"
    )


def transcribe_media(file_path: str) -> str | None:
    """
    Alias público de read_or_transcribe — mantém compatibilidade com
    drive_monitor.py e outros módulos que importam este nome.

    Processa qualquer arquivo de mídia ou texto suportado e retorna
    o caminho do arquivo .txt com a transcrição salva ao lado do original.
    Retorna None em caso de erro.
    """
    try:
        text = read_or_transcribe(file_path)

        # Salva a transcrição em um .txt ao lado do arquivo original
        base = os.path.splitext(file_path)[0]
        transcript_path = f"{base}_transcricao.txt"
        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(text)
        logger.info(f"[Transcriber] ✅ Transcrição salva: {transcript_path}")
        return transcript_path

    except Exception as e:
        logger.error(f"[Transcriber] Erro em transcribe_media('{file_path}'): {e}")
        return None


def download_and_transcribe_from_drive(
    service,
    folder_id: str,
    dest_folder: str = VIDEO_DOWNLOAD_DIR,
) -> list[dict]:
    """
    Busca todos os arquivos de vídeo/áudio na pasta do Google Drive,
    baixa localmente e transcreve cada um via Whisper.
    """
    from googleapiclient.http import MediaIoBaseDownload

    SUPPORTED = {
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/x-msvideo": ".avi",
        "video/webm": ".webm",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a",
        "audio/wav": ".wav",
    }

    os.makedirs(dest_folder, exist_ok=True)
    results = []

    try:
        resp = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed=false",
                fields="files(id, name, mimeType)",
                pageSize=50,
            )
            .execute()
        )
        files = resp.get("files", [])
        logger.info(
            f"[Transcriber] {len(files)} arquivo(s) na pasta Drive {folder_id}"
        )
    except Exception as e:
        logger.error(f"[Transcriber] Erro ao listar pasta Drive: {e}")
        return []

    for file in files:
        mime = file["mimeType"]
        ext = SUPPORTED.get(mime)
        if not ext:
            logger.debug(
                f"[Transcriber] Ignorando {file['name']} (mime: {mime})"
            )
            continue

        base = os.path.splitext(file["name"])[0]
        local_path = os.path.join(dest_folder, f"{base}{ext}")
        transcript_path = os.path.join(dest_folder, f"{base}_transcricao.txt")

        # Reutiliza transcrição existente
        if os.path.exists(transcript_path):
            logger.info(
                f"[Transcriber] Transcrição já existe: {transcript_path}"
            )
            with open(transcript_path, "r", encoding="utf-8") as tf:
                transcript = tf.read()
            results.append({
                "file_name": file["name"],
                "local_path": local_path,
                "transcript": transcript,
                "transcript_path": transcript_path,
            })
            continue

        # Download do arquivo
        if not os.path.exists(local_path):
            try:
                logger.info(
                    f"[Transcriber] Baixando do Drive: {file['name']}"
                )
                request = service.files().get_media(fileId=file["id"])
                buf = io.BytesIO()
                downloader = MediaIoBaseDownload(buf, request)
                done = False
                while not done:
                    status, done = downloader.next_chunk()
                    if status:
                        logger.info(
                            f"[Transcriber] Progresso {file['name']}: "
                            f"{int(status.progress() * 100)}%"
                        )
                with open(local_path, "wb") as vf:
                    vf.write(buf.getvalue())
                logger.info(f"[Transcriber] ✅ Salvo: {local_path}")
            except Exception as e:
                logger.error(
                    f"[Transcriber] Erro ao baixar {file['name']}: {e}"
                )
                results.append({
                    "file_name": file["name"],
                    "local_path": None,
                    "transcript": None,
                    "transcript_path": None,
                })
                continue

        # Transcrição
        try:
            transcript = read_or_transcribe(local_path)
            with open(transcript_path, "w", encoding="utf-8") as tf:
                tf.write(transcript)
            logger.info(
                f"[Transcriber] ✅ Transcrição salva: {transcript_path}"
            )
            results.append({
                "file_name": file["name"],
                "local_path": local_path,
                "transcript": transcript,
                "transcript_path": transcript_path,
            })
        except Exception as e:
            logger.error(
                f"[Transcriber] Erro ao transcrever {file['name']}: {e}"
            )
            results.append({
                "file_name": file["name"],
                "local_path": local_path,
                "transcript": None,
                "transcript_path": None,
            })

    return results
