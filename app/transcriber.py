# transcriber.py
import os
import logging
import subprocess
import openai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

openai.api_key = os.getenv("OPENAI_API_KEY")


def extract_audio_from_video(video_path: str) -> str:
    """
    Extrai o áudio de um vídeo (.mp4, .mov, .avi, .webm) usando ffmpeg.
    Retorna o caminho do .mp3 gerado (temporário).
    """
    audio_path = video_path.rsplit(".", 1)[0] + "_audio.mp3"
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", video_path,
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

    Args:
        file_path: Caminho local do arquivo a processar.

    Returns:
        Texto transcrito ou lido.
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
        from docx import Document
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
