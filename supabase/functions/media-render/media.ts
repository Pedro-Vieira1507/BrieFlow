export type MediaMaterial = "reel" | "video" | "podcast";
export type MediaProvider = "gemini" | "runway";

export interface ProviderTask {
  provider: MediaProvider;
  id: string;
}

export interface GeminiMediaOutput {
  type?: string;
  data?: string;
  uri?: string;
  mime_type?: string;
  mimeType?: string;
}

interface GeminiStep {
  type?: string;
  content?: GeminiMediaOutput[];
}

export interface GeminiInteraction {
  id?: string;
  status?: string;
  error?: unknown;
  output_audio?: GeminiMediaOutput;
  output_video?: GeminiMediaOutput;
  steps?: GeminiStep[];
}

export function encodeTaskHandle(task: ProviderTask): string {
  return `${task.provider}:${task.id}`;
}

export function decodeTaskHandle(value: string): ProviderTask | null {
  const separator = value.indexOf(":");
  if (separator === -1) {
    // Handles issued before the Gemini migration were always Runway task IDs.
    return value ? { provider: "runway", id: value } : null;
  }

  const provider = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if ((provider !== "gemini" && provider !== "runway") || !id) return null;
  return { provider, id };
}

export function findGeminiMediaOutput(
  interaction: GeminiInteraction,
  kind: "audio" | "video",
): GeminiMediaOutput | null {
  const convenience =
    kind === "audio" ? interaction.output_audio : interaction.output_video;
  if (convenience?.data || convenience?.uri) return convenience;

  for (const step of [...(interaction.steps ?? [])].reverse()) {
    for (const item of [...(step.content ?? [])].reverse()) {
      if (item.type === kind && (item.data || item.uri)) return item;
    }
  }
  return null;
}

export function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/^data:[^,]+,/, "").replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function pcm16ToWav(
  pcm: Uint8Array,
  sampleRate = 24_000,
  channels = 1,
): Uint8Array {
  const headerSize = 44;
  const wav = new Uint8Array(headerSize + pcm.byteLength);
  const view = new DataView(wav.buffer);
  const blockAlign = channels * 2;
  const byteRate = sampleRate * blockAlign;

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, headerSize);
  return wav;
}

export function normalizeGeminiAudio(output: GeminiMediaOutput): {
  bytes: Uint8Array;
  mimeType: string;
} {
  if (!output.data) throw new Error("media_provider_invalid_response");
  const bytes = decodeBase64(output.data);
  const mimeType =
    output.mime_type ?? output.mimeType ?? "audio/L16;rate=24000";
  if (/audio\/(?:l16|pcm)|codec=pcm/i.test(mimeType)) {
    const sampleRate = Number(mimeType.match(/rate=(\d+)/i)?.[1] ?? 24_000);
    return {
      bytes: pcm16ToWav(
        bytes,
        Number.isFinite(sampleRate) ? sampleRate : 24_000,
      ),
      mimeType: "audio/wav",
    };
  }
  return { bytes, mimeType };
}
