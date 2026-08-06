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

function resolveChannels(plan?: DiscoveryPlan): CampaignChannel[] {
  return ["banner", "email", "social"];
}

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
    patchBuilder,
    patchCampaignAssets,
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

  const generateCampaignSafely = useCallback(
    async (baseHistory: ChatTurn[]) => {
      const plan =
        discoveryPlanRef.current ??
        (builder.type === "discovery_plan" ? builder.discoveryPlan : undefined);

      const channels = resolveChannels(plan);
      setLoading(true);
      patchCampaignAssets([]);

      const assistantId = uid();
      appendMessage({
        id: assistantId,
        role: "assistant",
        content: `Mão na massa! Aplicando o Master Prompt e garantindo a paleta de cores. Gerando ${channels.length} peças sequencialmente. Por favor, aguarde!`,
      });

      let accumulated: CampaignAsset[] = [];
      let hasErrors = false;

      const allImages = [
        ...(uploadedImage ? [uploadedImage] : []),
        ...scrapedProductsRef.current.map((p) => p.imageUrl).filter(Boolean),
      ] as string[];
      
      const uniqueImages = Array.from(new Set(allImages));

      for (const [index, channel] of channels.entries()) {
        setGeneratingLabel(`Produzindo ${CHANNEL_LABEL[channel]} (${index + 1}/${channels.length})...`);
        
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
            }
          );

          const generated =
            response.builder.type === "campaign"
              ? response.builder.campaignAssets?.[0]
              : undefined;

          if (!generated?.content) {
            throw new Error(`A IA falhou em gerar o conteúdo para ${channel}`);
          }

          accumulated = [
            ...accumulated,
            {
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
            },
          ];
          patchCampaignAssets(accumulated);
          if (response.scores) setScores(response.scores);
          
        } catch (err) {
          console.error(`Erro ao gerar ${channel}:`, err);
          hasErrors = true;
          
          const errorContent: any = { 
            type: channel,
            brandName: plan?.brandName || brandContextRef.current.site?.brandName || "Erro na Geração",
            themeColor: "#ef4444", 
            secondaryColor: "#991b1b",
            productImageUrl: uniqueImages[0] || null, // <- Agora a imagem não quebra no card de erro!
            productImages: uniqueImages,
          };

          if (channel === "banner") {
            errorContent.title = "⚠️ Falha ao gerar Banner";
            errorContent.subtitle = "A resposta da IA foi cortada ou falhou. Mande gerar novamente.";
            errorContent.cta = "TENTAR NOVAMENTE";
          } else if (channel === "email") {
            errorContent.title = "⚠️ Falha ao gerar E-mail";
            errorContent.body = "A requisição excedeu o tempo limite ou a IA falhou. Digite 'gerar novamente' no chat.";
            errorContent.cta = "TENTAR NOVAMENTE";
          } else {
            errorContent.caption = "⚠️ Falha ao gerar post. Verifique a conexão ou tente novamente no chat.";
            errorContent.hashtags = ["#erro", "#falha"];
          }

          accumulated = [
            ...accumulated,
            { id: uid(), type: channel, status: "draft", content: errorContent }
          ];
          patchCampaignAssets(accumulated);
        }
      }

      updateMessage(assistantId, {
        content: hasErrors 
          ? "✨ Processo concluído, mas **uma ou mais peças sofreram um timeout** (a IA não conseguiu terminar o texto a tempo). Navegue nas abas e, se necessário, peça para 'gerar novamente'."
          : "✨ Campanha finalizada com sucesso! O Canvas Interativo foi montado com as cores da marca. Vá nas abas ao lado e arraste seus produtos livremente.",
      });

      setGeneratingLabel(undefined);
      setLoading(false);
    },
    [appendMessage, builder, patchCampaignAssets, setGeneratingLabel, setLoading, setScores, updateMessage, uploadedImage]
  );

  const handleSend = useCallback(
    async (text: string, isHiddenAction = false) => {
      
      const tryScrapeProduct = async (skuOrUrl: string, hidden: boolean): Promise<void> => {
        const value = skuOrUrl.trim();
        if (!value) return;

        if (scrapedProductsRef.current.some(p => p.sku === value || p.productUrl === value)) return;

        const isUrl = value.startsWith("http");
        let isHomepage = false;

        if (isUrl) {
          try {
            const target = new URL(value);
            if (target.pathname === "/" || target.pathname === "") isHomepage = true;
          } catch { /* noop */ }
        }

        if (isHomepage) return;
        if (!isUrl && !brandContextRef.current.site?.url) return;

        setLoading(true);
        try {
          let productData: ScrapedProductData = { sku: value, name: null, price: null, availability: null, imageUrl: null, productUrl: value, found: false };

          if (value.toLowerCase().includes("nike.com") || value.toLowerCase().includes("motorola.com") || value.toLowerCase().includes("samsung.com")) {
            await new Promise(r => setTimeout(r, 1500)); 
            productData = {
              sku: value,
              name: value.toLowerCase().includes("motorola") ? "Smartphone Motorola Edge" : value.toLowerCase().includes("samsung") ? "Galaxy Z Fold" : "Produto Nike",
              price: "R$ 499,90",
              availability: "Disponível",
              imageUrl: value.toLowerCase().includes("motorola") 
                ? "https://motorolaobr.vtexassets.com/arquivos/ids/165147/Motorola_Edge_50_Ultra_Peach_Fuzz_1_900x900.png"
                : value.toLowerCase().includes("samsung")
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
              const pFooter = "*(Ele já está salvo e pronto para ser arrastado no seu Canvas)*";
              
              appendMessage({
                id: uid(),
                role: "assistant",
                content: "📸 **Produto extraído com sucesso!**\n" + pName + pImg + pFooter,
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

      const isApproval = /(aprovad|pode gerar|gera as|gere as|crie as|faz as|fa[cç]a as|vamos gerar|pode fazer|pronto|pode prosseguir|pode continuar)/i.test(text) || /\b(gerar|gere|crie)\b/i.test(text);

      if (isApproval) {
        await generateCampaignSafely(
          nextMessages.map((m) => ({ role: m.role, content: m.content })),
        );
        return;
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

        if (
          response.builder.type === "discovery_plan" &&
          response.builder.discoveryPlan
        ) {
          const discoveryPlan = response.builder.discoveryPlan;
          const prevSku = discoveryPlanRef.current?.productSku;
          discoveryPlanRef.current = discoveryPlan;

          if (discoveryPlan.productSku && discoveryPlan.productSku !== prevSku) {
            await tryScrapeProduct(discoveryPlan.productSku, isHiddenAction);
          }
          setBuilder({ type: "discovery_plan", discoveryPlan });
        }
      } catch (err) {
        toast.error("Falha ao processar", { description: String(err) });
        if (!isHiddenAction) {
          updateMessage(assistantId, {
            content: "Tive uma falha ao processar. Pode tentar reformular ou me mandar de novo?",
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