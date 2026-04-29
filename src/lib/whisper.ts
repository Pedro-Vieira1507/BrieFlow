// Whisper transcription via OpenAI API
import { getOpenAIKey } from "./aiConfig";

export type WhisperResult = {
  text: string;
  language?: string;
  duration?: number;
};

export type WhisperProgress =
  | { stage: "compressing" }
  | { stage: "uploading"; percent: number }
  | { stage: "transcribing" }
  | { stage: "done" };

const MAX_WHISPER_BYTES = 25 * 1024 * 1024; // 25 MB OpenAI limit

/**
 * Transcribes an audio/video File using OpenAI Whisper API.
 * Calls onProgress with status updates.
 */
export async function transcribeFile(
  file: File,
  onProgress?: (p: WhisperProgress) => void,
): Promise<WhisperResult> {
  const key = getOpenAIKey();
  if (!key) {
    throw new Error(
      "Chave OpenAI não configurada. Acesse Configurações e insira sua sk-…",
    );
  }

  // Warn if file exceeds Whisper limit
  if (file.size > MAX_WHISPER_BYTES) {
    throw new Error(
      `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
        `O limite do Whisper é 25 MB. Comprima o vídeo ou extraia apenas o áudio antes de enviar.`,
    );
  }

  onProgress?.({ stage: "uploading", percent: 0 });

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("model", "whisper-1");
  form.append("language", "pt"); // hint: Portuguese
  form.append("response_format", "verbose_json");

  onProgress?.({ stage: "transcribing" });

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Whisper API error ${res.status}: ${
        (err as { error?: { message?: string } }).error?.message ?? res.statusText
      }`,
    );
  }

  const data = (await res.json()) as {
    text: string;
    language?: string;
    duration?: number;
  };

  onProgress?.({ stage: "done" });

  return {
    text: data.text,
    language: data.language,
    duration: data.duration,
  };
}

/** Returns true if the file type is accepted by Whisper */
export function isTranscribable(file: File): boolean {
  const transcribable = [
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "audio/ogg",
  ];
  if (transcribable.includes(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp3", "mp4", "wav", "m4a", "webm", "mov", "ogg"].includes(ext);
}
