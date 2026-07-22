import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ChatPanel, type ChatMessage } from "@/components/briefflow/ChatPanel";
import { PageBuilder } from "@/components/briefflow/PageBuilder";
import { sendToOllama, type ChatTurn } from "@/lib/ollama";
import { extractUrlsFromText, scrapeWebsite, scrapeProductBySkuFn, scrapeProductByUrlFn, type ScrapedProductData } from "@/lib/scrape-site";
import type { BrandContext, BuilderState, CampaignAsset, DiscoveryPlan, SiteBrandData } from "@/types/builder";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: Home });

type CampaignChannel = "banner" | "email" | "social";

function uid() { return Math.random().toString(36).slice(2, 10); }

function resolveChannels(plan?: DiscoveryPlan): CampaignChannel[] {
  const raw = plan?.channels?.map((channel) => channel.toLowerCase()) ?? [];
  const channels: CampaignChannel[] = [];
  if (raw.some((c) => c.includes("banner"))) channels.push("banner");
  if (raw.some((c) => c.includes("email") || c.includes("mail"))) channels.push("email");
  if (raw.some((c) => c.includes("social") || c.includes("post"))) channels.push("social");
  return channels.length > 0 ? channels : ["banner", "email", "social"];
}

function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [builder, setBuilder] = useState<BuilderState>({ type: "none" });
  const [scores, setScores] = useState<{ persuasion: number; clarity: number; seo: number; } | undefined>();
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState<string | undefined>();
  const [brandContext, setBrandContext] = useState<BrandContext>({
    persona: "Público-alvo", tone: "Premium", framework: "AIDA",
  });

  const discoveryPlanRef = useRef<DiscoveryPlan | undefined>(undefined);
  const brandContextRef = useRef(brandContext);
  brandContextRef.current = brandContext;
  const scrapedProductsRef = useRef<ScrapedProductData[]>([]);

  const mergeSiteIntoContext = (site: SiteBrandData) => {
    setBrandContext((previous) => {
      const next: BrandContext = {
        ...previous,
        brandName: site.brandName || previous.brandName,
        site,
        persona: previous.persona === "Público-alvo" ? `Público da marca ${site.brandName}` : previous.persona,
      };
      brandContextRef.current = next;
      return next;
    });
  };

  const maybeScrapeUrls = async (text: string): Promise<SiteBrandData | null> => {
    const urls = extractUrlsFromText(text);
    if (urls.length === 0) return null;
    const targetUrl = urls[0];
    
    if (brandContextRef.current.site && targetUrl.length > brandContextRef.current.site.url.length + 20) {
      return null;
    }
    
    setScraping(true);
    try {
      const site = await scrapeWebsite({ data: { url: targetUrl } });
      mergeSiteIntoContext(site);
      toast.success(`Site analisado com sucesso!`);
      return site;
    } catch (error) {
      // UX MELHORIA: Fallback Graceful quando o scraper falha (ex: bloqueio de CORS/WAF do site)
      toast.warning("Site protegido contra leituras automáticas.");
      setMessages((prev) => [...prev, { 
        id: uid(), role: "assistant", 
        content: `⚠️ Não consegui acessar os detalhes do site automaticamente (bloqueio de segurança). Pode me contar um pouco sobre o que a marca faz e qual o objetivo da campanha?` 
      }]);
      return null;
    } finally {
      setScraping(false);
    }
  };

  const generateCampaignSequentially = async (baseHistory: ChatTurn[]) => {
    const plan = discoveryPlanRef.current ?? (builder.type === "discovery_plan" ? builder.discoveryPlan : undefined);
    const channels = resolveChannels(plan);
    const steps = channels.map((type) => ({ type, label: type === 'banner' ? 'Banner' : type === 'email' ? 'E-mail' : 'Post' }));

    let currentHistory = [...baseHistory];
    let accumulatedAssets: CampaignAsset[] = [];

    setLoading(true);
    setBuilder((p) => ({ ...p, type: "campaign", campaignAssets: [] }));

    try {
      for (const [index, step] of steps.entries()) {
        const assistantId = uid();
        setGeneratingLabel(`Criando design e copy para ${step.label}...`);
        
        const prompt = `Aprovado. Como Diretor de Arte, ESCOLHA as cores e crie o design e a copy do ${step.label} premium da campanha.`;
        
        setMessages((prev) => [
          ...prev,
          ...(index > 0 ? [{ id: uid(), role: "user" as const, content: prompt }] : []),
          { id: assistantId, role: "assistant" as const, content: `Gerando ${step.label} premium...` },
        ]);
        currentHistory = [...currentHistory, { role: "user", content: prompt }];

        try {
          const heroImageUrl = scrapedProductsRef.current.length > 0 ? scrapedProductsRef.current[0].imageUrl : null;
          
          const response = await sendToOllama(currentHistory, brandContextRef.current, plan, {
            intent: "campaign", targetAsset: step.type, productImageUrl: heroImageUrl, scrapedProducts: scrapedProductsRef.current
          });

          const generatedAsset = response.builder.type === "campaign" ? response.builder.campaignAssets?.[0] : undefined;
          if (generatedAsset?.content) {
            accumulatedAssets = [...accumulatedAssets, {
              ...generatedAsset, id: uid(), type: step.type, status: "draft",
              content: { ...generatedAsset.content, type: step.type, brandName: generatedAsset.content.brandName || plan?.brandName },
            }];
            setBuilder((p) => ({ ...p, type: "campaign", campaignAssets: accumulatedAssets }));
            if (response.scores) setScores(response.scores);
          }

          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: response.chat || `Peça gerada.` } : m));
          currentHistory = [...currentHistory, { role: "assistant", content: response.chat || "Peça gerada." }];
        } catch (err) {
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `Falha: ${err}` } : m));
        }
      }
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: "✨ Campanha Finalizada! Escolhi o layout ideal e as cores para sua marca. Navegue pelas abas ao lado." }]);
    } finally {
      setGeneratingLabel(undefined);
      setLoading(false);
    }
  };

  const handleSend = async (text: string, isHiddenAction = false) => {
    const userMessage: ChatMessage = { id: uid(), role: "user", content: text };
    const nextMessages = isHiddenAction ? messages : [...messages, userMessage];

    if (!isHiddenAction) {
      setMessages(nextMessages);
      await maybeScrapeUrls(text);
    }

    if (/\b(aprovado|pode gerar|gera as pe[cç]as|gerar)\b/i.test(text)) {
      await generateCampaignSequentially(nextMessages.map((m) => ({ role: m.role, content: m.content })));
      return;
    }

    const assistantId = uid();
    if (!isHiddenAction) setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "" }]);

    const history: ChatTurn[] = nextMessages.map((m) => ({ role: m.role, content: m.content }));

    setLoading(true);
    try {
      const response = await sendToOllama(history, brandContextRef.current, discoveryPlanRef.current, {
        intent: "discovery",
        onStream: (partial) => {
          if (!isHiddenAction) setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: partial } : m));
        },
      });

      if (!isHiddenAction) setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: response.chat } : m));

      if (response.builder.type === "discovery_plan" && response.builder.discoveryPlan) {
        const discoveryPlan = response.builder.discoveryPlan;
        const prevSku = discoveryPlanRef.current?.productSku; 
        discoveryPlanRef.current = discoveryPlan;

        if (discoveryPlan.productSku && discoveryPlan.productSku !== prevSku) {
          const skuOrUrl = discoveryPlan.productSku.trim();
          const isUrl = skuOrUrl.startsWith("http");

          let isHomepage = false;
          if (isUrl) {
            try {
              const target = new URL(skuOrUrl);
              if (target.pathname === "/" || target.pathname === "") isHomepage = true;
            } catch {}
          }

          if (!isHomepage && (isUrl || brandContextRef.current.site?.url)) {
            setLoading(true);
            try {
              let productData: ScrapedProductData;
              if (isUrl) productData = await scrapeProductByUrlFn({ data: { url: skuOrUrl } });
              else productData = await scrapeProductBySkuFn({ data: { siteUrl: brandContextRef.current.site!.url, sku: skuOrUrl }});

              if (productData.found) {
                scrapedProductsRef.current = [...scrapedProductsRef.current, productData];
                if (!isHiddenAction) {
                  setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `📦 **Produto Encontrado e Registrado!**\n\n**Nome:** ${productData.name}\n**Preço:** ${productData.price || "N/A"}\n\n${productData.imageUrl ? `![Imagem](${productData.imageUrl})\n\n` : ""}` }]);
                }
              } else {
                if (!isHiddenAction) {
                  setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `⚠️ **Aviso:** A busca por **${skuOrUrl}** não retornou imagem/preço exatos. Pode me passar o link direto?` }]);
                }
              }
            } catch { } finally { setLoading(false); }
          }
        }
        setBuilder({ type: "discovery_plan", discoveryPlan });
      }
    } catch (err) {
      toast.error(`Falha: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="flex h-[100dvh] w-screen flex-col overflow-hidden lg:flex-row bg-[#0A0A0B]">
        <section className="flex h-1/2 shrink-0 flex-col border-b border-white/5 lg:h-full lg:w-[420px] lg:border-b-0 lg:border-r bg-[#0E0E12]">
          {brandContext.site?.colors && (
            <div className="flex h-10 w-full items-center bg-[#18181B] px-5 text-[10px] uppercase font-bold text-white/40 gap-3 border-b border-white/5 shadow-sm">
              🎨 Paleta da Marca: 
              {brandContext.site.colors.map(c => (
                <div key={c} className="h-4 w-4 rounded-full shadow-inner ring-1 ring-white/10" style={{ backgroundColor: c }} title={c} />
              ))}
            </div>
          )}
          <ChatPanel messages={messages} onSend={(t) => handleSend(t, false)} loading={loading} scraping={scraping} brandContext={brandContext} setBrandContext={setBrandContext} />
        </section>
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#050505]">
          <PageBuilder state={builder} onChange={(p) => setBuilder((prev) => ({ ...prev, ...p }))} loading={loading} onRefine={(p) => handleSend(p, true)} scores={scores} generatingLabel={generatingLabel} />
        </section>
      </main>
      <Toaster richColors position="top-right" theme="dark" />
    </>
  );
}