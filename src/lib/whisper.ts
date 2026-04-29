// Whisper transcription — free, runs 100% in the browser via @huggingface/transformers v3.
// No API key needed. Uses a Web Worker to keep the UI responsive.

export type WhisperModel = "tiny" | "small";

export type WhisperProgress = {
  stage: string;
  value: number; // 0-100
};

export type WhisperResult = {
  text: string;
  duration?: number;
};

const MODEL_IDS: Record<WhisperModel, string> = {
  tiny: "onnx-community/whisper-tiny",
  small: "onnx-community/whisper-small",
};

export const MODEL_LABELS: Record<WhisperModel, { label: string; size: string; speed: string }> = {
  tiny: { label: "Rápido (tiny)", size: "~77 MB", speed: "3-5× mais rápido" },
  small: { label: "Preciso (small)", size: "~244 MB", speed: "Melhor qualidade PT-BR" },
};

/** File types that can be transcribed */
export function isTranscribable(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp3", "mp4", "wav", "m4a", "webm", "mov", "ogg"].includes(ext);
}

/** Decode audio file to mono Float32Array at 16 kHz (required by Whisper) */
async function decodeAudioFile(file: File): Promise<{ samples: Float32Array; duration: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const ch0 = decoded.getChannelData(0);
  if (decoded.numberOfChannels === 1) {
    return { samples: ch0, duration: decoded.duration };
  }
  // Mix stereo → mono
  const ch1 = decoded.getChannelData(1);
  const mono = new Float32Array(ch0.length);
  for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
  return { samples: mono, duration: decoded.duration };
}

let _worker: Worker | null = null;

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  }
  return _worker;
}

/**
 * Transcribe a file using Whisper running locally in the browser.
 * @param model  "tiny" (fast) or "small" (precise, default)
 */
export async function transcribeFile(
  file: File,
  onProgress?: (p: WhisperProgress) => void,
  language = "portuguese",
  model: WhisperModel = "small",
): Promise<WhisperResult> {
  return new Promise(async (resolve, reject) => {
    onProgress?.({ stage: "Decodificando áudio…", value: 1 });

    let samples: Float32Array;
    let duration: number | undefined;

    try {
      const decoded = await decodeAudioFile(file);
      samples = decoded.samples;
      duration = decoded.duration;
    } catch (err) {
      return reject(
        new Error(
          `Não foi possível decodificar o áudio: ${(err as Error).message}. ` +
          "Tente converter o arquivo para MP3 ou WAV.",
        ),
      );
    }

    onProgress?.({ stage: "Iniciando modelo Whisper…", value: 3 });

    const worker = getWorker();
    const modelId = MODEL_IDS[model];

    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "progress") {
        onProgress?.({ stage: msg.stage, value: msg.value });
      } else if (msg.type === "result") {
        worker.removeEventListener("message", handler);
        resolve({ text: msg.text, duration });
      } else if (msg.type === "error") {
        worker.removeEventListener("message", handler);
        reject(new Error(msg.message));
      }
    };

    worker.addEventListener("message", handler);
    // Transfer Float32Array buffer zero-copy to the worker
    worker.postMessage({ type: "transcribe", audio: samples, language, modelId }, [samples.buffer]);
  });
}
