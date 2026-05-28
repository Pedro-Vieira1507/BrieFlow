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
  type DistribuidoraPerfil,
  DEFAULT_DISTRIBUIDORA,
  MODEL_CATALOG,
  getModelProvider,
} from "@/lib/aiConfig";
import { useState, useEffect } from "react";
import {
  Save, Eye, EyeOff, CheckCircle2, ExternalLink,
  KeyRound, Sparkles, Mic, Building2, Globe, Palette,
  FileText, Link, Wand2, X,
} from "lucide-react";
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

// ─── Módulos disponíveis para configuração per-módulo ─────────────────────────
const MODULE_ENTRIES: { key: string; label: string; icon: string; audioOnly?: boolean }[] = [
  { key: "brief",                label: "Briefing",           icon: "📋" },
  { key: "audio",                label: "Áudio / TTS",        icon: "🎙️", audioOnly: true },
  { key: "podcast_revendedores", label: "Podcast 5 min",      icon: "🎧" },
  { key: "apresentacao_slides",  label: "Slides",             icon: "📊" },
  { key: "folheto_a4",           label: "Folheto A4",         icon: "📄" },
  { key: "ficha_tecnica",        label: "Ficha Técnica",      icon: "🔧" },
  { key: "emails_revendedores",  label: "E-mails Revendedor", icon: "📧" },
  { key: "emails_cliente_final", label: "E-mails Cliente",    icon: "📧" },
  { key: "posts_linkedin",       label: "LinkedIn",           icon: "💼" },
  { key: "posts_facebook",       label: "Facebook",           icon: "👍" },
  { key: "posts_instagram",      label: "Instagram",          icon: "📸" },
  { key: "roteiro_video_curto",  label: "Vídeo Curto",        icon: "🎬" },
];

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
  free:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  limited: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid:    "bg-muted text-muted-foreground",
  audio:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const BADGE_LABELS: Record<string, string> = {
  free: "Grátis",
  limited: "Grátis / limitado",
  paid: "Pago",
  audio: "Áudio nativo",
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
    description: "Necessária para modelos Gemini, Gemma e Native Audio Dialog.",
    linkLabel: "Obter chave gratuita no Google AI Studio",
    linkUrl: "https://aistudio.google.com/app/apikey",
  },
  groq: {
    label: "Groq (Llama / Gemma)",
    placeholder: "gsk_…",
    description: "Gratuito: 30 req/min. Modelos Llama 3 e Gemma ultra-rápidos.",
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

const TEXT_MODEL_IDS = (Object.keys(MODEL_CATALOG) as AIModel[]).filter(
  (id) => MODEL_CATALOG[id].badge !== "audio"
);

const AUDIO_MODEL_IDS = (Object.keys(MODEL_CATALOG) as AIModel[]).filter((id) => {
  const provider = getModelProvider(id);
  return (
    id === "gemini-2.5-flash-live" ||
    provider === "groq" ||
    provider === "openai" ||
    (provider === "gemini" && id !== "gemma-3-27b-it" && id !== "gemma-4-27b")
  );
});

function Configuracoes() {
  const [keys, setKeys] = useState<KeyState>({
    geminiKey: "", openaiKey: "", grokKey: "",
    anthropicKey: "", mistralKey: "", groqKey: "",
  });
  const [show, setShow] = useState<ShowState>({
    gemini: false, openai: false, grok: false,
    anthropic: false, mistral: false, groq: false,
  });
  const [drive, setDrive] = useState(false);
  const [drivePath, setDrivePath] = useState("/Forlab/Campanhas");
  const [outDir, setOutDir] = useState("/Forlab/Materiais");
  const [model, setModel] = useState<AIModel>("gemini-3.1-flash-lite");
  const [modelPerModule, setModelPerModule] = useState<Partial<Record<string, AIModel>>>({
    audio: "gemini-2.5-flash-live",
  });
  const [prompts, setPrompts] = useState<Record<string, string>>({ ...DEFAULT_PROMPTS });
  const [distribuidora, setDistribuidora] = useState<DistribuidoraPerfil>({ ...DEFAULT_DISTRIBUIDORA });
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
    setModelPerModule({
      audio: "gemini-2.5-flash-live",
      ...(saved.modelPerModule ?? {}),
    });
    setPrompts({ ...DEFAULT_PROMPTS, ...saved.prompts });
    setDistribuidora({ ...DEFAULT_DISTRIBUIDORA, ...(saved.distribuidora ?? {}) });
    setHydrated(true);
  }, []);

  const activeProvider = getModelProvider(model);
  const selectedMeta = MODEL_CATALOG[model];

  const visibleModels = (Object.entries(MODEL_CATALOG) as [AIModel, typeof MODEL_CATALOG[AIModel]][]).filter(
    ([, meta]) => (!onlyFree || meta.badge !== "paid") && meta.badge !== "audio"
  );

  function setDist<K extends keyof DistribuidoraPerfil>(field: K, value: DistribuidoraPerfil[K]) {
    setDistribuidora((prev) => ({ ...prev, [field]: value }));
  }

  function salvar() {
    const config: AIConfig = {
      openaiKey: keys.openaiKey,
      geminiKey: keys.geminiKey,
      grokKey: keys.grokKey,
      anthropicKey: keys.anthropicKey,
      mistralKey: keys.mistralKey,
      groqKey: keys.groqKey,
      model,
      modelPerModule,
      driveEnabled: drive,
      drivePath,
      driveOutDir: outDir,
      prompts,
      distribuidora,
    };
    saveAIConfig(config);
    setWasSaved(true);
    setTimeout(() => setWasSaved(false), 2500);
    toast.success("Configurações salvas com sucesso.");
  }

  function keyFieldName(provider: AIProvider): keyof KeyState {
    const map: Record<AIProvider, keyof KeyState> = {
      gemini: "geminiKey", openai: "openaiKey", grok: "grokKey",
      anthropic: "anthropicKey", mistral: "mistralKey", groq: "groqKey",
    };
    return map[provider];
  }

  function setModuleModel(key: string, val: string) {
    setModelPerModule((prev) => {
      if (!val) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: val as AIModel };
    });
  }

  const providerOrder: AIProvider[] = ["gemini", "groq", "openai", "grok", "mistral", "anthropic"];
  const freeProviders: AIProvider[] = ["gemini", "groq"];

  const usedProviders = new Set<AIProvider>(
    Object.values(modelPerModule)
      .filter(Boolean)
      .map((m) => getModelProvider(m as AIModel))
  );

  const distPreenchida = !!(distribuidora.nome || distribuidora.siteUrl);
  const temSite = !!(distribuidora.siteUrl || distribuidora.siteUrlSecundario);

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

          {/* ── 🏢 Perfil da Distribuidora ── */}
          <Card className="lg:col-span-2 border-violet-200 dark:border-violet-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-violet-500" />
                <CardTitle className="text-base">Perfil da Distribuidora</CardTitle>
                {distPreenchida && (
                  <span className="ml-auto rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs font-medium px-2 py-0.5">
                    ✅ Configurado
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                A empresa distribuidora é <strong>quem assina e envia</strong> os materiais.
                A marca divulgada é o produto/fabricante informado no brief.
                A IA usará as informações abaixo — incluindo a análise do site — para adaptar
                design, tom e identidade visual de todos os materiais à distribuidora.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Identidade principal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-violet-500" />
                    Nome da Distribuidora
                  </Label>
                  <Input
                    placeholder="Ex: Forlab Distribuidora"
                    value={distribuidora.nome}
                    onChange={(e) => setDist("nome", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Slogan / Posicionamento</Label>
                  <Input
                    placeholder="Ex: Soluções completas para laboratórios"
                    value={distribuidora.slogan}
                    onChange={(e) => setDist("slogan", e.target.value)}
                  />
                </div>
              </div>

              {/* ── Sites para análise de design — DESTAQUE ── */}
              <div className="rounded-xl border-2 border-violet-400 dark:border-violet-600 bg-gradient-to-br from-violet-50 to-violet-100/60 dark:from-violet-950/30 dark:to-violet-900/20 p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    <p className="text-sm font-bold text-violet-900 dark:text-violet-200">
                      🎨 Análise de Design pelo Site
                    </p>
                  </div>
                  <span className="rounded-full bg-violet-600 text-white text-xs font-semibold px-2.5 py-0.5">
                    IA extrai identidade visual automaticamente
                  </span>
                </div>

                <div className="rounded-lg bg-white/70 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-700 px-4 py-3 text-xs text-violet-800 dark:text-violet-300 space-y-1.5">
                  <p className="font-semibold text-sm">Como funciona:</p>
                  <p>
                    1. Informe o(s) site(s) da <strong>distribuidora</strong> abaixo.
                  </p>
                  <p>
                    2. A IA irá <strong>acessar e analisar</strong> os sites antes de gerar cada material,
                    extraindo paleta de cores, tipografia, estilo de layout e tom visual.
                  </p>
                  <p>
                    3. Os elementos extraídos são aplicados em <strong>todos os materiais gerados</strong>
                    — e-mails, slides, posts e folhetos.
                  </p>
                  <p className="font-semibold text-violet-900 dark:text-violet-200 mt-1">
                    ⚠️ Use sempre o site da distribuidora — nunca do fabricante divulgado.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-violet-800 dark:text-violet-300 font-semibold">
                      <Globe className="h-3.5 w-3.5 text-violet-600" />
                      Site Principal da Distribuidora
                      <span className="rounded-full bg-violet-200 text-violet-700 dark:bg-violet-800 dark:text-violet-300 text-xs font-medium px-1.5 py-0.5">
                        principal
                      </span>
                    </Label>
                    <Input
                      placeholder="https://www.forlab.com.br"
                      type="url"
                      value={distribuidora.siteUrl}
                      onChange={(e) => setDist("siteUrl", e.target.value)}
                      className="border-violet-300 dark:border-violet-600 focus:ring-violet-400"
                    />
                    <p className="text-xs text-violet-600 dark:text-violet-400">
                      Site institucional — fonte <strong>primária</strong> de referência de design e identidade visual.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-violet-700 dark:text-violet-400">
                      <Link className="h-3.5 w-3.5 text-violet-400" />
                      Portal de Revendedores / Site Secundário
                      <span className="ml-1 rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-1.5 py-0.5">
                        opcional
                      </span>
                    </Label>
                    <Input
                      placeholder="https://revendedores.forlab.com.br"
                      type="url"
                      value={distribuidora.siteUrlSecundario}
                      onChange={(e) => setDist("siteUrlSecundario", e.target.value)}
                      className="border-violet-200 dark:border-violet-700"
                    />
                    <p className="text-xs text-muted-foreground">
                      Portal de revendedores ou loja virtual — complementa a análise para materiais de vendas.
                    </p>
                  </div>
                </div>

                {temSite && (
                  <div className="rounded-md bg-violet-100 dark:bg-violet-900/30 border border-violet-300 dark:border-violet-700 px-3 py-2.5 text-xs text-violet-800 dark:text-violet-300 flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">🔍</span>
                    <span>
                      A IA irá <strong>acessar e analisar</strong>{" "}
                      {distribuidora.siteUrl && distribuidora.siteUrlSecundario ? "os dois sites" : "este site"}{" "}
                      antes de gerar cada material, extraindo paleta de cores, tipografia e estilo visual
                      para garantir consistência com a identidade da distribuidora.
                    </span>
                  </div>
                )}

                {/* ── Paleta extraída pela IA ── */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-violet-700 dark:text-violet-400">
                    <Wand2 className="h-3.5 w-3.5 text-violet-500" />
                    Paleta Extraída pela IA
                    <span className="ml-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-1.5 py-0.5">
                      confirmação visual
                    </span>
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="Ex: Primária: #1A3C6E | Secundária: #F5A623 | Fundo: #FFFFFF | Texto: #333333"
                      value={distribuidora.paletaExtraida}
                      onChange={(e) => setDist("paletaExtraida", e.target.value)}
                      className="pr-8 text-sm font-mono border-violet-200 dark:border-violet-700"
                    />
                    {distribuidora.paletaExtraida && (
                      <button
                        type="button"
                        onClick={() => setDist("paletaExtraida", "")}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        title="Limpar paleta (força nova análise)"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este campo é preenchido automaticamente pela IA após analisar o site.
                    Limpe-o para forçar uma nova extração. Você também pode editar manualmente.
                  </p>

                  {/* Preview visual das cores extraídas */}
                  {distribuidora.paletaExtraida && (() => {
                    const hexMatches = distribuidora.paletaExtraida.match(/#[0-9A-Fa-f]{3,6}/g);
                    if (!hexMatches || hexMatches.length === 0) return null;
                    return (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Preview:</span>
                        {hexMatches.slice(0, 6).map((hex, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full border border-border shadow-sm"
                            style={{ backgroundColor: hex }}
                            title={hex}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Identidade visual manual */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-violet-500" />
                    Cores da Marca (hex manuais)
                    <span className="ml-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-1.5 py-0.5">
                      prioridade sobre o site
                    </span>
                  </Label>
                  <Input
                    placeholder="Ex: #1A3C6E (azul principal), #F5A623 (laranja CTA)"
                    value={distribuidora.coresMarca}
                    onChange={(e) => setDist("coresMarca", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Quando preenchido, estes hex têm prioridade sobre as cores extraídas do site.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Tom de Comunicação</Label>
                  <Input
                    placeholder="Ex: Técnico e consultivo, próximo e confiável"
                    value={distribuidora.tom}
                    onChange={(e) => setDist("tom", e.target.value)}
                  />
                </div>
              </div>

              {/* Notas adicionais de design */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-violet-500" />
                  Notas de Design / Instruções Adicionais para a IA
                  <span className="ml-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs px-1.5 py-0.5">
                    opcional
                  </span>
                </Label>
                <Textarea
                  rows={3}
                  placeholder={`Ex: Usar sempre fundo branco nos e-mails. Ícones arredondados. Fonte principal: Montserrat.\nCabeçalho dos e-mails deve ter a logo à esquerda e cor #1A3C6E.\nEvitar elementos muito carregados — design limpo e moderno.`}
                  value={distribuidora.notasDesign}
                  onChange={(e) => setDist("notasDesign", e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use este campo para instruções específicas de design que não estão visíveis no site,
                  ou quando o site é protegido por login. A IA seguirá estas instruções em todos os materiais.
                </p>
              </div>

              {/* Dados para rodapé de e-mail */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  📧 Dados para Rodapé dos E-mails
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Razão Social / CNPJ</Label>
                    <Input
                      placeholder="Ex: Forlab Comércio LTDA — CNPJ 00.000.000/0001-00"
                      value={distribuidora.razaoSocial}
                      onChange={(e) => setDist("razaoSocial", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Endereço</Label>
                    <Input
                      placeholder="Ex: Av. Exemplo, 123 — Rio de Janeiro, RJ"
                      value={distribuidora.endereco}
                      onChange={(e) => setDist("endereco", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone / WhatsApp</Label>
                    <Input
                      placeholder="Ex: (21) 99999-9999"
                      value={distribuidora.contato}
                      onChange={(e) => setDist("contato", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail de Contato</Label>
                    <Input
                      placeholder="Ex: contato@forlab.com.br"
                      type="email"
                      value={distribuidora.emailContato}
                      onChange={(e) => setDist("emailContato", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {distPreenchida && (
                <div className="rounded-md bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 px-4 py-3 text-xs text-violet-700 dark:text-violet-300 space-y-1">
                  <p className="font-medium">✅ Contexto da distribuidora será injetado em todos os materiais gerados:</p>
                  <p>• E-mails HTML usarão as cores e o rodapé da {distribuidora.nome || "distribuidora"}</p>
                  <p>• A IA saberá que o remetente é a distribuidora — não o fabricante divulgado</p>
                  {distribuidora.siteUrl && (
                    <p>• Design referenciado em: <a href={distribuidora.siteUrl} target="_blank" rel="noopener noreferrer" className="underline">{distribuidora.siteUrl}</a></p>
                  )}
                  {distribuidora.siteUrlSecundario && (
                    <p>• Site secundário: <a href={distribuidora.siteUrlSecundario} target="_blank" rel="noopener noreferrer" className="underline">{distribuidora.siteUrlSecundario}</a></p>
                  )}
                  {distribuidora.paletaExtraida && (
                    <p>• Paleta extraída pela IA: <span className="font-mono">{distribuidora.paletaExtraida.slice(0, 80)}{distribuidora.paletaExtraida.length > 80 ? "…" : ""}</span></p>
                  )}
                  {distribuidora.notasDesign && (
                    <p>• Notas de design personalizadas: ativas ✅</p>
                  )}
                </div>
              )}

            </CardContent>
          </Card>

          {/* ── Modelo de IA Global ── */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Modelo de IA — Global</CardTitle>
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
                      {meta.freeRpm > 0 && meta.freeRpm < 999_999 && (
                        <span className="text-xs text-muted-foreground">
                          {meta.freeRpm} req/min
                          {" · "}
                          {meta.freeTpm >= 1_000_000
                            ? (meta.freeTpm / 1_000_000).toFixed(0) + "M"
                            : (meta.freeTpm / 1_000).toFixed(0) + "K"} tok/min
                          {meta.freeRpd > 0 && meta.freeRpd < 99_999
                            ? ` · ${meta.freeRpd.toLocaleString("pt-BR")} req/dia`
                            : ""}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {hydrated && (
                <div className="rounded-md bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>Modelo global:</strong> {selectedMeta.label} —{" "}
                    {selectedMeta.badge === "paid"
                      ? `Requer chave ${PROVIDER_INFO[activeProvider].label} com créditos.`
                      : `Free tier: ${selectedMeta.freeRpm < 999_999 ? selectedMeta.freeRpm + " req/min" : "RPM ilimitado"} · ${selectedMeta.freeTpm >= 1_000_000 ? (selectedMeta.freeTpm / 1_000_000).toFixed(0) + "M" : (selectedMeta.freeTpm / 1_000).toFixed(0) + "K"} tok/min.`}
                  </p>
                  <p>🤖 <strong>Brief e materiais</strong> usam o modelo global (ou o específico por módulo).</p>
                  <p>🎤 <strong>Transcrição</strong> usa Whisper local (gratuito, sem chave).</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Modelo por Módulo ── */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-base">Modelo por módulo</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Defina um modelo específico por tipo de material. Deixe em{" "}
                <strong>— Global —</strong> para usar o modelo acima.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {MODULE_ENTRIES.map(({ key, label, icon, audioOnly }) => {
                  const optionIds = audioOnly ? AUDIO_MODEL_IDS : TEXT_MODEL_IDS;
                  const currentVal = modelPerModule[key] ?? "";
                  const isAudio = key === "audio";

                  return (
                    <div
                      key={key}
                      className={
                        "rounded-lg border p-3 space-y-2 " +
                        (isAudio
                          ? "border-blue-400/60 bg-blue-50/40 dark:bg-blue-950/20"
                          : "border-border")
                      }
                    >
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <span>{icon}</span>
                        <span>{label}</span>
                        {isAudio && (
                          <span className="ml-auto rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium px-1.5 py-0.5">
                            TTS
                          </span>
                        )}
                      </Label>

                      <select
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                        value={currentVal}
                        onChange={(e) => setModuleModel(key, e.target.value)}
                      >
                        <option value="">
                          — Global ({MODEL_CATALOG[model]?.label ?? "padrão"}) —
                        </option>
                        {optionIds.map((id) => {
                          const meta = MODEL_CATALOG[id];
                          return (
                            <option key={id} value={id}>
                              {meta.label}
                              {meta.badge === "free" || meta.badge === "audio"
                                ? ` (${meta.freeRpm < 999_999 ? meta.freeRpm + " RPM" : "∞ RPM"} grátis)`
                                : meta.badge === "limited"
                                ? ` (${meta.freeRpm} RPM limitado)`
                                : " (pago)"}
                            </option>
                          );
                        })}
                      </select>

                      {isAudio && currentVal === "gemini-2.5-flash-live" && (
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          ✅ RPM ilimitado · 1M tok/min · Voz: Aoede
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
                💡 Use <strong>Gemini 3.1 Flash Lite</strong> como global e{" "}
                <strong>Gemma 3 27B</strong> para módulos de volume.
              </p>
            </CardContent>
          </Card>

          {/* ── Chaves de API ── */}
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
                  const isUsedByModule = usedProviders.has(provider);
                  const isVisible = show[provider];

                  if (!isFree && !isActive && !isUsedByModule) return null;

                  return (
                    <div
                      key={provider}
                      className={
                        "rounded-lg border p-4 space-y-2 transition-colors " +
                        (isActive
                          ? "border-accent/60 bg-accent/5"
                          : isUsedByModule
                          ? "border-blue-400/40 bg-blue-50/20 dark:bg-blue-950/10"
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
                        <div className="flex gap-1">
                          {isActive && (
                            <span className="rounded-full bg-accent/15 text-accent text-xs font-medium px-2 py-0.5">
                              Em uso
                            </span>
                          )}
                          {isUsedByModule && !isActive && (
                            <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium px-2 py-0.5">
                              Módulo
                            </span>
                          )}
                        </div>
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

          {/* ── Google Drive ── */}
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

          {/* ── Prompt templates ── */}
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
