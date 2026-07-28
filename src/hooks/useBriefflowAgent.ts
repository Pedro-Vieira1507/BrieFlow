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
  const raw = plan?.channels?.map((c) => c.toLowerCase()) ?? [];
  const channels: CampaignChannel[] = [];
  if (raw.some((c) => c.includes("banner"))) channels.push("banner");
  if (raw.some((c) => c.includes("email") || c.includes("mail"))) channels.push("email");
  if (raw.some((c) => c.includes("social") || c.includes("post"))) channels.push("social");
  return channels.length > 0 ? channels : ["banner", "email", "social"];
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

  // NOVA FUNÇÃO: GERAÇÃO PROGRESSIVA E SEGURA (SERIALIZADA)
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
      // NOVO: A imagem anexada manualmente pelo usuário TEM PRIORIDADE sobre o scraping automático.
      const heroImageUrl = uploadedImage || scrapedProductsRef.current[0]?.imageUrl || null;

      // Executa sequencialmente para salvar VRAM, mas atualiza a UI a cada peça pronta
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
              productImageUrl: heroImageUrl,
              scrapedProducts: scrapedProductsRef.current,
            }
          );

          const generated =
            response.builder.type === "campaign"
              ? response.builder.campaignAssets?.[0]
              : undefined;

          if (generated?.content) {
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
                },
              },
            ];
            // Atualiza a interface IMEDIATAMENTE com a peça que acabou de nascer
            patchCampaignAssets(accumulated);
            if (response.scores) setScores(response.scores);
          }
        } catch (err) {
          console.error(`Erro ao gerar ${channel}:`, err);
          hasErrors = true;
          
          // FALLBACK VISUAL: Garante que a aba seja criada mesmo com erro
          const errorContent: any = { type: channel };
          if (channel === "banner") {
            errorContent.title = "⚠️ Falha ao gerar Banner";
            errorContent.subtitle = "Timeout no servidor local.";
            errorContent.cta = "Tentar novamente";
          } else if (channel === "email") {
            errorContent.title = "⚠️ Falha ao gerar E-mail";
            errorContent.body = "A requisição excedeu o tempo limite. Tente gerar novamente.";
            errorContent.cta = "Tentar novamente";
          } else {
            errorContent.caption = "⚠️ Timeout ao gerar post. Verifique o servidor local.";
            errorContent.hashtags = ["#erro"];
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
          ? "✨ Finalizei o processo, mas ocorreu um **timeout** em algumas peças devido à sobrecarga local. Navegue pelas abas ao lado, as que deram certo já estão prontas!"
          : "✨ Campanha finalizada com sucesso! O design, copy e cores foram aplicados rigorosamente conforme o seu briefing. Navegue pelas abas ao lado para revisar.",
      });

      setGeneratingLabel(undefined);
      setLoading(false);
    },
    [appendMessage, builder, patchCampaignAssets, setGeneratingLabel, setLoading, setScores, updateMessage]
  );

  const handleSend = useCallback(
    async (text: string, isHiddenAction = false) => {
      const userMessage = { id: uid(), role: "user" as const, content: text };
      const nextMessages = isHiddenAction ? messages : [...messages, userMessage];

      if (!isHiddenAction) {
        setMessages(nextMessages);
        await maybeScrapeUrls(text);
      }

      if (/\b(aprovado|pode gerar|gera as pe[cç]as|gerar)\b/i.test(text)) {
        await generateCampaignSafely(
          nextMessages.map((m) => ({ role: m.role, content: m.content })),
        );
        return;
      }

      const assistantId = uid();
      if (!isHiddenAction) {
        setMessages([
          ...nextMessages,
          { id: assistantId, role: "assistant", content: "" },
        ]);
      }

      const history: ChatTurn[] = nextMessages.map((m) => ({
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

      async function tryScrapeProduct(skuOrUrl: string, hidden: boolean): Promise<void> {
        const value = skuOrUrl.trim();
        const isUrl = value.startsWith("http");
        let isHomepage = false;

        if (isUrl) {
          try {
            const target = new URL(value);
            if (target.pathname === "/" || target.pathname === "") isHomepage = true;
          } catch {
            /* noop */
          }
        }

        if (isHomepage) return;
        if (!isUrl && !brandContextRef.current.site?.url) return;

        setLoading(true);
        try {
          const productData: ScrapedProductData = isUrl
            ? await scrapeProductByUrlFn({ data: { url: value } })
            : await scrapeProductBySkuFn({
                data: {
                  siteUrl: brandContextRef.current.site!.url,
                  sku: value,
                },
              });

          if (productData.found) {
            scrapedProductsRef.current = [
              ...scrapedProductsRef.current,
              productData,
            ];

            if (!hidden) {
              appendMessage({
                id: uid(),
                role: "assistant",
                content: `**Produto encontrado e registrado**\n\n**Nome:** ${productData.name}\n**Preço:** ${productData.price || "N/A"}\n\n${productData.imageUrl ? `![Imagem](${productData.imageUrl})\n\n` : ""}`,
              });
            }
          } else if (!hidden) {
            appendMessage({
              id: uid(),
              role: "assistant",
              content: `A busca por **${value}** não retornou imagem/preço exatos. Pode me passar o link direto?`,
            });
          }
        } catch {
        } finally {
          setLoading(false);
        }
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