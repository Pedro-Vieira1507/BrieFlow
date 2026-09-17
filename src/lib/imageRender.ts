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

export async function renderCampaignImage(
  options: RenderCampaignImageOptions,
): Promise<RenderCampaignImageResult> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Backend de imagem do BrieFlow não configurado.");
  }

  const token = await getAuthToken();
  if (!token) throw new Error("Sua sessão expirou. Entre novamente para continuar.");

  const response = await fetch(`${supabaseUrl}/functions/v1/image-render`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      "X-Client-Version": "brieflow-web/3",
    },
    body: JSON.stringify({
      prompt: options.prompt,
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
    throw new Error(String(payload.error ?? "image_render_failed"));
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
