import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageContainer, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MATERIAL_META, type MaterialKey } from "@/lib/store";
import {
  loadAIConfig,
  saveAIConfig,
  type AIConfig,
  type AIModel,
  type AIProvider,
  MODEL_CATALOG,
  getModelProvider,
} from "@/lib/aiConfig";
import { useState, useEffect } from "react";
import { Save, Eye, EyeOff, CheckCircle2, ExternalLink, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Agente de Conteúdo Forlab" },
      { name: "description", content: "Chaves de API, modelo de IA e templates de prompt." },
    ],
  }),
  component: Configuracoes,
});

const DEFAULT_PROMPTS: Record<"brief" | MaterialKey, string> = {
  brief: "A partir da transcrição/briefing fornecida, extraia um JSON estruturado com marca, campanha, público-alvo, proposta comercial, oferta promocional, subcategorias citadas, diferenciais técnicos, benefícios para revendedor e cliente final, objeções e argumentos, tom de comunicação e observações. Não invente categorias fixas — use estritamente o que está no conteúdo. Marque inferências.",
  podcast_revendedores: "Crie um roteiro de podcast de 5 minutos para revendedores, com intro, 3 blocos temáticos e CTA, baseado no brief estruturado.",
  apresentacao_slides: "Gere 10 slides estruturados para revendedores, com título e bullets por slide.",
  folheto_a4: "Crie texto de folheto A4 promocional para cliente final, com título, subtítulo, bloco principal, destaques técnicos e CTA.",
  ficha_tecnica: "Crie ficha técnica interna para vendedores com SKUs, mecânica, vigência, pontos fortes e quebra de objeções.",
  emails_revendedores: "Crie 2 e-mails para revendedores: anúncio e reforço/urgência.",
  emails_cliente_final: "Crie 3 e-mails para cliente final: topo de funil (apresentação + ecossistema Forlab), meio de funil (diferenciais técnicos vs. concorrentes) e fundo de funil (oferta).",
  posts_linkedin: "Crie 2 posts profissionais para LinkedIn baseados no brief.",
  posts_facebook: "Crie 2 posts curtos para Facebook baseados no brief.",
  posts_instagram: "Crie 2 ideias de posts para Instagram (carrossel e reels).",
  roteiro_video_curto: "Crie um roteiro de vídeo curto (15–30s) com tempo, ação na tela e locução.",
};

const BADGE_STYLES: Record<string, string> = {
  free: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  limited: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-muted text-muted-foreground",
};

const BADGE_LABELS: Record<string, string> = {
  free: "Grátis",
  limited: "Grátis / limitado",
  paid: "Pago",
};

const PROVIDER_INFO: Record<AIProvider, {
  label: string;
  placeholder: string;
  description: string;
  linkLabel: string;
  linkUrl: string;
}> = {
  gemini: {
    label: "Google Gemini",
    placeholder: "AIzaSy…",
    description: "Necessária para modelos Gemini 2.0 Flash, 2.5 Flash e 2.5 Pro.",
    linkLabel: "Obter chave gratuita no Google AI Studio",
    linkUrl: "https://aistudio.google.com/app/apikey",
  },
  groq: {
    label: "Groq (Llama / Gemma)",
    placeholder: "gsk_…",
    description: "Gratuito: 30 req/min. Modelos Llama 3 e Gemma 2 ultra-rápidos.",
    linkLabel: "Obter chave gratuita em console.groq.com",
    linkUrl: "https://console.groq.com/keys",
  },
  openai: {
    label: "OpenAI (GPT-4o)",
    placeholder: "sk-…",
    description: "Necessária para modelos GPT-4o e GPT-4o Mini.",
    linkLabel: "Painel OpenAI",
    linkUrl: "https://platform.openai.com/api-keys",
  },
  grok: {
    label: "Grok — xAI",
    placeholder: "xai-…",
    description: "Necessária para modelos Grok 3 e Grok 3 Mini.",
    linkLabel: "Painel xAI",
    linkUrl: "https://console.x.ai",
  },
  mistral: {
    label: "Mistral AI",
    placeholder: "…",
    description: "Necessária para Mistral Large e Mistral Small.",
    linkLabel: "Painel Mistral",
    linkUrl: "https://console.mistral.ai/api-keys",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    placeholder: "sk-ant-…",
    description: "Necessária para Claude 3.5 Sonnet e Claude 3 Haiku.",
    linkLabel: "Painel Anthropic",
    linkUrl: "https://console.anthropic.com/settings/keys",
  },
};

