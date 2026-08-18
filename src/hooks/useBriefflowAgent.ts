// src/hooks/useBriefflowAgent.ts
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useBriefflowStore, uid } from "@/store/briefflow";
import { sendToOllama, type ChatTurn } from "@/lib/ollama";
import { useGenerateMaterials, describeAiError } from "@/hooks/useGenerateMaterials";
import { toMarketingBrief } from "@/types/brief";
import { useCreditsStore } from "@/hooks/useCredits";
import {
  extractUrlsFromText,
  scrapeProductBySkuFn,
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

type CampaignChannel = "banner" | "email" | "social";
const ALL_CHANNELS: CampaignChannel[] = ["banner", "email", "social"];
const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  banner: "Banner",
  email: "E-mail",
  social: "Post Social",
};

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
    enqueueOllama,
    dequeueOllama,
  } = useBriefflowStore();

  const { generateMaterial } = useGenerateMaterials();

  const discoveryPlanRef = useRef<DiscoveryPlan | undefined>(undefined);
  const scrapedProductsRef = useRef<ScrapedProductData[]>([]);

  const brandContextRef = useRef(brandContext);
  brandContextRef.current = brandContext;

  const builderRef = useRef(builder);
  builderRef.current = builder;

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
    (channel: CampaignChannel, productImages: string[]): CampaignAsset => {
      const errorContent: BuilderState = {
        type: channel,
        productImages,
      } as BuilderState;

      if (channel === "banner") {
        errorContent.title = "Não consegui gerar este banner";
        errorContent.subtitle = "A resposta da IA foi interrompida. Peça para gerar novamente.";
        errorContent.cta = "Tentar novamente";
      } else if (channel === "email") {
        errorContent.title = "Não consegui gerar este e-mail";
        errorContent.body = "A requisição excedeu o tempo limite. Tente novamente.";
        errorContent.cta = "Tentar novamente";
      } else {
        errorContent.caption = "Não consegui gerar este post. Peça para regenerar.";
        errorContent.hashtags = [];
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
    async (baseHistory: ChatTurn[], only?: CampaignChannel, targetKeys: string[] = ["all"], provider: "ollama" | "omniroute" = "omniroute") => {
      const plan =
        discoveryPlanRef.current ??
        (builderRef.current.type === "discovery_plan"
          ? builderRef.current.discoveryPlan
          : undefined);

      const channels: CampaignChannel[] = only ? [only] : ALL_CHANNELS;

      setLoading(true);

      const allImages = [
        ...(uploadedImage ? [uploadedImage] : []),
        ...scrapedProductsRef.current.map((p) => p.imageUrl).filter(Boolean),
      ] as string[];

      const uniqueImages = Array.from(new Set(allImages));

      if (!only) {
        patchCampaignAssets([]);
      }

      const assistantId = uid();
      appendMessage({
        id: assistantId,
        role: "assistant",
        content: only
          ? `Ok! Vou regerar apenas o **${CHANNEL_LABEL[only]}** – as outras peças permanecem como estão.`
          : `Mão na massa! Gerando ${channels.length} peças sequencialmente.`,
      });

      let hasErrors = false;

      for (const [index, channel] of channels.entries()) {
        setGeneratingLabel(
          `Produzindo ${CHANNEL_LABEL[channel]} (${index + 1}/${channels.length})...`,
        );

        try {
          const safeTargetKeys = Array.isArray(targetKeys) ? targetKeys : ["all"];
          const isAll = safeTargetKeys.length === 0 || safeTargetKeys.some(k =>
              ["all", "tudo", "todos", "geral", "completo"].includes(String(k).toLowerCase())
          );

          const allowedKeys = new Set<string>();

          if (!isAll) {
            const normalizedStr = safeTargetKeys.join(" ").toLowerCase();
            const schemaMap: Record<string, string[]> = {
              cta: ["cta", "botão", "botao", "button", "chamada", "action", "clique", "link"],
              title: ["title", "headline", "título", "titulo", "cabeçalho", "header", "principal"],
              subtitle: ["subtitle", "subheadline", "subtítulo", "subtitulo", "descrição", "apoio", "final"],
              body: ["body", "corpo", "parágrafo", "paragrafo", "conteúdo", "mensagem", "texto"],
              caption: ["caption", "legenda", "post", "texto do post"],
              hashtags: ["hashtags", "tags", "marcadores", "palavras", "hashtag"],
              imagePrompt: ["imagePrompt", "imagem", "foto", "arte", "fundo", "background", "ilustração", "visual", "prompt"],
              themeColor: ["themeColor", "secondaryColor", "color", "cores", "cor", "paleta", "tom", "visual"],
              heroBadge: ["heroBadge", "badge", "selo", "tag"],
              badgePrimary: ["badgePrimary", "badge", "selo", "destaque", "desconto", "oferta"],
              badgeSecondary: ["badgeSecondary", "badge secundário", "selo secundário"],
            };

            for (const [canonicalKey, synonyms] of Object.entries(schemaMap)) {
              if (synonyms.some(syn => normalizedStr.includes(syn))) {
                allowedKeys.add(canonicalKey);
              }
            }
          }

          const brief = toMarketingBrief({
            brandContext: brandContextRef.current,
            plan,
            product: {
              productUrl: scrapedProductsRef.current[0]?.productUrl ?? null,
              productImageUrl: uniqueImages[0] ?? null,
              productTitle: scrapedProductsRef.current[0]?.name ?? null,
            },
            availableImageUrls: uniqueImages,
          });

          const existingAsset = builderRef.current.type === "campaign"
              ? builderRef.current.campaignAssets?.find((a) => a.type === channel)
              : undefined;

          let currentContentContext = "";

          if (existingAsset?.content) {
            try {
              const c = existingAsset.content as any;
              const safeContext: any = {
                title: c.title,
                subtitle: c.subtitle,
                cta: c.cta,
                body: c.body,
                caption: c.caption,
                hashtags: c.hashtags,
                imagePrompt: c.imagePrompt,
                themeColor: c.themeColor,
                secondaryColor: c.secondaryColor,
              };
              currentContentContext = `\n\n=== CONTEÚDO ATUAL DA PEÇA ===\nATENÇÃO: Preserve o texto abaixo exatamente como está para todos os campos que o usuário NÃO pediu para alterar:\n${JSON.stringify(safeContext, null, 2)}`;
            } catch (e) {
              console.warn("Falha ao serializar contexto seguro para a IA", e);
            }
          }

          const recentUserBriefing = baseHistory
            .filter((m) => m.role === "user")
            .slice(-4)
            .map((m) => m.content)
            .join("\n\n---\n\n");

          const rawBriefing = recentUserBriefing + currentContentContext;

          const { content } = await generateMaterial({
            brief,
            material: channel,
            rawBriefing: rawBriefing,
            images: uniqueImages,
            provider,
          });

          updateCampaignAsset(channel, (prevAsset) => {
            const prevContent = prevAsset?.content || {};
            let mergedContent: any = { ...prevContent };

            if (isAll || !prevAsset) {
              mergedContent = { ...prevContent, ...content };
            } else {
              if (allowedKeys.has("cta") && content.cta !== undefined) mergedContent.cta = content.cta;
              if (allowedKeys.has("title") && content.title !== undefined) mergedContent.title = content.title;
              if (allowedKeys.has("subtitle") && content.subtitle !== undefined) mergedContent.subtitle = content.subtitle;
              if (allowedKeys.has("imagePrompt") && content.imagePrompt !== undefined) mergedContent.imagePrompt = content.imagePrompt;
              if (allowedKeys.has("themeColor") && content.themeColor !== undefined) mergedContent.themeColor = content.themeColor;
              if (allowedKeys.has("badgePrimary") && content.badgePrimary !== undefined) mergedContent.badgePrimary = content.badgePrimary;
              if (allowedKeys.has("badgeSecondary") && content.badgeSecondary !== undefined) mergedContent.badgeSecondary = content.badgeSecondary;
            }

            return {
              id: prevAsset?.id || uid(),
              type: channel,
              status: "draft",
              content: {
                ...mergedContent,
                type: channel,
                brandName: content.brandName || plan?.brandName || (prevAsset?.content as any)?.brandName,
                productImages: uniqueImages,
              },
            };
          });

        } catch (err) {
          console.error(`Erro ao gerar ${channel}:`, describeAiError(err), err);
          hasErrors = true;
          updateCampaignAsset(channel, () =>
            buildErrorAsset(channel, uniqueImages),
          );
        }
      }

      updateMessage(assistantId, {
        content: hasErrors
          ? only
            ? `Não consegui regerar o ${CHANNEL_LABEL[only]} agora. Tente novamente.`
            : "Processo concluído, mas uma ou mais peças falharam. Você pode pedir para regenerar."
          : only
          ? `${CHANNEL_LABEL[only]} atualizado com sucesso.`
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
      const currentPlan = useCreditsStore.getState().plan?.plan || "free";
      const isPro = currentPlan === "pro" || currentPlan === "agency";
      const provider = isPro ? "omniroute" : "ollama";

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
          } catch { /* noop */ }
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

          // --- BUSCA VISUAL BLINDADA NO SERVIDOR ---
          if (!productData.imageUrl && !isUrl) {
            setGeneratingLabel(`Buscando foto oficial para: ${value}...`);
            
            try {
              // Passando com a embalagem { data: { query } } porque criamos a função de servidor com validadores de volta!
              const visualResult = await visualSearchFn({ data: { query: value } });
              
              if (visualResult.found && visualResult.imageUrl) {
                productData.imageUrl = visualResult.imageUrl;
                productData.found = true;
                productData.name = productData.name || value;
              }
              
              if (visualResult.error) {
                appendMessage({
                  id: uid(),
                  role: "assistant",
                  content: `⚠️ **Aviso:** ${visualResult.error}`
                });
              }
            } catch (visualErr) {
               console.error("Erro fatal na busca visual:", visualErr);
            }
            
            setGeneratingLabel(undefined);
          }
          // -------------------------------------------------------------

          if (productData.found && productData.imageUrl) {
            scrapedProductsRef.current = [
              ...scrapedProductsRef.current,
              productData,
            ];

            if (!hidden) {
              const pName = productData.name ? "*" + productData.name + "*\n" : "";
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
      const nextMessages = isHiddenAction ? messages : [...messages, userMessage];

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
      const ticketId = uid();

      if (!isPro) {
        await enqueueOllama(ticketId);
      }

      try {
        const response = await sendToOllama(
          history,
          brandContextRef.current,
          discoveryPlanRef.current,
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

        const extractedSku = response.detectedContext?.productSku || response.builder.discoveryPlan?.productSku;
        
        if (extractedSku && extractedSku !== discoveryPlanRef.current?.productSku) {
          discoveryPlanRef.current = {
            ...(discoveryPlanRef.current || { detectedContext: "", missingInfo: "", proposedStrategy: "" }),
            ...response.detectedContext,
            productSku: extractedSku,
          } as DiscoveryPlan;
          
          await tryScrapeProduct(extractedSku, isHiddenAction);
        }

        const currentPhase = builderRef.current.type;
        const inCampaignPhase = currentPhase === "campaign";

        if (
          response.builder.type === "discovery_plan" &&
          response.builder.discoveryPlan
        ) {
          const discoveryPlan = response.builder.discoveryPlan;
          discoveryPlanRef.current = { ...discoveryPlanRef.current, ...discoveryPlan };

          if (!inCampaignPhase) {
            setBuilder({ type: "discovery_plan", discoveryPlan: discoveryPlanRef.current });
          }
        }

        const action = response.action || "discovery_continue";
        const targetKeys = response.targetKeys || ["all"];

        if (action === "generate_all") {
          await generateCampaignSafely(history, undefined, targetKeys, provider);
        } else if (action === "generate_banner") {
          await generateCampaignSafely(history, "banner", targetKeys, provider);
        } else if (action === "generate_email") {
          await generateCampaignSafely(history, "email", targetKeys, provider);
        } else if (action === "generate_social") {
          await generateCampaignSafely(history, "social", targetKeys, provider);
        }
      } catch (err) {
        toast.error("Falha ao processar", { description: String(err) });
        if (!isHiddenAction) {
          updateMessage(assistantId, {
            content: "Tive uma falha ao processar. Pode tentar reformular?",
          });
        }
      } finally {
        if (!isPro) {
          await dequeueOllama(ticketId);
        }
        setLoading(false);
      }
    },
    [
      appendMessage,
      generateCampaignSafely,
      maybeScrapeUrls,
      messages,
      setBuilder,
      setLoading,
      setMessages,
      updateMessage,
      enqueueOllama,
      dequeueOllama,
    ],
  );

  return { handleSend };
}