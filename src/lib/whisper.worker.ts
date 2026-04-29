// Web Worker — Whisper transcription via @huggingface/transformers v3
// This file runs in a separate thread so the UI never freezes.
import { pipeline, env } from "@huggingface/transformers";

// Use browser cache; never load from local filesystem
env.allowLocalModels = false;
env.useBrowserCache = true;

type ProgressEvent = {
  status: string;
  progress?: number;
  name?: string;
  file?: string;
};

type WorkerInMessage =
  | { type: "transcribe"; audio: Float32Array; language: string; modelId: string }
  | { type: "ping" };

type WorkerOutMessage =
  | { type: "progress"; stage: string; value: number }
  | { type: "result"; text: string }
  | { type: "error"; message: string }
  | { type: "pong" };

function post(msg: WorkerOutMessage) {
  self.postMessage(msg);
}

// Cache pipeline per model id
const _pipes = new Map<string, Awaited<ReturnType<typeof pipeline>>>();

async function getPipeline(modelId: string) {
  if (_pipes.has(modelId)) return _pipes.get(modelId)!;

  post({ type: "progress", stage: "Baixando modelo Whisper (1ª vez)…", value: 0 });

  const pipe = await pipeline(
    "automatic-speech-recognition",
    modelId,
    {
      progress_callback: (p: ProgressEvent) => {
        if (p.status === "downloading") {
          post({
            type: "progress",
            stage: `Baixando: ${p.file ?? p.name ?? "modelo"}`,
            value: Math.round(p.progress ?? 0),
          });
        } else if (p.status === "loading") {
          post({ type: "progress", stage: "Carregando modelo na memória…", value: 92 });
        } else if (p.status === "ready") {
          post({ type: "progress", stage: "Modelo pronto!", value: 96 });
        }
      },
    },
  );

  _pipes.set(modelId, pipe);
  return pipe;
}

self.addEventListener("message", async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === "ping") {
    post({ type: "pong" });
    return;
  }

  if (msg.type === "transcribe") {
    try {
      const pipe = await getPipeline(msg.modelId);

      post({ type: "progress", stage: "Transcrevendo com Whisper…", value: 97 });

      const output = await (pipe as (input: Float32Array, options: object) => Promise<{ text: string }>)(
        msg.audio,
        {
          language: msg.language,
          task: "transcribe",
          chunk_length_s: 30,
          stride_length_s: 5,
        },
      );

      post({ type: "result", text: (output?.text ?? "").trim() });
    } catch (err) {
      post({ type: "error", message: (err as Error).message });
    }
  }
});
