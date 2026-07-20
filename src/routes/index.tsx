// routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ChatPanel, type ChatMessage } from "@/components/briefflow/ChatPanel";
import { PageBuilder } from "@/components/briefflow/PageBuilder";
import { sendToOllama, type ChatTurn } from "@/lib/ollama";
import {
  extractUrlsFromText,
  scrapeWebsite,
} from "@/lib/scrape-site";
import type {
  BrandContext,
  BuilderState,
  CampaignAsset,
  DiscoveryPlan,
  SiteBrandData,
} from "@/types/builder";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Home,
});

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function resolveChannels(plan?: DiscoveryPlan): Array<"banner" | "email" | "social"> {
  const raw = plan?.channels?.map((c) => c.toLowerCase()) ?? [];
  const channels: Array<"banner" | "email" | "social"> = [];

  if (raw.some((c) => c.includes("banner"))) channels.push("banner");
  if (raw.some((c) => c.includes("email") || c.includes("e-mail") || c.includes("mail")))
    channels.push("email");
  if (raw.some((c) => c.includes("social") || c.includes("post") || c.includes("instagram")))
    channels.push("social");

  // Default: full premium ecosystem
  if (channels.length === 0) return ["banner", "email", "social"];

  return channels;
}

function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [builder, setBuilder] = useState<BuilderState>({ type: "none" });
  const [scores, setScores] = useState<
    { persuasion: number; clarity: number; seo: number } | undefined
  >();

  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState<string | undefined>();

  const [brandContext, setBrandContext] = useState<BrandContext>({
    persona: "Público-alvo da marca",
    tone: "Profissional, premium e persuasivo",
    framework: "AIDA (Atenção, Interesse, Desejo, Ação)",
  });

  // Keep latest plan/context for sequential generation without stale closures
  const discoveryPlanRef = useRef<DiscoveryPlan | undefined>(undefined);
  const brandContextRef = useRef(brandContext);
  brandContextRef.current = brandContext;

  const mergeSiteIntoContext = (site: SiteBrandData) => {
    setBrandContext((prev) => {
      const next: BrandContext = {
        ...prev,
        brandName: site.brandName || prev.brandName,
        product: prev.product,
        site,
        persona: prev.persona === "Público-alvo da marca"
          ? `Pessoas interessadas em ${site.brandName || site.title || "esta marca"}`
          : prev.persona,
      };
      brandContextRef.current = next;
      return next;
    });
  };

  const maybeScrapeUrls = async (text: string): Promise<SiteBrandData | null> => {
    const urls = extractUrlsFromText(text);
    if (urls.length === 0) return null;

    // Skip if we already analyzed the same URL
    const target = urls[0];
    if (brandContextRef.current.site?.url === target) {
      return brandContextRef.current.site;
    }

    setScraping(true);
    try {
      const site = await scrapeWebsite({ data: { url: target } });
      mergeSiteIntoContext(site);
      toast.success(`Site analisado: ${site.brandName || site.title}`);
      return site;
    } catch (err) {
      toast.error(
        `Não consegui acessar o site: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      setScraping(false);
    }
  };

  const generateCampaignSequentially = async (baseHistory: ChatTurn[]) => {
    setLoading(true);

    const plan = discoveryPlanRef.current ?? builder.discoveryPlan;
    const channels = resolveChannels(plan);

    const stepMeta: Record<
      string,
      { label: string; prompt: string }
    > = {
      banner: {
        label: "Banner",
        prompt:
          "Aprovado. Crie APENAS a copy e a direção de arte do Banner premium da campanha.",
      },
      email: {
        label: "E-mail Marketing",
        prompt:
          "Excelente. Agora crie APENAS o E-mail Marketing premium desta mesma campanha.",
      },
      social: {
        label: "Post Social",
        prompt:
          "Perfeito. Por fim, crie APENAS o Post para Instagram desta campanha, com legenda e hashtags.",
      },
    };

    const steps = channels.map((type) => ({ type, ...stepMeta[type] }));

    setBuilder((prev) => ({
      ...prev,
      type: "campaign",
      campaignAssets: prev.type === "campaign" ? prev.campaignAssets ?? [] : [],
    }));

    let currentHistory = [...baseHistory];
    let accumulatedAssets: CampaignAsset[] = [];

    for (const step of steps) {
      const assistantId = uid();
      setGeneratingLabel(`Gerando ${step.label} premium...`);

      if (step.type !== steps[0].type) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "user", content: step.prompt },
          {
            id: assistantId,
            role: "assistant",
            content: `Gerando ${step.label} com qualidade de agência...\n\n(Pode levar alguns minutos)`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content: `Briefing aprovado. Gerando ${step.label} premium no painel ao lado...\n\n(Pode levar alguns minutos)`,
          },
        ]);
      }

      currentHistory.push({ role: "user", content: step.prompt });

      try {
        const res = await sendToOllama(
          currentHistory,
          brandContextRef.current,
          plan,
          undefined,
          step.type,
        );

        if (res.builder?.campaignAssets && res.builder.campaignAssets.length > 0) {
          const newAsset = res.builder.campaignAssets[0];

          // Proteção contra alucinação da IA omitindo a key "content" e o "id"
          if (!newAsset.content) {
            newAsset.content = { ...newAsset } as unknown as BuilderState;
          }
          newAsset.id = newAsset.id || uid();

          newAsset.content.imageSeed = Math.floor(Math.random() * 1_000_000);
          newAsset.content.type = step.type;
          newAsset.type = step.type;

          // Prefer brand from site/plan when model omits it
          newAsset.content.brandName =
            newAsset.content.brandName ||
            brandContextRef.current.brandName ||
            plan?.brandName ||
            brandContextRef.current.site?.brandName;

          accumulatedAssets = [...accumulatedAssets, newAsset];
          setBuilder((prev) => ({
            ...prev,
            type: "campaign",
            campaignAssets: accumulatedAssets,
          }));
        }

        if (res.scores) setScores(res.scores);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: res.chat } : m,
          ),
        );
        currentHistory.push({ role: "assistant", content: res.chat });
      } catch (err) {
        toast.error(
          `Falha ao gerar o ${step.label}: ${err instanceof Error ? err.message : err}`,
        );
        // Continue a iteração para a próxima peça em vez de quebrar (break) toda a geração
        continue;
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "assistant",
        content:
          "Estrutura finalizada. Navegue pelas abas no painel ao lado, edite os textos e regenere imagens se quiser.",
      },
    ]);
    setGeneratingLabel(undefined);
    setLoading(false);
  };

  const handleSend = async (text: string, isHiddenAction = false) => {
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const nextMessages = isHiddenAction ? messages : [...messages, userMsg];

    if (!isHiddenAction) setMessages(nextMessages);

    // Always try to scrape URLs from user input
    if (!isHiddenAction) {
      await maybeScrapeUrls(text);
    }

    if (text.includes("Aprovado. Gere os materiais do ecossistema agora.")) {
      await generateCampaignSequentially(
        nextMessages.map((m) => ({ role: m.role, content: m.content })),
      );
      return;
    }

    // Also trigger generation if user clearly approves in chat
    const approvalRegex =
      /\b(aprovado|pode gerar|gera as pe[cç]as|gerar as pe[cç]as|pode criar|vamos gerar|pode montar)\b/i;
    const planReady =
      discoveryPlanRef.current?.missingInfo?.toLowerCase().includes("nenhum") ||
      builder.discoveryPlan?.missingInfo?.toLowerCase().includes("nenhum");

    if (!isHiddenAction && planReady && approvalRegex.test(text)) {
      await generateCampaignSequentially(
        nextMessages.map((m) => ({ role: m.role, content: m.content })),
      );
      return;
    }

    const assistantId = uid();
    if (!isHiddenAction) {
      setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "" }]);
    }

    setLoading(true);

    const history: ChatTurn[] = nextMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Inject site summary into the last user turn so the model always sees it
    if (brandContextRef.current.site && history.length > 0) {
      const last = history[history.length - 1];
      if (last.role === "user") {
        last.content = `${last.content}\n\n[SITE_ANALISADO]\nURL: ${brandContextRef.current.site.url}\nMarca: ${brandContextRef.current.site.brandName}\nTítulo: ${brandContextRef.current.site.title}\nDescrição: ${brandContextRef.current.site.description}`;
      }
    }

    try {
      const res = await sendToOllama(
        history,
        brandContextRef.current,
        discoveryPlanRef.current ?? builder.discoveryPlan,
        (partialChat) => {
          if (!isHiddenAction) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: partialChat } : m,
              ),
            );
          }
        },
      );

      if (!isHiddenAction) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: res.chat } : m,
          ),
        );
      }

      if (res.builder && res.builder.type !== "none") {
        if (res.builder.type === "discovery_plan" && res.builder.discoveryPlan) {
          discoveryPlanRef.current = res.builder.discoveryPlan;

          // Enrich brand context from plan
          setBrandContext((prev) => ({
            ...prev,
            brandName: res.builder.discoveryPlan?.brandName || prev.brandName,
            product: res.builder.discoveryPlan?.product || prev.product,
            offer: res.builder.discoveryPlan?.offer || prev.offer,
            persona:
              res.builder.discoveryPlan?.audience || prev.persona,
          }));
        }

        // If execution returned a full campaign in one shot
        if (
          res.builder.type === "campaign" &&
          res.builder.campaignAssets?.length
        ) {
          res.builder.campaignAssets = res.builder.campaignAssets.map((a) => ({
            ...a,
            content: {
              ...a.content,
              imageSeed: a.content.imageSeed ?? Math.floor(Math.random() * 1_000_000),
            },
          }));
        }

        setBuilder({
          ...res.builder,
          imageSeed: Math.floor(Math.random() * 1_000_000),
        });
      }

      if (res.scores) setScores(res.scores);
    } catch (err) {
      toast.error(
        `Falha ao conectar: ${err instanceof Error ? err.message : err}`,
      );
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="flex h-[100dvh] w-screen flex-col overflow-hidden lg:flex-row">
        <section className="flex h-1/2 shrink-0 flex-col border-b lg:h-full lg:w-[420px] lg:border-b-0 lg:border-r">
          <ChatPanel
            messages={messages}
            onSend={(t) => handleSend(t, false)}
            loading={loading}
            scraping={scraping}
            brandContext={brandContext}
            setBrandContext={setBrandContext}
          />
        </section>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background relative">
          <PageBuilder
            state={builder}
            onChange={(patch) => setBuilder((prev) => ({ ...prev, ...patch }))}
            loading={loading}
            onRefine={(prompt) => handleSend(prompt, true)}
            scores={scores}
            generatingLabel={generatingLabel}
          />
        </section>
      </main>
      <Toaster richColors position="top-right" />
    </>
  );
}