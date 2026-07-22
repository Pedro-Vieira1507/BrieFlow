import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ChatPanel,
  type ChatMessage,
} from "@/components/briefflow/ChatPanel";
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

type CampaignChannel = "banner" | "email" | "social";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function resolveChannels(plan?: DiscoveryPlan): CampaignChannel[] {
  const raw = plan?.channels?.map((channel) => channel.toLowerCase()) ?? [];
  const channels: CampaignChannel[] = [];

  if (raw.some((channel) => channel.includes("banner"))) {
    channels.push("banner");
  }

  if (
    raw.some(
      (channel) =>
        channel.includes("email") ||
        channel.includes("e-mail") ||
        channel.includes("mail"),
    )
  ) {
    channels.push("email");
  }

  if (
    raw.some(
      (channel) =>
        channel.includes("social") ||
        channel.includes("post") ||
        channel.includes("instagram"),
    )
  ) {
    channels.push("social");
  }

  return channels.length > 0
    ? channels
    : ["banner", "email", "social"];
}

function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [builder, setBuilder] = useState<BuilderState>({
    type: "none",
  });
  const [scores, setScores] = useState<
    | {
        persuasion: number;
        clarity: number;
        seo: number;
      }
    | undefined
  >();

  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState<
    string | undefined
  >();

  const [brandContext, setBrandContext] = useState<BrandContext>({
    persona: "Público-alvo da marca",
    tone: "Profissional, premium e persuasivo",
    framework: "AIDA (Atenção, Interesse, Desejo, Ação)",
  });

  const discoveryPlanRef = useRef<DiscoveryPlan | undefined>(undefined);
  const brandContextRef = useRef(brandContext);

  brandContextRef.current = brandContext;

  const mergeSiteIntoContext = (site: SiteBrandData) => {
    setBrandContext((previous) => {
      const next: BrandContext = {
        ...previous,
        brandName: site.brandName || previous.brandName,
        product: previous.product,
        site,
        persona:
          previous.persona === "Público-alvo da marca"
            ? `Pessoas interessadas em ${
                site.brandName || site.title || "esta marca"
              }`
            : previous.persona,
      };

      brandContextRef.current = next;

      return next;
    });
  };

  const maybeScrapeUrls = async (
    text: string,
  ): Promise<SiteBrandData | null> => {
    const urls = extractUrlsFromText(text);

    if (urls.length === 0) {
      return null;
    }

    const targetUrl = urls[0];

    if (brandContextRef.current.site?.url === targetUrl) {
      return brandContextRef.current.site;
    }

    setScraping(true);

    try {
      const site = await scrapeWebsite({
        data: {
          url: targetUrl,
        },
      });

      mergeSiteIntoContext(site);

      toast.success(
        `Site analisado: ${
          site.brandName || site.title || "marca identificada"
        }`,
      );

      return site;
    } catch (error) {
      toast.error(
        `Não consegui acessar o site: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    } finally {
      setScraping(false);
    }
  };

  const generateCampaignSequentially = async (
    baseHistory: ChatTurn[],
  ) => {
    const plan =
      discoveryPlanRef.current ??
      (builder.type === "discovery_plan"
        ? builder.discoveryPlan
        : undefined);

    const channels = resolveChannels(plan);

    const stepMeta: Record<
      CampaignChannel,
      {
        label: string;
        prompt: string;
      }
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

    const steps = channels.map((type) => ({
      type,
      ...stepMeta[type],
    }));

    let currentHistory = [...baseHistory];
    let accumulatedAssets: CampaignAsset[] = [];
    let failures = 0;

    setLoading(true);

    setBuilder((previous) => ({
      ...previous,
      type: "campaign",
      campaignAssets:
        previous.type === "campaign"
          ? previous.campaignAssets ?? []
          : [],
    }));

    try {
      for (const [index, step] of steps.entries()) {
        const assistantId = uid();

        setGeneratingLabel(`Gerando ${step.label} premium...`);

        setMessages((previous) => [
          ...previous,
          ...(index > 0
            ? [
                {
                  id: uid(),
                  role: "user" as const,
                  content: step.prompt,
                },
              ]
            : []),
          {
            id: assistantId,
            role: "assistant" as const,
            content:
              index === 0
                ? `Briefing aprovado. Gerando ${step.label} premium no painel ao lado...\n\n(Pode levar alguns segundos)`
                : `Gerando ${step.label} com qualidade de agência...\n\n(Pode levar alguns segundos)`,
          },
        ]);

        currentHistory = [
          ...currentHistory,
          {
            role: "user",
            content: step.prompt,
          },
        ];

        try {
          const response = await sendToOllama(
            currentHistory,
            brandContextRef.current,
            plan,
            {
              intent: "campaign",
              targetAsset: step.type,
            },
          );

          const generatedAsset =
            response.builder.type === "campaign"
              ? response.builder.campaignAssets?.[0]
              : undefined;

          if (!generatedAsset?.content) {
            failures += 1;

            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content:
                        "A IA respondeu, mas não retornou uma peça válida. Vou continuar para a próxima etapa.",
                    }
                  : message,
              ),
            );

            continue;
          }

          const normalizedAsset: CampaignAsset = {
            ...generatedAsset,
            id: generatedAsset.id || uid(),
            type: step.type,
            status: "draft",
            content: {
              ...generatedAsset.content,
              type: step.type,
              imageSeed:
                generatedAsset.content.imageSeed ??
                Math.floor(Math.random() * 1_000_000),
              brandName:
                generatedAsset.content.brandName ||
                brandContextRef.current.brandName ||
                plan?.brandName ||
                brandContextRef.current.site?.brandName,
            },
          };

          accumulatedAssets = [
            ...accumulatedAssets,
            normalizedAsset,
          ];

          setBuilder((previous) => ({
            ...previous,
            type: "campaign",
            campaignAssets: accumulatedAssets,
          }));

          if (response.scores) {
            setScores(response.scores);
          }

          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content:
                      response.chat ||
                      `${step.label} gerado com sucesso no painel ao lado.`,
                  }
                : message,
            ),
          );

          currentHistory = [
            ...currentHistory,
            {
              role: "assistant",
              content:
                response.chat ||
                `${step.label} gerado com sucesso no painel ao lado.`,
            },
          ];
        } catch (error) {
          failures += 1;

          const errorMessage =
            error instanceof Error ? error.message : String(error);

          toast.error(
            `Falha ao gerar ${step.label}: ${errorMessage}`,
          );

          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: `Não foi possível gerar ${step.label}: ${errorMessage}`,
                  }
                : message,
            ),
          );
        }
      }

      const generatedCount = accumulatedAssets.length;
      const expectedCount = steps.length;

      setMessages((previous) => [
        ...previous,
        {
          id: uid(),
          role: "assistant",
          content:
            generatedCount === expectedCount
              ? "Campanha finalizada. Navegue pelas abas no painel ao lado, edite os textos e regenere imagens se quiser."
              : generatedCount > 0
                ? `Gerei ${generatedCount} de ${expectedCount} peças. ${failures} etapa(s) não foram concluídas; tente novamente se desejar.`
                : "Não consegui concluir as peças da campanha. Verifique a conexão, o modelo configurado e os logs do Ollama.",
        },
      ]);
    } finally {
      setGeneratingLabel(undefined);
      setLoading(false);
    }
  };

  const handleSend = async (
    text: string,
    isHiddenAction = false,
  ) => {
    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
    };

    const nextMessages = isHiddenAction
      ? messages
      : [...messages, userMessage];

    if (!isHiddenAction) {
      setMessages(nextMessages);
      await maybeScrapeUrls(text);
    }

    if (
      text.includes(
        "Aprovado. Gere os materiais do ecossistema agora.",
      )
    ) {
      await generateCampaignSequentially(
        nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      );

      return;
    }

    const approvalRegex =
      /\b(aprovado|pode gerar|gera as pe[cç]as|gerar as pe[cç]as|pode criar|vamos gerar|pode montar)\b/i;

    const planReady =
      discoveryPlanRef.current?.missingInfo
        ?.toLowerCase()
        .includes("nenhuma") ||
      (builder.type === "discovery_plan" &&
        builder.discoveryPlan?.missingInfo
          ?.toLowerCase()
          .includes("nenhuma"));

    if (
      !isHiddenAction &&
      planReady &&
      approvalRegex.test(text)
    ) {
      await generateCampaignSequentially(
        nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      );

      return;
    }

    const assistantId = uid();

    if (!isHiddenAction) {
      setMessages([
        ...nextMessages,
        {
          id: assistantId,
          role: "assistant",
          content: "",
        },
      ]);
    }

    const history: ChatTurn[] = nextMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    if (brandContextRef.current.site && history.length > 0) {
      const lastMessage = history[history.length - 1];

      if (lastMessage.role === "user") {
        lastMessage.content = `${lastMessage.content}

[SITE_ANALISADO]
URL: ${brandContextRef.current.site.url}
Marca: ${brandContextRef.current.site.brandName}
Título: ${brandContextRef.current.site.title}
Descrição: ${brandContextRef.current.site.description}`;
      }
    }

    setLoading(true);

    try {
      const response = await sendToOllama(
        history,
        brandContextRef.current,
        discoveryPlanRef.current ??
          (builder.type === "discovery_plan"
            ? builder.discoveryPlan
            : undefined),
        {
          intent: "discovery",
          onStream: (partialChat) => {
            if (!isHiddenAction) {
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content: partialChat,
                      }
                    : message,
                ),
              );
            }
          },
        },
      );

      if (!isHiddenAction) {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: response.chat,
                }
              : message,
          ),
        );
      }

      if (
        response.builder.type === "discovery_plan" &&
        response.builder.discoveryPlan
      ) {
        const discoveryPlan = response.builder.discoveryPlan;

        discoveryPlanRef.current = discoveryPlan;

        setBrandContext((previous) => {
          const next: BrandContext = {
            ...previous,
            brandName: discoveryPlan.brandName || previous.brandName,
            product: discoveryPlan.product || previous.product,
            offer: discoveryPlan.offer || previous.offer,
            persona: discoveryPlan.audience || previous.persona,
          };

          brandContextRef.current = next;

          return next;
        });

        setBuilder({
          type: "discovery_plan",
          discoveryPlan,
          imageSeed: Math.floor(Math.random() * 1_000_000),
        });
      }

      if (
        response.builder.type === "campaign" &&
        response.builder.campaignAssets?.length
      ) {
        const campaignAssets = response.builder.campaignAssets.map(
          (asset) => ({
            ...asset,
            id: asset.id || uid(),
            status: asset.status || "draft",
            content: {
              ...asset.content,
              imageSeed:
                asset.content.imageSeed ??
                Math.floor(Math.random() * 1_000_000),
            },
          }),
        );

        setBuilder({
          type: "campaign",
          campaignAssets,
          imageSeed: Math.floor(Math.random() * 1_000_000),
        });
      }

      if (response.scores) {
        setScores(response.scores);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      toast.error(`Falha ao conectar: ${errorMessage}`);

      if (!isHiddenAction) {
        setMessages((previous) =>
          previous.filter((message) => message.id !== assistantId),
        );
      }
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
            onSend={(text) => handleSend(text, false)}
            loading={loading}
            scraping={scraping}
            brandContext={brandContext}
            setBrandContext={setBrandContext}
          />
        </section>

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <PageBuilder
            state={builder}
            onChange={(patch) =>
              setBuilder((previous) => ({
                ...previous,
                ...patch,
              }))
            }
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