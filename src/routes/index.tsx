// routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChatPanel, type ChatMessage } from "@/components/briefflow/ChatPanel";
import { PageBuilder } from "@/components/briefflow/PageBuilder";
import { sendToOllama, type ChatTurn } from "@/lib/ollama";
import type { BuilderState, BrandContext, CampaignAsset } from "@/types/builder";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Home,
});

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [builder, setBuilder] = useState<BuilderState>({ type: "none" });
  const [scores, setScores] = useState<{persuasion: number, clarity: number, seo: number} | undefined>();
  const [loading, setLoading] = useState(false);
  const [brandContext, setBrandContext] = useState<BrandContext>({
    persona: "Profissionais e empresas",
    tone: "Profissional, inovador e persuasivo",
    framework: "AIDA (Atenção, Interesse, Desejo, Ação)",
  });

  const generateCampaignSequentially = async (baseHistory: ChatTurn[]) => {
    setLoading(true);
    
    const steps = [
      { type: "banner", label: "Banner", prompt: "Aprovado. Crie APENAS a copy e a direção de arte do Banner da campanha." },
      { type: "email", label: "E-mail Marketing", prompt: "Excelente. Agora crie APENAS o E-mail Marketing desta mesma campanha." },
      { type: "social", label: "Post Social", prompt: "Perfeito. Por fim, crie APENAS o Post para Instagram desta campanha." }
    ];

    setBuilder(prev => ({ ...prev, type: "campaign", campaignAssets: [] }));
    
    let currentHistory = [...baseHistory];
    let accumulatedAssets: CampaignAsset[] = [];

    for (const step of steps) {
      const assistantId = uid();
      
      // 💡 Deixa claro que processamento por CPU demora minutos, segurando a expectativa do usuário
      if (step.type !== "banner") {
         setMessages(prev => [
           ...prev, 
           { id: uid(), role: "user", content: step.prompt },
           { id: assistantId, role: "assistant", content: `⏳ Orquestrando I.A. Gerando ${step.label}...\n\n(Isso pode levar de 2 a 5 minutos na CPU)` }
         ]);
      } else {
         setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: `Aprovado! 🚀 Acordando Agente DeepSeek R1 para gerar o ${step.label}...\n\n(Isso pode levar de 2 a 5 minutos na CPU)` }]);
      }

      currentHistory.push({ role: "user", content: step.prompt });

      try {
        const res = await sendToOllama(
          currentHistory, 
          brandContext, 
          builder.discoveryPlan,
          (partialChat) => {
             setMessages((prev) => prev.map(m => m.id === assistantId ? { ...m, content: partialChat } : m));
          },
          step.type 
        );

        if (res.builder?.campaignAssets && res.builder.campaignAssets.length > 0) {
          const newAsset = res.builder.campaignAssets[0];
          newAsset.content.imageSeed = Math.floor(Math.random() * 1_000_000);
          accumulatedAssets = [...accumulatedAssets, newAsset];
          
          setBuilder(prev => ({ ...prev, type: "campaign", campaignAssets: accumulatedAssets }));
        }

        setMessages((prev) => prev.map(m => m.id === assistantId ? { ...m, content: res.chat } : m));
        currentHistory.push({ role: "assistant", content: res.chat });

      } catch (err) {
        toast.error(`Falha ao gerar o ${step.label}: ${err instanceof Error ? err.message : err}`);
        break; 
      }
    }
    
    setMessages(prev => [
        ...prev, 
        { id: uid(), role: "assistant", content: "🎉 Estrutura 100% finalizada. Navegue pelas Abas no Workspace ao lado e faça as edições necessárias!" }
    ]);
    setLoading(false);
  };

  const handleSend = async (text: string, isHiddenAction = false) => {
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const nextMessages = isHiddenAction ? messages : [...messages, userMsg];
    
    if (!isHiddenAction) setMessages(nextMessages);

    if (text.includes("Aprovado. Gere os materiais do ecossistema agora.")) {
      await generateCampaignSequentially(nextMessages.map((m) => ({ role: m.role, content: m.content })));
      return;
    }

    const assistantId = uid(); 
    if (!isHiddenAction) {
      setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "" }]);
    }
    
    setLoading(true);

    const history: ChatTurn[] = nextMessages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await sendToOllama(
        history, 
        brandContext, 
        builder.discoveryPlan,
        (partialChat) => {
          if (!isHiddenAction) {
            setMessages((prev) => prev.map(m => m.id === assistantId ? { ...m, content: partialChat } : m));
          }
        }
      );
      
      if (!isHiddenAction) {
        setMessages((prev) => prev.map(m => m.id === assistantId ? { ...m, content: res.chat } : m));
      }

      if (res.builder && res.builder.type !== "none") {
        setBuilder({ ...res.builder, imageSeed: Math.floor(Math.random() * 1_000_000) });
      }
      if(res.scores) {
          setScores(res.scores)
      }
    } catch (err) {
      toast.error(`Falha ao conectar: ${err instanceof Error ? err.message : err}`);
      setMessages((prev) => prev.filter(m => m.id !== assistantId));
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
          />
        </section>
      </main>
      <Toaster richColors position="top-right" />
    </>
  );
}