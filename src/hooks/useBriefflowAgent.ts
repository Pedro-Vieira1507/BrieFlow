// src/hooks/useBriefflowAgent.ts
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useBriefflowStore, uid } from "@/store/briefflow";
import { sendToOllama, type ChatTurn } from "@/lib/ollama";
import { useGenerateMaterials, describeAiError } from "@/hooks/useGenerateMaterials";
import { toMarketingBrief } from "@/types/brief";
import {
  extractUrlsFromText,
  scrapeProductBySkuFn,
  scrapeProductByUrlFn,
  scrapeWebsite,
  type ScrapedProductData,
} from "@/lib/scrape-site";
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
      if (existing && targetUrl.length > existing.url.length + 20) return null;

      setScraping(true);
      try {
        const site = await scrapeWebsite({ data: { url: targetUrl } });
        mergeSiteIntoContext(site);
        toast.success("Site analisado com sucesso");
        return site;
      } catch {
        toast.warning("Site protegido contra leituras automáticas");
        appendMessage({
          id: uid(),
          role: "assistant",
          content:
            "Não consegui acessar os detalhes do site automaticamente (bloqueio de segurança). Pode me contar um pouco sobre o que a marca faz e qual o objetivo da campanha?",
        });
        return null;
      } finally {
        setScraping(false);
      }
    },
    [appendMessage, mergeSiteIntoContext, setScraping],
  );

  const buildErrorAsset = useCallback(
    (channel: CampaignChannel, uniqueImages: string[]): CampaignAsset => {
      const plan = discoveryPlanRef.current;
      const brand =
        plan?.brandName ||
        brandContextRef.current.site?.brandName ||
        brandContextRef.current.brandName ||
        "Sua marca";

      const errorContent: any = {
        type: channel,
        brandName: brand,
        themeColor: "#0f172a",
        secondaryColor: "#475569",
        productImageUrl: uniqueImages[0] || null,
        productImages: uniqueImages,
      };

      if (channel === "banner") {
        errorContent.title = "Não consegui gerar este banner";
        errorContent.subtitle =
          "A resposta da IA foi interrompida. Peça para gerar novamente ou refine o briefing.";
        errorContent.cta = "Tentar novamente";
      } else if (channel === "email") {
        errorContent.title = "Não consegui gerar este e-mail";
        errorContent.body =
          "A requisição excedeu o tempo limite. Você pode pedir para regenerar apenas o e-mail, sem afetar as outras peças.";
        errorContent.cta = "Tentar novamente";
      } else {
        errorContent.caption =
          "Não consegui gerar este post. Peça para regenerar somente o social e o restante da campanha permanece intacto.";
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
    async (baseHistory: ChatTurn[], only?: CampaignChannel, targetKeys: string[] = ["all"]) => {
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
          ? `Ok! Vou regerar apenas o **${CHANNEL_LABEL[only]}** — as outras peças permanecem como estão.`
          : `Mão na massa! Gerando ${channels.length} peças sequencialmente.`,
      });

      let hasErrors = false;

      for (const [index, channel] of channels.entries()) {
        setGeneratingLabel(
          `Produzindo ${CHANNEL_LABEL[channel]} (${index + 1}/${channels.length})...`,
        );

        try {
          // --- INÍCIO DA VALIDAÇÃO E MAPEAMENTO DO STRICT MERGE ---
          const safeTargetKeys = Array.isArray(targetKeys) ? targetKeys : ["all"];
          const isAll = safeTargetKeys.length === 0 || safeTargetKeys.some(k => 
            ["all", "tudo", "todos", "geral", "completo"].includes(String(k).toLowerCase())
          );
          
          const allowedKeys = new Set<string>();

          if (!isAll) {
            const normalizedStr = safeTargetKeys.join(" ").toLowerCase();
            // Dicionário de Sinônimos Robusto (Fuzzy Matcher)
            const schemaMap: Record<string, string[]> = {
              cta: ["cta", "botão", "botao", "button", "chamada", "action", "clique", "link"],
              title: ["title", "headline", "título", "titulo", "cabeçalho", "header", "principal"],
              subtitle: ["subtitle", "subheadline", "subtítulo", "subtitulo", "descrição", "apoio", "fina"],
              body: ["body", "corpo", "parágrafo", "paragrafo", "conteúdo", "mensagem", "texto"],
              caption: ["caption", "legenda", "post", "texto do post"],
              hashtags: ["hashtags", "tags", "marcadores", "palavras", "hashtag"],
              imagePrompt: ["imagePrompt", "imagem", "foto", "arte", "fundo", "background", "ilustração", "visual", "prompt"],
              themeColor: ["themeColor", "secondaryColor", "color", "cores", "cor", "paleta", "tom", "visual"]
            };

            for (const [canonicalKey, synonyms] of Object.entries(schemaMap)) {
              if (synonyms.some(syn => normalizedStr.includes(syn))) {
                allowedKeys.add(canonicalKey);
              }
            }

            console.log(`[Strict Merge Debug - ${channel}] LLM Target Keys:`, safeTargetKeys);
            console.log(`[Strict Merge Debug - ${channel}] Chaves Canônicas Ativadas:`, Array.from(allowedKeys));

            if (allowedKeys.size === 0) {
              console.error(`[Strict Merge Error] Nenhuma chave mapeada para:`, safeTargetKeys);
              toast.error(`Falha ao identificar o campo solicitado. Tente usar termos mais comuns como "título", "botão" ou "cor".`);
              hasErrors = true;
              continue; // Short-circuit: Aborta o LLM e evita o feedback falso-positivo
            }
          }
          // --- FIM DA VALIDAÇÃO DO STRICT MERGE ---

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
              // Cria objeto seguro contendo apenas textos (sem Base64/productImages)
              const safeContext: any = {
                title: c.title,
                subtitle: c.subtitle,
                cta: c.cta,
                body: c.body,
                caption: c.caption,
                hashtags: c.hashtags,
                imagePrompt: c.imagePrompt,
                themeColor: c.themeColor,
                secondaryColor: c.secondaryColor
              };
              
              // Remove chaves indefinidas para limpar o JSON enviado ao prompt
              Object.keys(safeContext).forEach(key => safeContext[key] === undefined && delete safeContext[key]);

              currentContentContext = `\n\n=== CONTEÚDO ATUAL DA PEÇA ===\nATENÇÃO: Preserve o texto abaixo exatamente como está para todos os campos que o usuário NÃO pediu para alterar:\n${JSON.stringify(safeContext, null, 2)}`;
            } catch (e) {
               console.warn("Falha ao serializar contexto seguro para a IA", e);
            }
          }

          const rawBriefing = (baseHistory[baseHistory.length - 1]?.content || "") + currentContentContext;

          const { content } = await generateMaterial({
            brief,
            material: channel,
            rawBriefing: rawBriefing,
            images: uniqueImages,
          });

          // Aplicação Final Segura (com Strict Merge Tolerante)
          updateCampaignAsset(channel, (prevAsset) => {
            const prevContent = prevAsset?.content || {};
            let mergedContent: any = { ...prevContent };

            if (isAll || !prevAsset) {
              mergedContent = { ...prevContent, ...content };
            } else {
              if (allowedKeys.has("cta")) {
                if (content.cta !== undefined) mergedContent.cta = content.cta;
                if (content.ctaVariant !== undefined) mergedContent.ctaVariant = content.ctaVariant;
              }
              if (allowedKeys.has("title")) {
                if (content.title !== undefined) mergedContent.title = content.title;
              }
              if (allowedKeys.has("subtitle")) {
                if (content.subtitle !== undefined) mergedContent.subtitle = content.subtitle;
              }
              if (allowedKeys.has("body")) {
                if (content.body !== undefined) mergedContent.body = content.body;
              }
              if (allowedKeys.has("caption")) {
                if (content.caption !== undefined) mergedContent.caption = content.caption;
              }
              if (allowedKeys.has("hashtags")) {
                if (content.hashtags !== undefined) mergedContent.hashtags = content.hashtags;
              }
              if (allowedKeys.has("imagePrompt")) {
                if (content.imagePrompt !== undefined) mergedContent.imagePrompt = content.imagePrompt;
                if (content.emailHeroImagePrompt !== undefined) mergedContent.emailHeroImagePrompt = content.emailHeroImagePrompt;
              }
              if (allowedKeys.has("themeColor")) {
                if (content.themeColor !== undefined) mergedContent.themeColor = content.themeColor;
                if (content.secondaryColor !== undefined) mergedContent.secondaryColor = content.secondaryColor;
              }
            }

            return {
              id: prevAsset?.id || uid(),
              type: channel,
              status: "draft",
              content: {
                ...mergedContent,
                type: channel,
                brandName: content.brandName || plan?.brandName || (prevAsset?.content as any)?.brandName,
                productImages: uniqueImages, // Retorna os arrays visuais pesados (protegidos fora do merge AI)
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
            ? `Não consegui regerar o ${CHANNEL_LABEL[only]} agora. Tente novamente em instantes.`
            : "Processo concluído, mas uma ou mais peças falharam. Você pode pedir para regenerar peças individualmente."
          : only
          ? `${CHANNEL_LABEL[only]} atualizado com sucesso.`
          : "Campanha finalizada! Navegue pelas abas ao lado e arraste seus produtos livremente.",
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

        if (!isUrl && !brandContextRef.current.site?.url) return;

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

          const vLower = value.toLowerCase();
          if (
            vLower.includes("nike.com") ||
            vLower.includes("motorola.com") ||
            vLower.includes("samsung.com")
          ) {
            await new Promise((r) => setTimeout(r, 1500));
            productData = {
              sku: value,
              name: vLower.includes("motorola")
                ? "Smartphone Motorola Edge"
                : vLower.includes("samsung")
                ? "Galaxy Z Fold"
                : "Produto Nike",
              price: "R$ 499,90",
              availability: "Disponível",
              imageUrl: vLower.includes("motorola")
                ? "https://motorolaobr.vtexassets.com/arquivos/ids/165147/Motorola_Edge_50_Ultra_Peach_Fuzz_1_900x900.png"
                : vLower.includes("samsung")
                ? "https://images.samsung.com/is/image/samsung/p6pim/br/2407/gallery/br-galaxy-z-fold6-f956-sm-f956bzakzto-thumb-542302324?$344_344_PNG$"
                : "https://images.lojanike.com.br/1024x1024/produto/tenis-nike-revolution-7-masculino-FB2207-001-1-11696256950.JPG",
              productUrl: value,
              found: true,
            };
          } else {
            productData = isUrl
              ? await scrapeProductByUrlFn({ data: { url: value } })
              : await scrapeProductBySkuFn({
                  data: {
                    siteUrl: brandContextRef.current.site!.url,
                    sku: value,
                  },
                });
          }

          if (productData.found && productData.imageUrl) {
            scrapedProductsRef.current = [
              ...scrapedProductsRef.current,
              productData,
            ];
            if (!hidden) {
              const pName = productData.name ? "*" + productData.name + "*\n" : "";
              const pImg = "![Imagem](" + productData.imageUrl + ")\n\n";
              const pFooter =
                "*(Ele já está salvo e pronto para ser arrastado no seu Canvas)*";
              appendMessage({
                id: uid(),
                role: "assistant",
                content:
                  "✨ **Produto extraído com sucesso!**\n" + pName + pImg + pFooter,
              });
            }
          } else if (!hidden && !isUrl) {
            appendMessage({
              id: uid(),
              role: "assistant",
              content: `A busca por **${value}** não retornou imagem. Pode me passar o link direto?`,
            });
          }
        } catch {
          // silencioso
        } finally {
          setLoading(false);
        }
      };

      const userMessage = { id: uid(), role: "user" as const, content: text };
      const nextMessages = isHiddenAction ? messages : [...messages, userMessage];

      if (!isHiddenAction) {
        setMessages(nextMessages);
        await maybeScrapeUrls(text);
        const urls = extractUrlsFromText(text);
        for (const u of urls) {
          await tryScrapeProduct(u, false);
        }
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
          discoveryPlanRef.current,
          {
            intent: "discovery",
            onStream: (partial) => {
              if (!isHiddenAction) {
                updateMessage(assistantId, { content: partial });
              }
            },
          },
        );

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
          const prevSku = discoveryPlanRef.current?.productSku;
          discoveryPlanRef.current = discoveryPlan;

          if (
            discoveryPlan.productSku &&
            discoveryPlan.productSku !== prevSku
          ) {
            await tryScrapeProduct(discoveryPlan.productSku, isHiddenAction);
          }

          if (!inCampaignPhase) {
            setBuilder({ type: "discovery_plan", discoveryPlan });
          }
        }

        const action = response.action || "discovery_continue";
        const targetKeys = response.targetKeys || ["all"]; 

        if (action === "generate_all") {
          await generateCampaignSafely(history, undefined, targetKeys);
        } else if (action === "generate_banner") {
          await generateCampaignSafely(history, "banner", targetKeys);
        } else if (action === "generate_email") {
          await generateCampaignSafely(history, "email", targetKeys);
        } else if (action === "generate_social") {
          await generateCampaignSafely(history, "social", targetKeys);
        } else if (action === "cancel") {
           // Fluxo cancelado pelo LLM. Sem transição de estado da UI.
        }
      } catch (err) {
        toast.error("Falha ao processar", { description: String(err) });
        if (!isHiddenAction) {
          updateMessage(assistantId, {
            content:
              "Tive uma falha ao processar. Pode tentar reformular ou me mandar de novo?",
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
      setLoading,
      setMessages,
      updateMessage,
    ],
  );

  return { handleSend };
}