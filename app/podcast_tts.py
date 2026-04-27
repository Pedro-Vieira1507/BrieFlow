# podcast_tts.py
"""
Geração de áudio para o podcast usando Google Cloud Text-to-Speech.

A autenticação reutiliza o mesmo credentials.json / token.json já
configurando para o Google Drive — sem necessidade de chave extra.

Limite gratuito: 1.000.000 caracteres/mês (vozes Standard).
Documentação: https://cloud.google.com/text-to-speech/docs
"""
import os
import io
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Configuração via .env ──────────────────────────────────────────────
# Voz pt-BR disponível. Consulte a lista completa em:
# https://cloud.google.com/text-to-speech/docs/voices
TTS_LANGUAGE = os.getenv("TTS_LANGUAGE_CODE", "pt-BR")
TTS_VOICE_NAME = os.getenv("TTS_VOICE_NAME", "pt-BR-Standard-A")  # pt-BR-Standard-A/B/C/D ou pt-BR-Wavenet-A/B/C
TTS_AUDIO_ENCODING = os.getenv("TTS_AUDIO_ENCODING", "MP3")       # MP3 | LINEAR16 (wav) | OGG_OPUS
TTS_SPEAKING_RATE = float(os.getenv("TTS_SPEAKING_RATE", "0.95")) # 0.25–4.0 (1.0 = normal)
TTS_PITCH = float(os.getenv("TTS_PITCH", "0.0"))                   # -20.0–20.0 semitones

# Limite por requisição da API (~5000 bytes de byte-string, ~4800 caracteres seguros)
TTS_MAX_CHARS = int(os.getenv("TTS_MAX_CHARS", "4800"))


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
        # Parágrafo isolado maior que o limite → divide por frases
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


def _build_tts_client():
    """
    Cria o cliente Google Cloud TTS reutilizando as credenciais OAuth2
    já configuradas para o Google Drive (credentials.json / token.json).

    Requer que a API 'Cloud Text-to-Speech' esteja habilitada no Google
    Cloud Console do mesmo projeto.
    """
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google.auth.transport.grpc import AuthMetadataPlugin
    import google.auth
    import google.auth.transport.requests

    # Tenta usar as credenciais existentes do Drive
    token_path = (
        os.getenv("GOOGLE_TOKEN_PATH")
        or "credentials/token.json"
    )
    creds_path = (
        os.getenv("GOOGLE_CREDENTIALS_PATH")
        or "credentials.json"
    )

    SCOPES_TTS = [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/drive",
    ]

    creds = None
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES_TTS)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("[PodcastTTS] Renovando token Google...")
            creds.refresh(Request())
        else:
            from google_auth_oauthlib.flow import InstalledAppFlow
            logger.info("[PodcastTTS] Abrindo browser para autorização Google TTS...")
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES_TTS)
            creds = flow.run_local_server(port=0)

        os.makedirs(os.path.dirname(token_path) or ".", exist_ok=True)
        with open(token_path, "w") as f:
            f.write(creds.to_json())
        logger.info(f"[PodcastTTS] Token atualizado: {token_path}")

    # Constrói o cliente usando a biblioteca google-cloud-texttospeech
    from google.cloud import texttospeech
    from google.oauth2.credentials import Credentials as OAuthCreds

    client = texttospeech.TextToSpeechClient(credentials=creds)
    return client


def generate_podcast_audio(script: str, output_path: str) -> str:
    """
    Converte o roteiro completo do podcast em arquivo de áudio
    usando o Google Cloud Text-to-Speech (pt-BR).

    Processa o texto em chunks para respeitar o limite por requisição
    e concatena os segmentos em um único arquivo.

    Args:
        script: Texto completo do roteiro do podcast.
        output_path: Caminho de saída do arquivo de áudio (.mp3 por padrão).

    Returns:
        Caminho do arquivo de áudio gerado.

    Raises:
        google.api_core.exceptions.GoogleAPIError: Em caso de erro na API.
    """
    from google.cloud import texttospeech

    dest_dir = os.path.dirname(output_path)
    if dest_dir:
        os.makedirs(dest_dir, exist_ok=True)

    chunks = _split_into_chunks(script)
    total = len(chunks)
    logger.info(
        f"[PodcastTTS] Iniciando geração de áudio com Google TTS: "
        f"{total} chunk(s), voz='{TTS_VOICE_NAME}', língua='{TTS_LANGUAGE}'"
    )

    # Mapeia a string de encoding para o enum correto
    encoding_map = {
        "MP3":      texttospeech.AudioEncoding.MP3,
        "LINEAR16": texttospeech.AudioEncoding.LINEAR16,
        "OGG_OPUS": texttospeech.AudioEncoding.OGG_OPUS,
    }
    audio_encoding = encoding_map.get(TTS_AUDIO_ENCODING.upper(), texttospeech.AudioEncoding.MP3)

    try:
        client = _build_tts_client()
    except Exception as e:
        logger.error(f"[PodcastTTS] Falha ao criar cliente Google TTS: {e}")
        raise

    audio_parts: list[bytes] = []

    try:
        for i, chunk in enumerate(chunks, start=1):
            logger.info(
                f"[PodcastTTS] Chunk {i}/{total} ({len(chunk)} caracteres)"
            )

            synthesis_input = texttospeech.SynthesisInput(text=chunk)

            voice = texttospeech.VoiceSelectionParams(
                language_code=TTS_LANGUAGE,
                name=TTS_VOICE_NAME,
            )

            audio_config = texttospeech.AudioConfig(
                audio_encoding=audio_encoding,
                speaking_rate=TTS_SPEAKING_RATE,
                pitch=TTS_PITCH,
            )

            response = client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config,
            )

            audio_parts.append(response.audio_content)
            logger.info(f"[PodcastTTS] Chunk {i}/{total} → {len(response.audio_content)} bytes")

        # Concatena todos os segmentos e salva
        with open(output_path, "wb") as f:
            for part in audio_parts:
                f.write(part)

        size_kb = os.path.getsize(output_path) / 1024
        logger.info(
            f"[PodcastTTS] ✅ Áudio gerado: {output_path} ({size_kb:.1f} KB)"
        )
        return output_path

    except Exception as e:
        logger.error(f"[PodcastTTS] Erro na API Google TTS: {e}")
        raise
