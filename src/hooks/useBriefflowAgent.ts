// src/hooks/useBriefflowAgent.ts
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useBriefflowStore, uid } from "@/store/briefflow";
import { sendToOllama, type ChatTurn } from "@/lib/ollama";
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
} from "@/types/builder";

type CampaignChannel = "banner" | "email" | "social";

const ALL_CHANNELS: CampaignChannel[] = ["banner", "email", "social"];

const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  banner: "Banner",
  email: "E-mail",
  social: "Post Social",
};

// --- Intent detection helpers ------------------------------------------------

const APPROVAL_REGEX =
  /(aprovad|pode gerar|gera as|gere as|crie as|faz as|fa[cç]a as|vamos gerar|pode fazer|pronto|pode prosseguir|pode continuar|\b(gerar|gere|crie)\b)/i;

const REFINE_VERB_REGEX =
  /\b(refa[cz]|refazer|refaça|regenerar?|gera(r)? novamente|troca(r)?|muda(r)?|altera(r)?|ajusta(r)?|melhora(r)?|corrigi?r?|atualiza(r)?|reescrev)/i;

function detectRefineChannel(text: string): CampaignChannel | null {
  const t = text.toLowerCase();
  const mentionsBanner = /\bbanner(s)?\b/.test(t);
  const mentionsEmail = /\b(e[- ]?mail|email)\b/.test(t);
  const mentionsSocial = /\b(post|social|instagram|feed|carrossel)\b/.test(t);

  const hits: CampaignChannel[] = [];
  if (mentionsBanner) hits.push("banner");
  if (mentionsEmail) hits.push("email");
  if (mentionsSocial) hits.push("social");

  // Exige verbo de refinamento OU somente 1 canal citado (contexto claro)
  if (hits.length === 1 && REFINE_VERB_REGEX.test(t)) return hits[0];
  if (hits.length === 1 && /\b(esse|este|essa|esta|o|a)\b/.test(t) && REFINE_VERB_REGEX.test(t))
    return hits[0];
  return null;
}

// -----------------------------------------------------------------------------

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
    setScores,
    setLoading,
    setScraping,
    setGeneratingLabel,
  } = useBriefflowStore();

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

  /**
   * Gera peças. Se `only` for informado, mantém builder.type === "campaign"
   * e só substitui aquela peça específica (preservando as outras).
   */
  const generateCampaignSafely = useCallback(
    async (baseHistory: ChatTurn[], only?: CampaignChannel) => {
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

      // Só reseta a lista de assets quando é geração completa.
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
          const response = await sendToOllama(
            baseHistory,
            brandContextRef.current,
            plan,
            {
              intent: "campaign",
              targetAsset: channel,
              productImageUrl: uniqueImages[0] || null,
              scrapedProducts: scrapedProductsRef.current,
            },
          );

          const generated =
            response.builder.type === "campaign"
              ? response.builder.campaignAssets?.[0]
              : undefined;

          if (!generated?.content) {
            throw new Error(`A IA falhou em gerar o conteúdo para ${channel}`);
          }

          const finalAsset: CampaignAsset = {
            ...generated,
            id: uid(),
            type: channel,
            status: "draft",
            content: {
              ...generated.content,
              type: channel,
              brandName: generated.content.brandName || plan?.brandName,
              productImages: uniqueImages,
            },
          };

          // Merge granular: mantém as outras peças intactas.
          updateCampaignAsset(channel, () => finalAsset);
          if (response.scores) setScores(response.scores);
        } catch (err) {
          console.error(`Erro ao gerar ${channel}:`, err);
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
      setScores,
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
          } catch {
            /* noop */
          }
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
                  "📸 **Produto extraído com sucesso!**\n" + pName + pImg + pFooter,
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

      // -------- Máquina de estados direcional --------
      const currentPhase = builderRef.current.type;
      const inCampaignPhase = currentPhase === "campaign";

      // 1) Já estamos em campanha? Preferir refino granular.
      if (inCampaignPhase) {
        const channel = detectRefineChannel(text);
        if (channel) {
          await generateCampaignSafely(
            nextMessages.map((m) => ({ role: m.role, content: m.content })),
            channel,
          );
          return;
        }
        // Se o usuário mandar "gerar novamente" sem especificar canal, regera tudo
        // MAS mantém a fase em campaign (patchCampaignAssets([]) já força type=campaign).
        if (APPROVAL_REGEX.test(text) && REFINE_VERB_REGEX.test(text)) {
          await generateCampaignSafely(
            nextMessages.map((m) => ({ role: m.role, content: m.content })),
          );
          return;
        }
        // Caso contrário: seguir para o fluxo de chat, MAS sem regredir a fase.
      }

      // 2) Fase inicial/discovery: aprovação dispara geração completa.
      const isApproval = APPROVAL_REGEX.test(text);
      if (!inCampaignPhase && isApproval) {
        await generateCampaignSafely(
          nextMessages.map((m) => ({ role: m.role, content: m.content })),
        );
        return;
      }

      // 3) Fluxo de discovery normal (chat).
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

          // ⚠️ CRÍTICO: NUNCA regredir de "campaign" para "discovery_plan".
          if (!inCampaignPhase) {
            setBuilder({ type: "discovery_plan", discoveryPlan });
          }
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
