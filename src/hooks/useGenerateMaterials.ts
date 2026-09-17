// src/hooks/useGenerateMaterials.ts
import { useCallback, useRef, useState } from "react";
import {
  AiClientError,
  generateCompletion,
  type AiCompletionMeta,
  type AiProviderName,
} from "@/lib/aiClient";
import { useCreditsStore } from "@/hooks/useCredits";
import {
  buildMaterialPrompt,
  extractChannelBriefing,
  type MaterialPromptOptions,
} from "@/lib/marketingPrompts";
import { sanitizeGeneratedCopy } from "@/lib/marketingQuality";
import { ImageRenderError, renderCampaignImage } from "@/lib/imageRender";
import {
  MATERIAL_SCHEMAS,
  toBuilderContent,
  type GeneratedCopyByMaterial,
  type MaterialRenderContext,
} from "@/types/generatedContent";
import type { MarketingBrief, MaterialType } from "@/types/brief";
import type { BuilderState } from "@/types/builder";

export interface GenerateMaterialParams<T extends MaterialType = MaterialType> {
  brief: MarketingBrief;
  material: T;
  rawBriefing?: string;
  prompt?: MaterialPromptOptions;
  images?: string[];
  provider?: AiProviderName;
}

export interface GeneratedMaterial<T extends MaterialType = MaterialType> {
  material: T;
  copy: GeneratedCopyByMaterial[T];
  content: BuilderState;
  meta: AiCompletionMeta;
}

export interface UseGenerateMaterialsResult {
  generateMaterial: <T extends MaterialType>(
    params: GenerateMaterialParams<T>,
  ) => Promise<GeneratedMaterial<T>>;
  generateMaterials: (
    materials: MaterialType[],
    params: Omit<GenerateMaterialParams, "material">,
    onEach?: (
      result: GeneratedMaterial | { material: MaterialType; error: Error },
    ) => void,
  ) => Promise<{
    results: GeneratedMaterial[];
    errors: { material: MaterialType; error: Error }[];
  }>;
  cancel: () => void;
  isGenerating: boolean;
  currentMaterial: MaterialType | null;
  lastError: Error | null;
}

function toRenderContext(
  brief: MarketingBrief,
  images?: string[],
): MaterialRenderContext {
  const unique = Array.from(
    new Set(
      [
        brief.productImageUrl ?? undefined,
        ...(images ?? []),
        ...(brief.availableImageUrls ?? []),
      ].filter((url): url is string => Boolean(url)),
    ),
  );
  return {
    brandName: brief.brandName,
    productImageUrl: unique[0] ?? null,
    productImages: unique,
    productSku: brief.productUrl ?? null,
  };
}