type KeyState = {
  geminiKey: string;
  openaiKey: string;
  grokKey: string;
  anthropicKey: string;
  mistralKey: string;
  groqKey: string;
};

type ShowState = Record<AIProvider, boolean>;

function Configuracoes() {
  const [keys, setKeys] = useState<KeyState>({
    geminiKey: "",
    openaiKey: "",
    grokKey: "",
    anthropicKey: "",
    mistralKey: "",
    groqKey: "",
  });
  const [show, setShow] = useState<ShowState>({
    gemini: false,
    openai: false,
    grok: false,
    anthropic: false,
    mistral: false,
    groq: false,
  });
  const [drive, setDrive] = useState(false);
  const [drivePath, setDrivePath] = useState("/Forlab/Campanhas");
  const [outDir, setOutDir] = useState("/Forlab/Materiais");
  const [model, setModel] = useState<AIModel>("gemini-2.0-flash");
  const [prompts, setPrompts] = useState<Record<string, string>>({ ...DEFAULT_PROMPTS });
  const [wasSaved, setWasSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [onlyFree, setOnlyFree] = useState(true);

  useEffect(() => {
    const saved = loadAIConfig();
    setKeys({
      geminiKey: saved.geminiKey,
      openaiKey: saved.openaiKey,
      grokKey: saved.grokKey ?? "",
      anthropicKey: saved.anthropicKey ?? "",
      mistralKey: saved.mistralKey ?? "",
      groqKey: saved.groqKey ?? "",
    });
    setDrive(saved.driveEnabled);
    setDrivePath(saved.drivePath);
    setOutDir(saved.driveOutDir);
    setModel(saved.model);
    setPrompts({ ...DEFAULT_PROMPTS, ...saved.prompts });
    setHydrated(true);
  }, []);

  const activeProvider = getModelProvider(model);
  const selectedMeta = MODEL_CATALOG[model];

  // Models filtered by free/all toggle
  const visibleModels = (Object.entries(MODEL_CATALOG) as [AIModel, typeof MODEL_CATALOG[AIModel]][]).filter(
    ([, meta]) => !onlyFree || meta.badge !== "paid"
  );

  function salvar() {
    const config: AIConfig = {
      openaiKey: keys.openaiKey,
      geminiKey: keys.geminiKey,
      grokKey: keys.grokKey,
      anthropicKey: keys.anthropicKey,
      mistralKey: keys.mistralKey,
      groqKey: keys.groqKey,
      model,
      driveEnabled: drive,
      drivePath,
      driveOutDir: outDir,
      prompts,
    };
    saveAIConfig(config);
    setWasSaved(true);
    setTimeout(() => setWasSaved(false), 2500);
    toast.success("Configurações salvas com sucesso.");
  }

  function keyFieldName(provider: AIProvider): keyof KeyState {
    const map: Record<AIProvider, keyof KeyState> = {
      gemini: "geminiKey",
      openai: "openaiKey",
      grok: "grokKey",
      anthropic: "anthropicKey",
      mistral: "mistralKey",
      groq: "groqKey",
    };
    return map[provider];
  }

  // Show key card for active provider + free providers; hide paid providers when not in use
  const providerOrder: AIProvider[] = ["gemini", "groq", "openai", "grok", "mistral", "anthropic"];
  const freeProviders: AIProvider[] = ["gemini", "groq"];

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Configurações"
          description="Conecte APIs, escolha o modelo de IA e edite os templates de prompt usados pelo agente."
          actions={
            <Button onClick={salvar}>
              {wasSaved ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Modelo de IA */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Modelo de IA</CardTitle>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Switch checked={onlyFree} onCheckedChange={setOnlyFree} />
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-green-500" />
                    Apenas gratuitos
                  </span>
                </label>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {visibleModels.map(([id, meta]) => {
                  const isActive = model === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setModel(id)}
                      className={
                        "flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors " +
                        (isActive
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/40 text-muted-foreground")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={"font-medium " + (isActive ? "text-accent" : "text-foreground")}>
                          {meta.label}
                        </span>
                        <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + BADGE_STYLES[meta.badge]}>
                          {BADGE_LABELS[meta.badge]}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">{meta.note}</span>
                      {meta.freeRpm > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {meta.freeRpm} req/min · {meta.freeTpm >= 1_000_000
                            ? (meta.freeTpm / 1_000_000).toFixed(0) + "M"
                            : (meta.freeTpm / 1_000).toFixed(0) + "K"} tokens/min
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {hydrated && (
                <div className="rounded-md bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>Modelo selecionado:</strong> {selectedMeta.label} —{" "}
                    {selectedMeta.badge === "paid"
                      ? `Requer chave ${PROVIDER_INFO[activeProvider].label} com créditos.`
                      : `Free tier: ${selectedMeta.freeRpm} req/min · ${selectedMeta.freeTpm >= 1_000_000 ? (selectedMeta.freeTpm / 1_000_000).toFixed(0) + "M" : (selectedMeta.freeTpm / 1_000).toFixed(0) + "K"} tokens/min.`}
                  </p>
                  <p>🤖 <strong>Brief e materiais</strong> usam o modelo selecionado acima.</p>
                  <p>🎤 <strong>Transcrição</strong> usa Whisper local (gratuito, sem chave).</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chaves de API */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Chaves de API</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {providerOrder.map((provider) => {
                  const info = PROVIDER_INFO[provider];
                  const fieldName = keyFieldName(provider);
                  const isActive = provider === activeProvider;
                  const isFree = freeProviders.includes(provider);
                  const isVisible = show[provider];

                  // Hide paid providers that are not currently selected
                  if (!isFree && !isActive) return null;

                  return (
                    <div
                      key={provider}
                      className={
                        "rounded-lg border p-4 space-y-2 transition-colors " +
                        (isActive
                          ? "border-accent/60 bg-accent/5"
                          : "border-border bg-transparent")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label className="flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                          {info.label}
                          {isFree && (
                            <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium px-1.5 py-0.5">
                              Grátis
                            </span>
                          )}
                        </Label>
                        {isActive && (
                          <span className="rounded-full bg-accent/15 text-accent text-xs font-medium px-2 py-0.5">
                            Em uso
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <Input
                          type={isVisible ? "text" : "password"}
                          placeholder={info.placeholder}
                          value={keys[fieldName]}
                          onChange={(e) => setKeys({ ...keys, [fieldName]: e.target.value })}
                          className="pr-9 font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShow((s) => ({ ...s, [provider]: !s[provider] }))}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      <p className="text-xs text-muted-foreground">{info.description}</p>

                      <a
                        href={info.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        {info.linkLabel}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
                ⚠️ Chaves salvas localmente no navegador. Para produção, prefira variáveis de ambiente no backend.
              </p>
            </CardContent>
          </Card>

          {/* Google Drive */}
          <Card>
            <CardHeader><CardTitle className="text-base">Google Drive</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Monitoramento de pasta</div>
                  <div className="text-xs text-muted-foreground">Cria campanhas automaticamente para novos arquivos.</div>
                </div>
                <Switch checked={drive} onCheckedChange={setDrive} />
              </div>
              <div className="space-y-1.5">
                <Label>Pasta monitorada</Label>
                <Input value={drivePath} onChange={(e) => setDrivePath(e.target.value)} disabled={!drive} />
              </div>
              <div className="space-y-1.5">
                <Label>Pasta padrão de saída</Label>
                <Input value={outDir} onChange={(e) => setOutDir(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Prompt templates */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Templates de prompt</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Prompt do brief estruturado</Label>
                <Textarea
                  rows={4}
                  value={prompts["brief"] ?? DEFAULT_PROMPTS.brief}
                  onChange={(e) => setPrompts({ ...prompts, brief: e.target.value })}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">Deixe em branco para usar o prompt padrão do sistema.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(MATERIAL_META) as MaterialKey[]).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label>{MATERIAL_META[k].label}</Label>
                    <Textarea
                      rows={3}
                      value={prompts[k] ?? DEFAULT_PROMPTS[k] ?? ""}
                      onChange={(e) => setPrompts({ ...prompts, [k]: e.target.value })}
                      className="text-sm"
                      placeholder="Deixe em branco para usar o prompt padrão."
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </PageContainer>
    </AppShell>
  );
}
