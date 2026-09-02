// src/hooks/useBriefflowAgent.ts
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useBriefflowStore, uid } from "@/store/briefflow";
import { sendToOllama, type ChatTurn } from "@/lib/ollama";
import {
  useGenerateMaterials,
  describeAiError,
} from "@/hooks/useGenerateMaterials";
import {
  CORE_MATERIAL_TYPES,
  isMaterialType,
  toMarketingBrief,
  type MaterialType,
} from "@/types/brief";
import { useCreditsStore } from "@/hooks/useCredits";
import { CONTENT_FORMATS, canUseMaterial } from "@/lib/plans";
import {
  extractUrlsFromText,
  scrapeProductByUrlFn,
  scrapeWebsite,
  type ScrapedProductData,
} from "@/lib/scrape-site";
import { visualSearchFn } from "@/lib/visual-search";
import type {
  CampaignAsset,
  DiscoveryPlan,
  SiteBrandData,
  BuilderState,
} from "@/types/builder";
import { analyzeImageWithVisionFn } from "@/lib/vision-api";
import { mergeDetectedBriefContext } from "@/lib/discoveryContext";

type CampaignChannel = MaterialType;

const ALL_CHANNELS: CampaignChannel[] = [...CORE_MATERIAL_TYPES];

const channelLabel = (channel: CampaignChannel) =>
  CONTENT_FORMATS[channel].shortLabel;

