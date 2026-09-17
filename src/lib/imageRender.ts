import { getAuthToken } from "@/lib/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export interface RenderCampaignImageOptions {
  prompt: string;
  aspectRatio?: "16:9" | "21:9" | "4:3" | "1:1" | "4:5" | "9:16";
  imageSize?: "512" | "1K" | "2K";
  signal?: AbortSignal;
}

export interface RenderCampaignImageResult {
  url: string;
  path: string;
  model: string;
  aspectRatio: string;
}

export class ImageRenderError extends Error {
  readonly code: string;
  readonly status: number;
  readonly providerStatus?: number;
  readonly providerCode?: string;
  readonly providerMessage?: string;
  readonly modelsTried: string[];

  constructor(input: {
    code: string;
    status: number;
    providerStatus?: number;
    providerCode?: string;
    providerMessage?: string;
    modelsTried?: string[];
  }) {
    super(input.code);
    this.name = "ImageRenderError";
    this.code = input.code;
    this.status = input.status;
    this.providerStatus = input.providerStatus;
    this.providerCode = input.providerCode;
    this.providerMessage = input.providerMessage;
    this.modelsTried = input.modelsTried ?? [];
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
}

function premiumImagePrompt(rawPrompt: string): string {
  const normalized = rawPrompt.replace(/\s+/g, " ").trim();
  const guardrail =
    "single coherent premium commercial scene, one clear focal idea, no collage, no contact sheet, no thumbnail grid, no floating image panels, no pasted photo rectangles, visually integrated lighting and perspective, clean negative space for external typography";

  if (/no collage/i.test(normalized)) return normalized.slice(0, 7_800);

  const available = Math.max(400, 7_800 - guardrail.length - 2);
  return `${normalized.slice(0, available)}, ${guardrail}`;
}

export async function renderCampaignImage(
  options: RenderCampaignImageOptions,
): Promise<RenderCampaignImageResult> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Backend de imagem do BrieFlow não configurado.");
  }

  const token = await getAuthToken();
  if (!token) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/image-render`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      "X-Client-Version": "brieflow-web/4",
    },
    body: JSON.stringify({
      prompt: premiumImagePrompt(options.prompt),
      aspect_ratio: options.aspectRatio ?? "16:9",
      image_size: options.imageSize ?? "1K",
    }),
    signal: options.signal,
  });

  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    payload = { error: "invalid_server_response" };
  }

  if (!response.ok) {
    throw new ImageRenderError({
      code: readString(payload.error) ?? "image_render_failed",
      status: response.status,
      providerStatus: readNumber(payload.provider_status),
      providerCode: readString(payload.provider_code),
      providerMessage: readString(payload.provider_message),
      modelsTried: readStringArray(payload.models_tried),
    });
  }

  const url = typeof payload.url === "string" ? payload.url : "";
  if (!url) throw new Error("image_render_empty");

  return {
    url,
    path: typeof payload.path === "string" ? payload.path : "",
    model: typeof payload.model === "string" ? payload.model : "unknown",
    aspectRatio:
      typeof payload.aspect_ratio === "string" ? payload.aspect_ratio : "16:9",
  };
}
