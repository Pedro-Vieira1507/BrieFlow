import {
  EdgeFunctionError,
  invokeEdgeFunction,
  uploadMultimodalInput,
} from "@/lib/supabase";

export interface LiveAudioToken {
  token: string;
  model: string;
  expiresInSeconds: number;
  creditsRemaining: number;
}

export interface TranscriptionResult {
  transcript: string;
  model: string;
  creditsRemaining: number;
}

export interface DubResult extends TranscriptionResult {
  translation: string;
  url: string;
  storagePath: string;
  mimeType: string;
}

export interface SemanticMatch {
  assetId: string;
  similarity: number;
}

function requestId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${suffix}`.slice(0, 128);
}

export function multimodalErrorMessage(error: unknown): string {
  if (error instanceof EdgeFunctionError) {
    const messages: Record<string, string> = {
      media_input_too_large:
        "O arquivo excede 18 MB. Comprima ou divida o conteúdo.",
      unsupported_media_type:
        "Formato incompatível. Use MP3, WAV, OGG, WebM, MP4 ou MOV.",
      media_input_not_found: "O arquivo enviado não está mais disponível.",
      invalid_target_language: "Selecione um idioma de destino válido.",
      multimodal_provider_not_configured:
        "Os recursos de áudio ainda não estão configurados no servidor.",
      multimodal_provider_rate_limited:
        "O provedor de áudio está ocupado. Tente novamente em instantes.",
      insufficient_credits: "Créditos insuficientes para esta operação.",
      rate_limit_exceeded:
        "Muitas solicitações em sequência. Aguarde um minuto.",
    };
    return (
      messages[error.code] ?? "Não foi possível concluir a operação multimodal."
    );
  }
  return error instanceof Error
    ? error.message
    : "Falha inesperada no processamento.";
}

export async function requestLiveAudioToken(): Promise<LiveAudioToken> {
  return invokeEdgeFunction<LiveAudioToken>("multimodal", {
    action: "live_token",
    requestId: requestId("voice"),
  });
}

export async function transcribeMultimodalFile(
  file: File,
): Promise<TranscriptionResult> {
  const upload = await uploadMultimodalInput(file);
  return invokeEdgeFunction<TranscriptionResult>("multimodal", {
    action: "transcribe",
    requestId: requestId("transcribe"),
    storagePath: upload.path,
    mimeType: upload.mimeType,
  });
}

export async function translateAndDubFile(
  file: File,
  targetLanguage: string,
): Promise<DubResult> {
  const upload = await uploadMultimodalInput(file);
  return invokeEdgeFunction<DubResult>("multimodal", {
    action: "translate_dub",
    requestId: requestId("translate"),
    storagePath: upload.path,
    mimeType: upload.mimeType,
    targetLanguage,
  });
}

export async function semanticLibrarySearch(
  query: string,
): Promise<SemanticMatch[]> {
  const response = await invokeEdgeFunction<{
    matches: SemanticMatch[];
    creditsRemaining: number;
  }>("multimodal", {
    action: "semantic_search",
    requestId: requestId("search"),
    query,
  });
  return response.matches;
}
