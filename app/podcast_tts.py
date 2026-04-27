"""podcast_tts.py — Converte o roteiro de podcast (texto) em áudio MP3 via OpenAI TTS.

Pré-requisito:
  pip install openai

Variáveis de ambiente (.env):
  OPENAI_API_KEY   — chave da API OpenAI
  TTS_VOICE        — voz a usar (padrão: "alloy"). Opções: alloy, echo, fable, onyx, nova, shimmer
  TTS_MODEL        — modelo TTS (padrão: "tts-1"). Para maior qualidade: "tts-1-hd"
  TTS_SPEED        — velocidade de fala, 0.25–4.0 (padrão: 1.0)

Como funciona:
  - Textos curtos (<= 4096 chars): enviados diretamente à API.
  - Textos longos: divididos em blocos por pontuação/parágrafo e concatenados via pydub.
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
TTS_VOICE      = os.getenv("TTS_VOICE",  "alloy")
TTS_MODEL      = os.getenv("TTS_MODEL",  "tts-1")
TTS_SPEED      = float(os.getenv("TTS_SPEED", "1.0"))

MAX_CHUNK_CHARS = 4096  # limite da API OpenAI TTS por chamada


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _split_into_chunks(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """
    Divide o texto em blocos que respeitam os limites da API.
    Tenta quebrar em parágrafos ou, se necessário, em frases.
    """
    if len(text) <= max_chars:
        return [text]

    # Tenta dividir por parágrafos duplos
    paragraphs = re.split(r'\n\s*\n', text)
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 <= max_chars:
            current = (current + "\n\n" + para).strip()
        else:
            if current:
                chunks.append(current)
            # Parágrafo maior que o limite → divide por frase
            if len(para) > max_chars:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                sub = ""
                for s in sentences:
                    if len(sub) + len(s) + 1 <= max_chars:
                        sub = (sub + " " + s).strip()
                    else:
                        if sub:
                            chunks.append(sub)
                        sub = s
                if sub:
                    chunks.append(sub)
                current = ""
            else:
                current = para

    if current:
        chunks.append(current)

    return chunks


def _tts_chunk(client, text: str, voice: str, model: str, speed: float) -> bytes:
    """Gera áudio para um único bloco de texto."""
    response = client.audio.speech.create(
        model=model,
        voice=voice,
        input=text,
        speed=speed,
        response_format="mp3",
    )
    return response.content


def _concatenate_mp3(parts: list[bytes]) -> bytes:
    """
    Concatena múltiplos blobs MP3 em um único arquivo.
    Usa pydub se disponível; senão faz concatenação binária simples.
    """
    if len(parts) == 1:
        return parts[0]

    try:
        from pydub import AudioSegment
        import io

        combined = AudioSegment.empty()
        for part in parts:
            segment = AudioSegment.from_mp3(io.BytesIO(part))
            combined += segment

        out = io.BytesIO()
        combined.export(out, format="mp3")
        return out.getvalue()

    except ImportError:
        logger.warning(
            "[TTS] pydub não instalado — concatenando MP3 binariamente (pode causar artefatos). "
            "Instale pydub + ffmpeg para qualidade perfeita."
        )
        return b"".join(parts)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def podcast_txt_to_mp3(txt_path: Path | str, voice: str | None = None) -> Path:
    """
    Converte o arquivo de texto do roteiro de podcast em um arquivo MP3.

    Args:
        txt_path : caminho do .txt gerado pelo LLM (roteiro do podcast)
        voice    : voz TTS (padrão: valor de TTS_VOICE no .env ou 'alloy')

    Returns:
        caminho do .mp3 gerado

    Raises:
        ImportError  : se 'openai' não estiver instalado
        ValueError   : se OPENAI_API_KEY não estiver configurado
        RuntimeError : se a chamada à API falhar
    """
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise ImportError(
            "A biblioteca 'openai' é necessária para gerar áudio. "
            "Instale com: pip install openai"
        ) from exc

    if not OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY não configurado. Adicione ao arquivo .env."
        )

    txt_path  = Path(txt_path)
    text      = txt_path.read_text(encoding="utf-8").strip()
    voice_use = voice or TTS_VOICE

    if not text:
        raise ValueError(f"Arquivo de roteiro vazio: {txt_path}")

    logger.info(f"[TTS] Iniciando geração de áudio | voz={voice_use} modelo={TTS_MODEL}")

    client = OpenAI(api_key=OPENAI_API_KEY)
    chunks = _split_into_chunks(text)
    logger.info(f"[TTS] Texto dividido em {len(chunks)} bloco(s)")

    audio_parts: list[bytes] = []
    for idx, chunk in enumerate(chunks, 1):
        logger.info(f"[TTS] Gerando bloco {idx}/{len(chunks)} ({len(chunk)} chars)")
        try:
            audio_parts.append(_tts_chunk(client, chunk, voice_use, TTS_MODEL, TTS_SPEED))
        except Exception as exc:
            raise RuntimeError(
                f"Falha ao gerar áudio para o bloco {idx}/{len(chunks)}: {exc}"
            ) from exc

    audio_bytes = _concatenate_mp3(audio_parts)

    mp3_path = txt_path.with_suffix(".mp3")
    mp3_path.write_bytes(audio_bytes)
    logger.info(f"[OK] Podcast MP3 gerado em: {mp3_path}")
    return mp3_path