function normalizeBriefing(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function requiresRealProductImage(rawBriefing?: string): boolean {
  if (!rawBriefing?.trim()) return false;
  const text = normalizeBriefing(rawBriefing);
  const mentionsRealImage = /(?:foto|imagem)\s+(?:real|original|oficial)/.test(text);
  const isMandatory =
    /obrigatori|nao\s+gere\s+outro|nao\s+altere|use\s+(?:a|o)|utilize\s+(?:a|o)|produto\s+real/.test(
      text,
    );
  return mentionsRealImage && isMandatory;
}

function hasUsableProductImage(brief: MarketingBrief, images?: string[]): boolean {
  return Boolean(
    brief.productImageUrl ||
      images?.some((value) => typeof value === "string" && value.trim()) ||
      brief.availableImageUrls?.some(
        (value) => typeof value === "string" && value.trim(),
      ),
  );
}

function describeImageRenderFailure(error: unknown): string {
  if (!(error instanceof ImageRenderError)) {
    return "Não foi possível criar o key visual deste banner com qualidade suficiente. Gere novamente em alguns instantes.";
  }

  switch (error.code) {
    case "image_provider_quota_unavailable":
      return "A geração visual do Gemini está sem cota disponível neste projeto. Ative o billing/quota de geração de imagens da API Gemini ou configure uma chave de projeto com acesso pago.";
    case "image_provider_auth_failed":
      return "A chave da API Gemini usada pelo BrieFlow não foi aceita. Revise a GEMINI_API_KEY configurada no Supabase.";
    case "image_provider_not_configured":
      return "O provedor de imagens do BrieFlow não está configurado. Adicione a GEMINI_API_KEY aos Secrets das Edge Functions.";
    case "rate_limit_exceeded":
      return "Muitas imagens foram geradas em sequência. Aguarde um minuto e tente novamente.";
    default:
      return "Não foi possível criar o key visual deste banner com qualidade suficiente. O provedor de imagens está temporariamente indisponível.";
  }
}

export function describeAiError(error: unknown): string {
  if (error instanceof AiClientError) {
    switch (error.code) {
      case "TIMEOUT":
        return "A IA demorou demais para responder. Tente gerar novamente esta peça.";
      case "INVALID_OUTPUT":
        return "A IA respondeu num formato inesperado. Peça para regenerar a peça.";
      case "NO_PROVIDER":
        return "Nenhum modelo de IA está configurado. Verifique as variáveis de ambiente.";
      case "INSUFFICIENT_CREDITS":
        return "Seus créditos deste ciclo terminaram. Faça upgrade ou aguarde a renovação.";
      case "FEATURE_NOT_AVAILABLE":
        return "Este formato não está disponível no seu plano atual.";
      case "RATE_LIMITED":
        return "Muitas gerações em sequência. Aguarde um instante e tente novamente.";
      case "DUPLICATE_REQUEST":
        return "Esta solicitação já foi processada. Tente gerar novamente.";
      case "WORKSPACE_SUSPENDED":
        return "Seu acesso a este workspace está suspenso. Fale com um administrador.";
      case "UNAUTHORIZED":
        return "Sua sessão expirou. Entre novamente para continuar.";
      default:
        return "Não consegui falar com a IA agora (nuvem e modelo local indisponíveis).";
    }
  }
  return error instanceof Error ? error.message : "Erro inesperado na geração.";
}

export function useGenerateMaterials(): UseGenerateMaterialsResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<MaterialType | null>(
    null,
  );
  const [lastError, setLastError] = useState<Error | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsGenerating(false);
    setCurrentMaterial(null);
  }, []);

  const generateMaterial = useCallback(
    async <T extends MaterialType>({
      brief,
      material,
      rawBriefing,
      prompt,
      images,
      provider = "omniroute",
    }: GenerateMaterialParams<T>): Promise<GeneratedMaterial<T>> => {
      const controller = controllerRef.current ?? new AbortController();
      controllerRef.current = controller;

      setIsGenerating(true);
      setCurrentMaterial(material);
      setLastError(null);

      try {
        if (
          material === "banner" &&
          requiresRealProductImage(rawBriefing) &&
          !hasUsableProductImage(brief, images)
        ) {
          throw new Error(
            "Este banner exige uma foto real do produto. Envie a imagem do produto antes de gerar para que o BrieFlow não invente ou substitua o item.",
          );
        }

        const channelBriefing =
          prompt?.channelBriefing ??
          (rawBriefing
            ? extractChannelBriefing(rawBriefing, material)
            : undefined);

        const { system, user } = buildMaterialPrompt(brief, material, {
          ...prompt,
          channelBriefing,
        });

        const schema = MATERIAL_SCHEMAS[
          material
        ] as unknown as import("zod").ZodType<GeneratedCopyByMaterial[T]>;

        const { data, meta } = await generateCompletion({
          system,
          user,
          schema,
          signal: controller.signal,
          provider,
          stage: "content",
          action: material,
        });

        const safeData = sanitizeGeneratedCopy(material, data, brief);
        const renderContext = toRenderContext(brief, images);
        let content = toBuilderContent(material, safeData, renderContext);

        if (material === "banner" && safeData.imagePrompt?.trim()) {
          try {
            const rendered = await renderCampaignImage({
              prompt: safeData.imagePrompt,
              aspectRatio: "16:9",
              imageSize: "1K",
              signal: controller.signal,
            });
            content = {
              ...content,
              backgroundImageUrl: rendered.url,
            };
          } catch (imageError) {
            if (renderContext.productImages?.length) {
              console.warn(
                "Falha ao gerar key visual; preservando o produto real sobre a composição de marca.",
                imageError,
              );
            } else {
              throw new Error(describeImageRenderFailure(imageError), {
                cause: imageError,
              });
            }
          }
        }

        useCreditsStore.getState().refresh();

        return {
          material,
          copy: safeData,
          content,
          meta,
        };
      } catch (error) {
        const normalized =
          error instanceof Error ? error : new Error(describeAiError(error));
        setLastError(normalized);
        throw normalized;
      } finally {
        setCurrentMaterial(null);
        setIsGenerating(false);
      }
    },
    [],
  );

  const generateMaterials = useCallback<
    UseGenerateMaterialsResult["generateMaterials"]
  >(
    async (materials, params, onEach) => {
      const results: GeneratedMaterial[] = [];
      const errors: { material: MaterialType; error: Error }[] = [];
      controllerRef.current = new AbortController();

      for (const material of materials) {
        try {
          const result = await generateMaterial({ ...params, material });
          results.push(result);
          onEach?.(result);
        } catch (error) {
          const entry = {
            material,
            error: error instanceof Error ? error : new Error(String(error)),
          };
          errors.push(entry);
          onEach?.(entry);
        }
      }

      controllerRef.current = null;
      return { results, errors };
    },
    [generateMaterial],
  );

  return {
    generateMaterial,
    generateMaterials,
    cancel,
    isGenerating,
    currentMaterial,
    lastError,
  };
}
