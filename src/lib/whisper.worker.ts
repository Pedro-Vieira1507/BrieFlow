// Web Worker: runs Transformers.js Whisper pipeline off the main thread
import { pipeline, env } from "@xenova/transformers";

// Allow model caching in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

type WorkerInMessage =
  | { type: "transcribe"; audio: Float32Array; language: string }
  | { type: "ping" };

type WorkerOutMessage =
  | { type: "progress"; stage: string; value?: number }
  | { type: "result"; text: string; duration?: number }
  | { type: "error"; message: string }
  | { type: "pong" };

function post(msg: WorkerOutMessage) {
  self.postMessage(msg);
}

let _pipe: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getOrCreatePipeline() {
  if (_pipe) return _pipe;

  post({ type: "progress", stage: "Baixando modelo Whisper (1ª vez ~150 MB)…", value: 0 });

  _pipe = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-small",
    {
      progress_callback: (p: { status: string; progress?: number; name?: string }) => {
        if (p.status === "downloading") {
          post({
            type: "progress",
            stage: `Baixando modelo… ${p.name ?? ""}`,
            value: p.progress ?? 0,
          });
        } else if (p.status === "loading") {
          post({ type: "progress", stage: "Carregando modelo na memória…", value: 95 });
        } else if (p.status === "ready") {
          post({ type: "progress", stage: "Modelo pronto!", value: 100 });
        }
      },
    },
  );

  return _pipe;
}

self.addEventListener("message", async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === "ping") {
    post({ type: "pong" });
    return;
  }

  if (msg.type === "transcribe") {
    try {
      const pipe = await getOrCreatePipeline();

      post({ type: "progress", stage: "Transcrevendo com Whisper…", value: 98 });

      const output = await pipe(msg.audio, {
        language: msg.language,
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });

      const text =
        typeof output === "object" && output !== null && "text" in output
          ? String((output as { text: string }).text).trim()
          : "";

      post({ type: "result", text });
    } catch (err) {
      post({ type: "error", message: (err as Error).message });
    }
  }
});
