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

function isUploadedProductAsset(value?: string | null): boolean {
  if (!value) return false;
  return (
    /campaign-assets(?:\/|%2f).*?(?:\/|%2f)products(?:\/|%2f)/i.test(value) ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  );
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
  const deliberateHero = isUploadedProductAsset(brief.productImageUrl)
    ? brief.productImageUrl
    : null;

  return {
    brandName: brief.brandName,
    productImageUrl: deliberateHero ?? unique[0] ?? null,
    // A deliberate upload is authoritative: scraped/reference images may still
    // inform the briefing, but they must never become extra rendered heroes.
    productImages: deliberateHero ? [deliberateHero] : unique,
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

function normalizeSceneContext(brief: MarketingBrief): string {
  return normalizeBriefing(
    [
      brief.audience,
      brief.context,
      brief.objective,
      brief.product,
      brief.productTitle,
      brief.productDescription,
      brief.site?.title,
      brief.site?.description,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" && Boolean(value.trim()),
      )
      .join(" "),
  );
}

function backgroundSceneCue(brief: MarketingBrief): string {
  const context = normalizeSceneContext(brief);
  if (/laborator|centrif|microscop|pipet|reagent|analise clin|cientific/.test(context)) {
    return "modern professional laboratory interior, clean empty benchtop, precise architectural lines, subtle depth of field, controlled cool-neutral studio daylight";
  }
  if (/cafe|coffee|grao|torref|bebida|cafeter/.test(context)) {
    return "warm specialty-coffee environment, refined natural wood or stone surface, soft editorial daylight, subtle atmospheric warmth and tactile materials";
  }
  if (/software|saas|gestao|dashboard|plataforma|tecnolog|b2b/.test(context)) {
    return "refined contemporary business environment with abstract operational depth, subtle architectural geometry, premium neutral lighting";
  }
  if (/moveis|mobilia|poltrona|sofa|decor|interior/.test(context)) {
    return "refined contemporary interior, premium architectural materials, soft directional editorial light, restrained luxury atmosphere";
  }
  if (/industrial|engenharia|fabrica|maquina|manufatura/.test(context)) {
    return "clean modern industrial environment, precise structural details, controlled professional lighting, uncluttered working surface";
  }
  if (/cosmet|beleza|skincare|perfume|dermo/.test(context)) {
    return "premium beauty editorial environment, clean stone or matte surface, soft diffused studio light, restrained tactile textures";
  }
  return "premium commercial environment appropriate to the brand, clean architectural depth, controlled studio lighting, refined material texture";
}

function productSafeBackgroundPrompt(
  brief: MarketingBrief,
  copy: Record<string, unknown>,
): string {
  const layout = String(copy.layoutStyle ?? "split");
  const productZone =
    layout === "reverse"
      ? "keep the left 44 to 48 percent visually calm and open for an externally composited real product cutout; keep the right side readable for external typography"
      : "keep the right 44 to 48 percent visually calm and open for an externally composited real product cutout; keep the left side readable for external typography";
  const themeColor =
    typeof copy.themeColor === "string" ? copy.themeColor : "#1f4f46";
  const secondaryColor =
    typeof copy.secondaryColor === "string" ? copy.secondaryColor : "#0f172a";

  return [
    "BACKGROUND PLATE ONLY for a premium commercial banner",
    backgroundSceneCue(brief),
    productZone,
    `subtle brand palette accents inspired by ${themeColor} and ${secondaryColor}`,
    "environment and supporting surfaces only",
    "absolutely no advertised product, no replica, no similar machine, no device, no equipment hero, no package, no merchandise, no standalone foreground object",
    "do not place any object inside the reserved product zone",
    "realistic integrated perspective and lighting so an external product cutout can be composited naturally",
    "no text, no letters, no numbers, no logo, no watermark, no UI, no collage, no contact sheet, no thumbnail grid",
  ].join(", ");
}

function describeImageRenderFailure(error: unknown): string {
  if (!(error instanceof ImageRenderError)) {
    return "Não foi possível criar o key visual deste banner com qualidade suficiente. Gere novamente em alguns instantes.";
  }

  switch (error.code) {
    case "image_provider_quota_unavailable":
      return "A cota gratuita do Cloudflare Workers AI para geração de imagens foi atingida. Aguarde a renovação diária da cota ou revise o consumo no painel da Cloudflare.";
    case "image_provider_auth_failed":
      return "A Cloudflare recusou as credenciais do Workers AI. Revise CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN nos Secrets do Supabase e confirme as permissões Workers AI - Read e Edit.";
    case "image_provider_not_configured":
      return "O provedor visual do BrieFlow não está configurado. Adicione CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN aos Secrets das Edge Functions.";
    case "rate_limit_exceeded":
      return "Muitas imagens foram geradas em sequência. Aguarde um minuto e tente novamente.";
    default:
      return "Não foi possível criar o key visual deste banner com qualidade suficiente. O Cloudflare Workers AI não conseguiu concluir a geração.";
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
            const visualPrompt = renderContext.productImageUrl
              ? productSafeBackgroundPrompt(
                  brief,
                  safeData as unknown as Record<string, unknown>,
                )
              : safeData.imagePrompt;
            const rendered = await renderCampaignImage({
              prompt: visualPrompt,
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
