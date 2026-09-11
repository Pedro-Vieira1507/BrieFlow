import { EdgeFunctionError, invokeEdgeFunction } from "@/lib/supabase";
import type {
  MediaRenderState,
  StructuredContentDocument,
} from "@/types/builder";
import type { MaterialType } from "@/types/brief";

export type RenderableMediaMaterial = Extract<
  MaterialType,
  "reel" | "video" | "podcast"
>;

interface StartResponse {
  taskId: string;
  signature: string;
  status: "queued";
  kind: "video" | "audio";
}

interface StatusResponse {
  taskId: string;
  status: "queued" | "processing" | "ready" | "failed";
  kind?: "video" | "audio";
  url?: string;
  mimeType?: string;
  generatedAt?: string;
  error?: string;
}

const MAX_STATUS_CHECKS = 48;
const POLL_INTERVAL_MS = 5_000;

export function isRenderableMediaMaterial(
  material: MaterialType,
): material is RenderableMediaMaterial {
  return material === "reel" || material === "video" || material === "podcast";
}

function plainText(value: string | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function buildMediaRenderPrompt(
  material: RenderableMediaMaterial,
  document: StructuredContentDocument,
  brandName?: string,
): string {
  if (material === "podcast") {
    const spokenBlocks = document.sections
      .map((section) => plainText(section.body))
      .filter(Boolean);

    return [
      `Podcast em Português do Brasil para ${plainText(brandName) || "a marca"}.`,
      document.title ? `Tema: ${plainText(document.title)}.` : "",
      document.subtitle ? plainText(document.subtitle) : "",
      ...spokenBlocks,
      document.cta ? plainText(document.cta) : "",
      document.disclaimer ? plainText(document.disclaimer) : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 12_000);
  }

  const orientation =
    material === "reel"
      ? "Vídeo vertical 9:16 para Reel, ritmo dinâmico e leitura mobile."
      : "Vídeo horizontal 16:9, acabamento publicitário profissional.";

  const scenes = document.sections
    .map((section, index) => {
      const parts = [
        `Cena ${index + 1}: ${plainText(section.title)}.`,
        section.visualDirection
          ? `Visual: ${plainText(section.visualDirection)}.`
          : "",
        section.body ? `Mensagem: ${plainText(section.body)}.` : "",
        section.items?.length
          ? `Elementos: ${section.items.map(plainText).filter(Boolean).join(", ")}.`
          : "",
      ];
      return parts.filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("\n");

  return [
    orientation,
    `Marca: ${plainText(brandName) || "não especificada"}.`,
    document.summary ? `Objetivo: ${plainText(document.summary)}.` : "",
    scenes,
    "Não renderize legendas, logos ou textos ilegíveis dentro da imagem. Preserve aparência natural, continuidade visual e movimentos de câmera plausíveis.",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 3_500);
}

function userFacingRenderError(error: unknown): string {
  if (error instanceof EdgeFunctionError) {
    if (error.code === "media_provider_not_configured") {
      return "A renderização de mídia ainda não está configurada no servidor.";
    }
    if (error.code === "media_provider_plan_required") {
      return "O provedor audiovisual precisa de um plano com geração de mídia habilitada.";
    }
    if (error.code === "media_provider_rate_limited") {
      return "O provedor audiovisual está temporariamente ocupado. Tente novamente em instantes.";
    }
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível renderizar a mídia final.";
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Operação cancelada.", "AbortError"));
      return;
    }
    const timeout = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Operação cancelada.", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function renderFinalMedia(params: {
  material: RenderableMediaMaterial;
  document: StructuredContentDocument;
  brandName?: string;
  referenceImageUrl?: string | null;
  signal?: AbortSignal;
}): Promise<MediaRenderState> {
  const prompt = buildMediaRenderPrompt(
    params.material,
    params.document,
    params.brandName,
  );

  try {
    const started = await invokeEdgeFunction<StartResponse>(
      "media-render",
      {
        action: "start",
        material: params.material,
        prompt,
        referenceImageUrl: params.referenceImageUrl ?? null,
      },
      params.signal,
    );

    for (let attempt = 0; attempt < MAX_STATUS_CHECKS; attempt += 1) {
      await wait(
        POLL_INTERVAL_MS + Math.floor(Math.random() * 700),
        params.signal,
      );
      const status = await invokeEdgeFunction<StatusResponse>(
        "media-render",
        {
          action: "status",
          material: params.material,
          taskId: started.taskId,
          signature: started.signature,
        },
        params.signal,
      );

      if (status.status === "ready" && status.url) {
        return {
          kind: started.kind,
          status: "ready",
          provider: "runway",
          taskId: started.taskId,
          url: status.url,
          mimeType: status.mimeType,
          generatedAt: status.generatedAt ?? new Date().toISOString(),
        };
      }

      if (status.status === "failed") {
        return {
          kind: started.kind,
          status: "failed",
          provider: "runway",
          taskId: started.taskId,
          error: status.error ?? "A renderização não foi concluída.",
        };
      }
    }

    return {
      kind: started.kind,
      status: "failed",
      provider: "runway",
      taskId: started.taskId,
      error:
        "A renderização demorou mais que o esperado. Gere novamente para tentar de novo.",
    };
  } catch (error) {
    return {
      kind: params.material === "podcast" ? "audio" : "video",
      status: "failed",
      provider: "runway",
      error: userFacingRenderError(error),
    };
  }
}