export function useBriefflowAgent() {
  const {
    messages,
    builder,
    brandContext,
    uploadedImage,
    setMessages,
    appendMessage,
    updateMessage,
    setBuilder,
    patchCampaignAssets,
    updateCampaignAsset,
    mergeSiteIntoContext,
    setLoading,
    setScraping,
    setGeneratingLabel,
  } = useBriefflowStore();

  const { generateMaterial } = useGenerateMaterials();

  const discoveryPlanRef = useRef<DiscoveryPlan | undefined>(undefined);
  const scrapedProductsRef = useRef<ScrapedProductData[]>([]);

  const brandContextRef = useRef(brandContext);
  brandContextRef.current = brandContext;

  const builderRef = useRef(builder);
  builderRef.current = builder;

  // Ao abrir uma campanha da biblioteca o hook continua montado, mas seus
  // refs começam vazios. Espelhar o plano salvo evita que um retry use
  // "Sua Marca" ou herde dados do briefing anterior após um reset.
  useEffect(() => {
    if (builder.type === "none") {
      discoveryPlanRef.current = undefined;
      scrapedProductsRef.current = [];
      return;
    }

    if (builder.discoveryPlan) {
      discoveryPlanRef.current = builder.discoveryPlan;
    }
  }, [builder.discoveryPlan, builder.type]);

  const maybeScrapeUrls = useCallback(
    async (text: string): Promise<SiteBrandData | null> => {
      const urls = extractUrlsFromText(text);
      if (urls.length === 0) return null;

      const targetUrl = urls[0];
      const existing = brandContextRef.current.site;
      if (existing && targetUrl === existing.url) return existing;

      setScraping(true);
      try {
        const site = await scrapeWebsite(targetUrl);
        if (site) {
          mergeSiteIntoContext(site);
          return site;
        }
      } catch {
        // silent
      } finally {
        setScraping(false);
      }
      return null;
    },
    [mergeSiteIntoContext, setScraping],
  );

  const buildErrorAsset = useCallback(
    (
      channel: CampaignChannel,
      productImages: string[],
      brandName: string,
      errorMessage: string,
    ): CampaignAsset => {
      const errorContent: BuilderState = {
        type: channel,
        brandName,
        generationError: errorMessage,
        productImages,
      } as BuilderState;

      if (channel === "banner") {
        errorContent.title = "Não consegui gerar este banner";
        errorContent.subtitle = errorMessage;
        errorContent.cta = "Tentar novamente";
      } else if (channel === "email") {
        errorContent.title = "Não consegui gerar este e-mail";
        errorContent.body = errorMessage;
        errorContent.cta = "Tentar novamente";
      } else {
        if (channel === "social") {
          errorContent.caption = `Não consegui gerar este post. ${errorMessage}`;
          errorContent.hashtags = [];
        } else {
          errorContent.title = `Não consegui gerar ${channelLabel(channel)}`;
          errorContent.body = errorMessage;
          errorContent.structuredContent = {
            format: channel,
            title: errorContent.title,
            summary: errorMessage,
            sections: [],
          };
        }
      }

      return {
        id: uid(),
        type: channel,
        status: "draft",
        content: errorContent,
      };
    },
    [],
  );

  const generateCampaignSafely = useCallback(
    async (
      baseHistory: ChatTurn[],
      only?: CampaignChannel,
      targetKeys: string[] = ["all"],
      provider: "ollama" | "omniroute" = "omniroute",
    ) => {
      const plan = discoveryPlanRef.current ?? builderRef.current.discoveryPlan;

      const channels: CampaignChannel[] = only ? [only] : ALL_CHANNELS;
      const accountPlan = useCreditsStore.getState().plan;
      const blocked = channels.find(
        (channel) =>
          !canUseMaterial(
            accountPlan?.plan,
            channel,
            accountPlan?.allowedFormats,
          ),
      );
      if (blocked) {
        toast.error(
          `${channelLabel(blocked)} não está disponível no seu plano.`,
          {
            description:
              "Consulte a Central de formatos para ver as opções liberadas.",
          },
        );
        return;
      }

      setLoading(true);

      const savedCampaignImages =
        builderRef.current.type === "campaign"
          ? (builderRef.current.campaignAssets ?? []).flatMap((asset) => [
              ...(asset.content.productImages ?? []),
              asset.content.productImageUrl,
            ])
          : [];
      const allImages = [
        ...(uploadedImage ? [uploadedImage] : []),
        ...scrapedProductsRef.current.map((p) => p.imageUrl).filter(Boolean),
        ...savedCampaignImages,
      ].filter(
        (image): image is string =>
          typeof image === "string" && image.trim().length > 0,
      );

      const uniqueImages = Array.from(new Set(allImages));

      const campaignBrief = toMarketingBrief({
        brandContext: brandContextRef.current,
        plan,
        product: {
          productUrl: scrapedProductsRef.current[0]?.productUrl ?? null,
          productImageUrl: uniqueImages[0] ?? null,
          productTitle: scrapedProductsRef.current[0]?.name ?? null,
        },
        availableImageUrls: uniqueImages,
      });

      if (!only) {
        patchCampaignAssets([]);
      }

      const assistantId = uid();
      appendMessage({
        id: assistantId,
        role: "assistant",
        content: only
          ? `Ok! Vou regerar apenas o **${channelLabel(only)}** – as outras peças permanecem como estão.`
          : `Mão na massa! Gerando ${channels.length} peças sequencialmente.`,
      });

      let hasErrors = false;
      let campaignPlatformContext = "";

      for (const [index, channel] of channels.entries()) {
        setGeneratingLabel(
          `Produzindo ${channelLabel(channel)} (${index + 1}/${channels.length})...`,
        );

        try {
          const safeTargetKeys = Array.isArray(targetKeys)
            ? targetKeys
            : ["all"];
          const isAll =
            safeTargetKeys.length === 0 ||
            safeTargetKeys.some((k) =>
              ["all", "tudo", "todos", "geral", "completo"].includes(
                String(k).toLowerCase(),
              ),
            );

          const allowedKeys = new Set<string>();

          if (!isAll) {
            const normalizedStr = safeTargetKeys.join(" ").toLowerCase();
            const schemaMap: Record<string, string[]> = {
              cta: [
                "cta",
                "ctatext",
                "botão",
                "botao",
                "button",
                "chamada",
                "action",
                "clique",
                "link",
              ],
              title: [
                "title",
                "headline",
                "subject",
                "assunto",
                "título",
                "titulo",
                "cabeçalho",
                "header",
                "principal",
              ],
              subtitle: [
                "subtitle",
                "subheadline",
                "subtítulo",
                "subtitulo",
                "descrição",
                "apoio",
                "final",
              ],
              body: [
                "body",
                "corpo",
                "parágrafo",
                "paragrafo",
                "conteúdo",
                "mensagem",
                "texto",
              ],
              caption: ["caption", "legenda", "post", "texto do post"],
              hook: ["hook", "gancho", "abertura", "primeira linha"],
              hashtags: [
                "hashtags",
                "tags",
                "marcadores",
                "palavras",
                "hashtag",
              ],
              imagePrompt: [
                "imagePrompt",
                "imagem",
                "foto",
                "arte",
                "fundo",
                "background",
                "ilustração",
                "visual",
                "prompt",
              ],
              themeColor: [
                "themeColor",
                "secondaryColor",
                "color",
                "cores",
                "cor",
                "paleta",
                "tom",
                "visual",
              ],
              preheader: [
                "preheader",
                "pré-header",
                "pre-header",
                "texto de prévia",
                "texto de previa",
              ],
              keyBenefits: [
                "keyBenefits",
                "benefícios",
                "beneficios",
                "vantagens",
                "diferenciais",
              ],
              objectionsHandled: [
                "objectionsHandled",
                "objeções",
                "objecoes",
                "dúvidas",
                "duvidas",
              ],
              heroBadge: ["heroBadge", "badge", "selo", "tag"],
              badgePrimary: [
                "badgePrimary",
                "badge",
                "selo",
                "destaque",
                "desconto",
                "oferta",
              ],
              badgeSecondary: [
                "badgeSecondary",
                "badge secundário",
                "selo secundário",
              ],
              benefitTitle: [
                "benefitTitle",
                "título dos benefícios",
                "titulo dos beneficios",
              ],
              secondaryCta: [
                "secondaryCta",
                "cta secundário",
                "cta secundario",
                "segundo botão",
                "segundo botao",
              ],
              urgencyText: [
                "urgencyText",
                "urgência",
                "urgencia",
                "prazo",
                "escassez",
              ],
              testimonials: [
                "testimonials",
                "depoimentos",
                "prova social",
                "avaliações",
                "avaliacoes",
              ],
              footerInfo: [
                "footerInfo",
                "rodapé",
                "rodape",
                "regras",
                "termos",
                "observação",
                "observacao",
              ],
              layoutStyle: [
                "layoutStyle",
                "layout",
                "composição",
                "composicao",
                "estrutura",
              ],
              backgroundShape: [
                "backgroundShape",
                "forma",
                "shape",
                "grafismo",
              ],
            };

            for (const [canonicalKey, synonyms] of Object.entries(schemaMap)) {
              if (synonyms.some((syn) => normalizedStr.includes(syn))) {
                allowedKeys.add(canonicalKey);
              }
            }
          }

          const existingAsset =
            builderRef.current.type === "campaign"
              ? builderRef.current.campaignAssets?.find(
                  (a) => a.type === channel,
                )
              : undefined;

          let currentContentContext = "";
          if (existingAsset?.content) {
            try {
              const c = existingAsset.content;

              // PREVINE INJEÇÃO DE ERRO: Ignora o texto atual da tela se ele contiver a mensagem de erro
              const isErrorState =
                (c.title && c.title.includes("Não consegui gerar")) ||
                (c.caption && c.caption.includes("Não consegui gerar"));

              if (!isErrorState) {
                const safeContext: Partial<BuilderState> = {
                  title: c.title,
                  subtitle: c.subtitle,
                  preheader: c.preheader,
                  cta: c.cta,
                  ctaVariant: c.ctaVariant,
                  body: c.body,
                  hook: c.hook,
                  caption: c.caption,
                  hashtags: c.hashtags,
                  keyBenefits: c.keyBenefits,
                  objectionsHandled: c.objectionsHandled,
                  heroBadge: c.heroBadge,
                  badgePrimary: c.badgePrimary,
                  badgeSecondary: c.badgeSecondary,
                  benefitTitle: c.benefitTitle,
                  secondaryCta: c.secondaryCta,
                  urgencyText: c.urgencyText,
                  testimonials: c.testimonials,
                  footerInfo: c.footerInfo,
                  imagePrompt: c.imagePrompt,
                  emailHeroImagePrompt: c.emailHeroImagePrompt,
                  themeColor: c.themeColor,
                  secondaryColor: c.secondaryColor,
                  layoutStyle: c.layoutStyle,
                  backgroundShape: c.backgroundShape,
                  structuredContent: c.structuredContent,
                };
                currentContentContext = `\n\n=== CONTEÚDO ATUAL DA PEÇA ===\nATENÇÃO: Preserve o texto abaixo exatamente como está para todos os campos que o usuário NÃO pediu para alterar:\n${JSON.stringify(safeContext, null, 2)}`;
              }
            } catch (e) {
              console.warn("Falha ao serializar contexto seguro para a IA", e);
            }
          }

          const recentUserBriefing = baseHistory
            .filter((m) => m.role === "user")
            .slice(-4)
            .map((m) => m.content)
            .join("\n\n---\n\n");

          const rawBriefing =
            recentUserBriefing +
            campaignPlatformContext +
            currentContentContext;

          const { content } = await generateMaterial({
            brief: campaignBrief,
            material: channel,
            rawBriefing: rawBriefing,
            images: uniqueImages,
            provider,
          });

          if (!only && channel === "banner") {
            const semanticSpine = [
              content.title,
              content.subtitle,
              content.body,
              ...(content.keyBenefits ?? []),
              content.cta,
              content.badgePrimary,
              content.badgeSecondary,
            ]
              .filter(
                (value): value is string =>
                  typeof value === "string" && Boolean(value.trim()),
              )
              .join(" | ");

            if (semanticSpine) {
              campaignPlatformContext = `

=== PLATAFORMA CRIATIVA DA CAMPANHA ===
O banner aprovado definiu esta espinha semântica: ${semanticSpine}
Para e-mail e social: preserve a mesma promessa, os mesmos fatos e o mesmo território verbal. Não copie a headline; desenvolva a ideia conforme o papel do canal e não introduza um novo posicionamento.`;
            }
          }

          updateCampaignAsset(channel, (prevAsset) => {
            const { generationError: _discardedError, ...prevContent } =
              prevAsset?.content || {};
            let mergedContent: Record<string, unknown> = { ...prevContent };

            if (isAll || !prevAsset) {
              mergedContent = { ...prevContent, ...content };
            } else {
              const assign = (key: keyof BuilderState) => {
                if (content[key] !== undefined)
                  mergedContent[key] = content[key];
              };

              if (allowedKeys.has("title")) assign("title");
              if (allowedKeys.has("subtitle")) assign("subtitle");
              if (allowedKeys.has("preheader")) assign("preheader");
              if (allowedKeys.has("body")) assign("body");
              if (allowedKeys.has("hook")) assign("hook");
              if (allowedKeys.has("hashtags")) assign("hashtags");
              if (allowedKeys.has("keyBenefits")) assign("keyBenefits");
              if (allowedKeys.has("objectionsHandled"))
                assign("objectionsHandled");
              if (allowedKeys.has("heroBadge")) assign("heroBadge");
              if (allowedKeys.has("badgePrimary")) assign("badgePrimary");
              if (allowedKeys.has("badgeSecondary")) assign("badgeSecondary");
              if (allowedKeys.has("benefitTitle")) assign("benefitTitle");
              if (allowedKeys.has("secondaryCta")) assign("secondaryCta");
              if (allowedKeys.has("urgencyText")) assign("urgencyText");
              if (allowedKeys.has("testimonials")) assign("testimonials");
              if (allowedKeys.has("footerInfo")) assign("footerInfo");
              if (allowedKeys.has("layoutStyle")) assign("layoutStyle");
              if (allowedKeys.has("backgroundShape")) assign("backgroundShape");

              if (allowedKeys.has("cta")) {
                assign("cta");
                assign("ctaVariant");
              }

              if (allowedKeys.has("caption")) {
                assign("caption");
                assign("hook");
                assign("body");
                assign("cta");
              }

              if (allowedKeys.has("imagePrompt")) {
                assign("imagePrompt");
                assign("emailHeroImagePrompt");
              }

              if (allowedKeys.has("themeColor")) {
                assign("themeColor");
                assign("secondaryColor");
              }

              if (
                channel === "social" &&
                !allowedKeys.has("caption") &&
                ["hook", "body", "cta"].some((key) => allowedKeys.has(key))
              ) {
                mergedContent.caption = [
                  mergedContent.hook,
                  mergedContent.body,
                  mergedContent.cta,
                ]
                  .filter((value) => typeof value === "string" && value.trim())
                  .join("\n\n");
              }
            }

            return {
              id: prevAsset?.id || uid(),
              type: channel,
              status: "draft",
              content: {
                ...mergedContent,
                type: channel,
                brandName:
                  content.brandName ||
                  plan?.brandName ||
                  prevAsset?.content.brandName,
                productImages: uniqueImages,
              },
            };
          });
        } catch (err) {
          const errorMessage = describeAiError(err);
          console.error(`Erro ao gerar ${channel}:`, errorMessage, err);
          hasErrors = true;
          updateCampaignAsset(channel, () =>
            buildErrorAsset(
              channel,
              uniqueImages,
              campaignBrief.brandName,
              errorMessage,
            ),
          );
        }
      }

      updateMessage(assistantId, {
        content: hasErrors
          ? only
            ? `Não consegui regerar o ${channelLabel(only)} agora. Tente novamente.`
            : "Processo concluído, mas uma ou mais peças falharam. Você pode pedir para regenerar."
          : only
            ? `${channelLabel(only)} atualizado com sucesso.`
            : "Campanha finalizada! Navegue pelas abas ao lado.",
      });

      setGeneratingLabel(undefined);
      setLoading(false);
    },
    [
      appendMessage,
      buildErrorAsset,
      patchCampaignAssets,
      setGeneratingLabel,
      setLoading,
      generateMaterial,
      updateCampaignAsset,
      updateMessage,
      uploadedImage,
    ],
  );

  const handleSend = useCallback(
    async (text: string, isHiddenAction = false) => {
      // O nome legado do provider é mantido por compatibilidade; a chamada de
      // nuvem é sempre roteada pela Edge Function autenticada.
      const provider: "ollama" | "omniroute" = "omniroute";

      const tryScrapeProduct = async (
        skuOrUrl: string,
        hidden: boolean,
      ): Promise<void> => {
        const value = skuOrUrl.trim();
        if (!value) return;

        if (
          scrapedProductsRef.current.some(
            (p) => p.sku === value || p.productUrl === value,
          )
        )
          return;

        const isUrl = value.startsWith("http");
        let isHomepage = false;
        if (isUrl) {
          try {
            const target = new URL(value);
            if (target.pathname === "/" || target.pathname === "")
              isHomepage = true;
          } catch {
            /* noop */
          }
        }

        if (isHomepage) return;

        setLoading(true);
        try {
          let productData: ScrapedProductData = {
            sku: value,
            name: null,
            price: null,
            availability: null,
            imageUrl: null,
            productUrl: value,
            found: false,
          };

          if (isUrl) {
            const scraped = await scrapeProductByUrlFn(value).catch(() => null);
            if (scraped) productData = { ...productData, ...scraped };
          }

          // --- BUSCA VISUAL NO SERVIDOR VIA GOOGLE ---
          if (!productData.imageUrl && !isUrl) {
            setGeneratingLabel(`Buscando foto oficial para: ${value}...`);
            try {
              const visualResult = await visualSearchFn({
                data: { query: value },
              });
              if (visualResult.found && visualResult.imageUrl) {
                productData.imageUrl = visualResult.imageUrl;
                productData.found = true;
                productData.name = productData.name || value;
              }
              if (visualResult.error) {
                appendMessage({
                  id: uid(),
                  role: "assistant",
                  content: `⚠️ **Aviso:** ${visualResult.error}`,
                });
              }
            } catch (visualErr) {
              console.error("Erro fatal na busca visual:", visualErr);
            }
            setGeneratingLabel(undefined);
          }

          // INTEGRAÇÃO GOOGLE AI VISION: Extrai cores do produto automaticamente
          if (productData.found && productData.imageUrl) {
            scrapedProductsRef.current = [
              ...scrapedProductsRef.current,
              productData,
            ];

            setGeneratingLabel(
              `Google Vision API analisando imagem do produto...`,
            );
            try {
              const visionResult = await analyzeImageWithVisionFn({
                data: { imageUrl: productData.imageUrl },
              });

              if (visionResult.primaryBrandColor) {
                const themeColor = visionResult.primaryBrandColor;
                const secondaryColor =
                  visionResult.secondaryBrandColor || "#0f172a";

                if (
                  builderRef.current.type === "campaign" &&
                  builderRef.current.campaignAssets
                ) {
                  const updatedAssets = builderRef.current.campaignAssets.map(
                    (asset) => ({
                      ...asset,
                      content: {
                        ...asset.content,
                        productImageUrl: productData.imageUrl,
                        themeColor,
                        secondaryColor,
                      },
                    }),
                  );
                  setBuilder({
                    ...builderRef.current,
                    campaignAssets: updatedAssets,
                  });
                }

                if (discoveryPlanRef.current && visionResult.labels?.length) {
                  discoveryPlanRef.current = {
                    ...discoveryPlanRef.current,
                    detectedContext: `${discoveryPlanRef.current.detectedContext}\nContexto do Produto: ${visionResult.labels.join(", ")}`,
                  };
                }
              }
            } catch (visionErr) {
              console.error(
                "Falha ao analisar imagem com a Vision API:",
                visionErr,
              );
            }

            if (!hidden) {
              const pName = productData.name
                ? "*" + productData.name + "*\n"
                : "";
              const pImg = `<img src="${productData.imageUrl}" style="max-height: 120px; border-radius: 8px; margin-top: 8px;" />\n\n`;
              appendMessage({
                id: uid(),
                role: "assistant",
                content: "✅ **Produto extraído!**\n" + pName + pImg,
              });
            }
          }
        } catch (e) {
          console.error("Scraping silenciado:", e);
        } finally {
          setLoading(false);
        }
      };

      const userMessage = { id: uid(), role: "user" as const, content: text };
      const nextMessages = isHiddenAction
        ? messages
        : [...messages, userMessage];

      if (!isHiddenAction) {
        setMessages(nextMessages);
        await maybeScrapeUrls(text);
      }

      const assistantId = uid();
      if (!isHiddenAction) {
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);
      }

      const latestHistory = useBriefflowStore.getState().messages;
      const history: ChatTurn[] = latestHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setLoading(true);

      try {
        const response = await sendToOllama(
          history,
          brandContextRef.current,
          discoveryPlanRef.current ?? builderRef.current.discoveryPlan,
          {
            intent: "discovery",
            provider,
            onStream: (partial) => {
              if (!isHiddenAction) {
                updateMessage(assistantId, { content: partial });
              }
            },
          },
        );

        useCreditsStore.getState().refresh();

        if (!isHiddenAction) {
          updateMessage(assistantId, { content: response.chat });
        }

        const currentPhase = builderRef.current.type;
        const inCampaignPhase = currentPhase === "campaign";

        if (
          response.builder.type === "discovery_plan" &&
          response.builder.discoveryPlan
        ) {
          const discoveryPlan = response.builder.discoveryPlan;
          discoveryPlanRef.current = mergeDetectedBriefContext(
            {
              ...discoveryPlanRef.current,
              ...builderRef.current.discoveryPlan,
              ...discoveryPlan,
            },
            response.detectedContext,
          );
          if (!inCampaignPhase) {
            setBuilder({
              type: "discovery_plan",
              discoveryPlan: discoveryPlanRef.current,
            });
          }
        } else {
          discoveryPlanRef.current = mergeDetectedBriefContext(
            discoveryPlanRef.current ?? builderRef.current.discoveryPlan,
            response.detectedContext,
          );
        }

        const extractedSku = discoveryPlanRef.current?.productSku;
        if (extractedSku) {
          await tryScrapeProduct(extractedSku, isHiddenAction);
        }

        const action = response.action || "discovery_continue";
        const targetKeys = response.targetKeys || ["all"];

        if (action === "generate_all") {
          await generateCampaignSafely(
            history,
            undefined,
            targetKeys,
            provider,
          );
        } else if (action.startsWith("generate_")) {
          const requestedMaterial = action.slice("generate_".length);
          if (isMaterialType(requestedMaterial)) {
            await generateCampaignSafely(
              history,
              requestedMaterial,
              targetKeys,
              provider,
            );
          }
        }
      } catch (err) {
        const description = describeAiError(err);
        toast.error("Falha ao processar", { description });
        if (!isHiddenAction) {
          updateMessage(assistantId, {
            content: `Não consegui concluir esta etapa. ${description}`,
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [
      appendMessage,
      generateCampaignSafely,
      maybeScrapeUrls,
      messages,
      setBuilder,
      setGeneratingLabel,
      setLoading,
      setMessages,
      updateMessage,
    ],
  );

  const currentChatHistory = useCallback(
    (): ChatTurn[] =>
      useBriefflowStore.getState().messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [],
  );

  const generateCampaign = useCallback(async () => {
    await generateCampaignSafely(
      currentChatHistory(),
      undefined,
      ["all"],
      "omniroute",
    );
  }, [currentChatHistory, generateCampaignSafely]);

  const regenerateChannel = useCallback(
    async (channel: CampaignChannel) => {
      await generateCampaignSafely(
        currentChatHistory(),
        channel,
        ["all"],
        "omniroute",
      );
    },
    [currentChatHistory, generateCampaignSafely],
  );

  return { handleSend, generateCampaign, regenerateChannel };
}
