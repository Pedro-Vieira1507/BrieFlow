# podcast_tts.py
import os
import logging
import openai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

openai.api_key = os.getenv("OPENAI_API_KEY")

# Modelo e voz configuráveis via .env
TTS_MODEL = os.getenv("TTS_MODEL", "tts-1-hd")
TTS_VOICE = os.getenv("TTS_VOICE", "nova")  # nova | alloy | echo | fable | onyx | shimmer
TTS_MAX_CHARS = 4096  # Limite por requisição da API OpenAI TTS


def _split_into_chunks(text: str, max_chars: int = TTS_MAX_CHARS) -> list[str]:
    """
    Divide o roteiro em chunks respeitando quebras de parágrafo.
    Garante que cada chunk não ultrapasse max_chars caracteres.
    """
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        # Se o parágrafo sozinho já excede o limite, divide por frases
        if len(para) > max_chars:
            sentences = para.replace(". ", ".\n").split("\n")
            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue
                if len(current) + len(sentence) + 1 <= max_chars:
                    current += (" " if current else "") + sentence
                else:
                    if current:
                        chunks.append(current)
                    current = sentence
        elif len(current) + len(para) + 2 <= max_chars:
            current += ("\n\n" if current else "") + para
        else:
            if current:
                chunks.append(current)
            current = para

    if current:
        chunks.append(current)

    return chunks


def generate_podcast_audio(script: str, output_path: str) -> str:
    """
    Converte o roteiro completo do podcast em arquivo .mp3
    usando a API de Text-to-Speech da OpenAI.

    Processa o texto em chunks para respeitar o limite de 4096 caracteres
    por requisição e concatena os segmentos em um único arquivo de áudio.

    Args:
        script: Texto completo do roteiro do podcast.
        output_path: Caminho de saída do arquivo .mp3.

    Returns:
        Caminho do arquivo .mp3 gerado.

    Raises:
        openai.APIError: Em caso de erro na API OpenAI TTS.
    """
    dest_dir = os.path.dirname(output_path)
    if dest_dir:
        os.makedirs(dest_dir, exist_ok=True)

    chunks = _split_into_chunks(script)
    total = len(chunks)
    logger.info(
        f"[PodcastTTS] Iniciando geração de áudio: {total} chunk(s), "
        f"voz='{TTS_VOICE}', modelo='{TTS_MODEL}'"
    )

    audio_parts: list[bytes] = []

    try:
        for i, chunk in enumerate(chunks, start=1):
            logger.info(
                f"[PodcastTTS] Chunk {i}/{total} ({len(chunk)} caracteres)"
            )
            response = openai.audio.speech.create(
                model=TTS_MODEL,
                voice=TTS_VOICE,
                input=chunk,
            )
            audio_parts.append(response.content)

        # Concatena todos os segmentos e salva como .mp3
        with open(output_path, "wb") as f:
            for part in audio_parts:
                f.write(part)

        size_kb = os.path.getsize(output_path) / 1024
        logger.info(
            f"[PodcastTTS] ✅ Áudio gerado: {output_path} ({size_kb:.1f} KB)"
        )
        return output_path

    except openai.APIError as e:
        logger.error(f"[PodcastTTS] Erro na API OpenAI TTS: {e}")
        raise
    except IOError as e:
        logger.error(f"[PodcastTTS] Erro ao salvar arquivo de áudio: {e}")
        raise
