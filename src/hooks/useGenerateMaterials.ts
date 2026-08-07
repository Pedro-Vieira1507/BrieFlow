// src/hooks/useGenerateMaterials.ts
//
// DX layer: um hook único para gerar peças de marketing.
//
// Fluxo: MarketingBrief -> buildMaterialPrompt -> generateCompletion(+Zod)
//        -> toBuilderContent -> BuilderState pronto para o preview.
//
// Nenhuma regra de prompt e nenhuma chamada HTTP vive aqui: este arquivo só
// orquestra e expõe estado de UI (loading por peça, erro, cancelamento).

import { useCallback, useRef, useState } from "react";

import { AiClientError, generateCompletion, type AiCompletionMeta } from "@/lib/aiClient";
import {
  buildMaterialPrompt,
  extractChannelBriefing,
  type MaterialPromptOptions,
} from "@/lib/marketingPrompts";
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
  /** Briefing bruto do usuário; o trecho do canal é extraído automaticamente. */
  rawBriefing?: string;
  prompt?: MaterialPromptOptions;
  images?: string[];
}

export interface GeneratedMaterial<T extends MaterialType = MaterialType> {
  material: T;
  copy: GeneratedCopyByMaterial[T];
  /** Conteúdo já adaptado para o builder/preview. */
  content: BuilderState;
  meta: AiCompletionMeta;
}

export interface UseGenerateMaterialsResult {
  generateMaterial: <T extends MaterialType>(
    params: GenerateMaterialParams<T>,
  ) => Promise<GeneratedMaterial<T>>;
  /** Gera várias peças em sequência; erros de uma não abortam as outras. */
  generateMaterials: (
    materials: MaterialType[],
    params: Omit<GenerateMaterialParams, "material">,
    onEach?: (result: GeneratedMaterial | { material: MaterialType; error: Error }) => void,
  ) => Promise<{
    results: GeneratedMaterial[];
    errors: { material: MaterialType; error: Error }[];
  }>;
  cancel: () => void;
  isGenerating: boolean;
  /** Peça em produção agora, para exibir progresso na UI. */
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

/** Mensagem amigável (pt-BR) para qualquer falha da camada de IA. */
export function describeAiError(error: unknown): string {
  if (error instanceof AiClientError) {
    switch (error.code) {
      case "TIMEOUT":
        return "A IA demorou demais para responder. Tente gerar novamente esta peça.";
      case "INVALID_OUTPUT":
        return "A IA respondeu num formato inesperado. Peça para regenerar a peça.";
      case "NO_PROVIDER":
        return "Nenhum modelo de IA está configurado. Verifique as variáveis de ambiente.";
      default:
        return "Não consegui falar com a IA agora (nuvem e modelo local indisponíveis).";
    }
  }
  return error instanceof Error ? error.message : "Erro inesperado na geração.";
}

export function useGenerateMaterials(): UseGenerateMaterialsResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<MaterialType | null>(null);
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
    }: GenerateMaterialParams<T>): Promise<GeneratedMaterial<T>> => {
      const controller = controllerRef.current ?? new AbortController();
      controllerRef.current = controller;

      setIsGenerating(true);
      setCurrentMaterial(material);
      setLastError(null);

      try {
        const channelBriefing =
          prompt?.channelBriefing ??
          (rawBriefing ? extractChannelBriefing(rawBriefing, material) : undefined);

        const { system, user } = buildMaterialPrompt(brief, material, {
          ...prompt,
          channelBriefing,
        });

        const schema = MATERIAL_SCHEMAS[material] as unknown as import("zod").ZodType<
          GeneratedCopyByMaterial[T]
        >;

        const { data, meta } = await generateCompletion({
          system,
          user,
          schema,
          signal: controller.signal,
        });

        return {
          material,
          copy: data,
          content: toBuilderContent(material, data, toRenderContext(brief, images)),
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

  const generateMaterials = useCallback<UseGenerateMaterialsResult["generateMaterials"]>(
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
