// AI configuration — safe storage with localStorage fallback.

export type AIProvider = "gemini" | "openai" | "grok" | "anthropic" | "mistral" | "groq";

export type AIModel =
  | "gemini-3.1-flash-lite"
  | "gemini-3-flash"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemma-3-27b-it"
  | "gemma-4-27b"
  | "gemini-2.5-flash-live"   // ← TTS nativo, RPM ilimitado
  | "llama-3.3-70b-versatile"
  | "llama-3.1-8b-instant"
  | "gemma2-9b-it"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "grok-3"
  | "grok-3-mini"
  | "mistral-large-latest"
  | "mistral-small-latest"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-haiku-20240307";

export type ModelMeta = {
  label: string;
  provider: AIProvider;
  apiId: string;
  freeRpm: number;
  freeTpm: number;
  freeRpd: number;
  badge: "free" | "paid" | "limited" | "audio";
  note: string;
};

export const MODEL_CATALOG: Record<AIModel, ModelMeta> = {
  // ── Gemini texto ──────────────────────────────────────────────────────
  "gemini-3.1-flash-lite": {
  label: "Gemini 3.1 Flash Lite ⭐",
  provider: "gemini",
  apiId: "gemini-2.0-flash",
  freeRpm: 15,
  freeTpm: 250_000,
  freeRpd: 500,
  badge: "free",
  note: "✅ MELHOR OPÇÃO — 15 RPM · 500 req/dia.",
},
"gemini-3-flash": {
  label: "Gemini 3 Flash",
  provider: "gemini",
  apiId: "gemini-2.5-flash",
  freeRpm: 5,
  freeTpm: 250_000,
  freeRpd: 20,
  badge: "limited",
  note: "Alta qualidade. 5 RPM · 20 req/dia.",
},
  "gemini-2.5-flash": {
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    apiId: "gemini-2.5-flash",
    freeRpm: 5, freeTpm: 250_000, freeRpd: 20,
    badge: "limited",
    note: "Raciocínio avançado. 5 RPM · 20 req/dia gratuitos.",
  },
  "gemini-2.5-flash-lite": {
    label: "Gemini 2.5 Flash Lite",
    provider: "gemini",
    apiId: "gemini-2.5-flash-lite",
    freeRpm: 10, freeTpm: 250_000, freeRpd: 20,
    badge: "free",
    note: "10 RPM gratuitos. Mais rápido que o 2.5 Flash.",
  },
  "gemini-2.5-flash-live": {
  label: "Gemini 2.5 Flash TTS 🎙️",
  provider: "gemini",
  apiId: "gemini-2.5-flash-preview-tts",
  freeRpm: 3,
  freeTpm: 10_000,
  freeRpd: 10,
  badge: "audio",
  note: "🎙️ ÁUDIO — 3 RPM · 10 req/dia gratuitos. TTS nativo de alta qualidade.",
},
  "gemma-3-27b-it": {
    label: "Gemma 3 27B",
    provider: "gemini",
    apiId: "gemma-3-27b-it",
    freeRpm: 30, freeTpm: 15_000, freeRpd: 14_400,
    badge: "free",
    note: "30 RPM · 14.400 req/dia. Excelente para geração em volume.",
  },
  "gemma-4-27b": {
    label: "Gemma 4 27B",
    provider: "gemini",
    apiId: "gemma-4-27b",
    freeRpm: 15, freeTpm: 0, freeRpd: 1_500,
    badge: "free",
    note: "15 RPM · 1.500 req/dia · TPM ilimitado.",
  },
  "llama-3.3-70b-versatile": {
    label: "Llama 3.3 70B (Groq)",
    provider: "groq",
    apiId: "llama-3.3-70b-versatile",
    freeRpm: 30, freeTpm: 6_000, freeRpd: 1_000,
    badge: "free",
    note: "30 req/min via Groq. Alta qualidade em português.",
  },
  "llama-3.1-8b-instant": {
    label: "Llama 3.1 8B Instant (Groq)",
    provider: "groq",
    apiId: "llama-3.1-8b-instant",
    freeRpm: 30, freeTpm: 20_000, freeRpd: 14_400,
    badge: "free",
    note: "Ultra-rápido via Groq. Ideal para rascunhos.",
  },
  "gemma2-9b-it": {
    label: "Gemma 2 9B (Groq)",
    provider: "groq",
    apiId: "gemma2-9b-it",
    freeRpm: 30, freeTpm: 15_000, freeRpd: 14_400,
    badge: "free",
    note: "30 req/min via Groq. Leve e preciso.",
  },
  "gpt-4o-mini": {
    label: "GPT-4o Mini",
    provider: "openai", apiId: "gpt-4o-mini",
    freeRpm: 0, freeTpm: 0, freeRpd: 0, badge: "paid",
    note: "Rápido e econômico. Requer chave OpenAI.",
  },
  "gpt-4o": {
    label: "GPT-4o",
    provider: "openai", apiId: "gpt-4o",
    freeRpm: 0, freeTpm: 0, freeRpd: 0, badge: "paid",
    note: "Melhor qualidade OpenAI. Requer chave OpenAI.",
  },
  "grok-3": {
    label: "Grok 3",
    provider: "grok", apiId: "grok-3",
    freeRpm: 0, freeTpm: 0, freeRpd: 0, badge: "paid",
    note: "Flagship xAI. Requer chave xAI.",
  },
  "grok-3-mini": {
    label: "Grok 3 Mini",
    provider: "grok", apiId: "grok-3-mini",
    freeRpm: 0, freeTpm: 0, freeRpd: 0, badge: "paid",
    note: "Versão leve do Grok 3. Requer chave xAI.",
  },
  "mistral-large-latest": {
    label: "Mistral Large",
    provider: "mistral", apiId: "mistral-large-latest",
    freeRpm: 0, freeTpm: 0, freeRpd: 0, badge: "paid",
    note: "Melhor modelo Mistral. Requer chave Mistral.",
  },
  "mistral-small-latest": {
    label: "Mistral Small",
    provider: "mistral", apiId: "mistral-small-latest",
    freeRpm: 0, freeTpm: 0, freeRpd: 0, badge: "paid",
    note: "Econômico. Requer chave Mistral.",
  },
  "claude-3-5-sonnet-20241022": {
    label: "Claude 3.5 Sonnet",
    provider: "anthropic", apiId: "claude-3-5-sonnet-20241022",
    freeRpm: 0, freeTpm: 0, freeRpd: 0, badge: "paid",
    note: "Melhor Anthropic para copywriting. Requer chave.",
  },
  "claude-3-haiku-20240307": {
    label: "Claude 3 Haiku",
    provider: "anthropic", apiId: "claude-3-haiku-20240307",
    freeRpm: 0, freeTpm: 0, freeRpd: 0, badge: "paid",
    note: "Modelo leve Anthropic. Requer chave.",
  },
};

export function getModelProvider(model: AIModel): AIProvider {
  return MODEL_CATALOG[model].provider;
}
export function isOpenAIModel(m: AIModel)   { return getModelProvider(m) === "openai"; }
export function isGroqModel(m: AIModel)     { return getModelProvider(m) === "groq"; }
export function isGrokModel(m: AIModel)     { return getModelProvider(m) === "grok"; }
export function isMistralModel(m: AIModel)  { return getModelProvider(m) === "mistral"; }
export function isAnthropicModel(m: AIModel){ return getModelProvider(m) === "anthropic"; }

export function geminiApiId(model: AIModel): string {
  return MODEL_CATALOG[model]?.apiId ?? "gemini-3.1-flash-lite";
}

// ─── Perfil da Distribuidora ──────────────────────────────────────────────────

/**
 * Informações sobre a empresa distribuidora que produz e assina os materiais.
 * A marca divulgada é o fabricante/produto informado no brief — não a distribuidora.
 */
export type DistribuidoraPerfil = {
  /** Nome da empresa distribuidora (ex: Forlab) */
  nome: string;

  /**
   * Site institucional principal da distribuidora.
   * A IA acessa e analisa este URL para extrair:
   * paleta de cores, tipografia, tom de voz e layout.
   * Use sempre o site da DISTRIBUIDORA — nunca do fabricante divulgado.
   */
  siteUrl: string;

  /**
   * Site secundário opcional (ex: portal do revendedor, loja virtual, hotsite).
   * Complementa a análise de design quando o site principal não reflete
   * o estilo visual usado nos materiais de vendas.
   */
  siteUrlSecundario: string;

  /** Cores principais da marca em hex (ex: "#1A3C6E, #F5A623") */
  coresMarca: string;

  /** Tom de comunicação da distribuidora (ex: "Técnico e consultivo") */
  tom: string;

  /** Slogan ou posicionamento da distribuidora */
  slogan: string;

  /**
   * Notas adicionais de design/identidade visual para guiar a IA.
   * Ex: "Usar sempre fundo branco, ícones arredondados, fontes sans-serif."
   * Útil quando o site não está disponível publicamente ou é protegido.
   */
  notasDesign: string;

  /** CNPJ / razão social (para rodapés de e-mail) */
  razaoSocial: string;

  /** Endereço para rodapé de e-mail */
  endereco: string;

  /** Telefone / WhatsApp de contato */
  contato: string;

  /** E-mail de contato exibido nos materiais */
  emailContato: string;
};

// ─── Config type ──────────────────────────────────────────────────────────────

export type AIConfig = {
  openaiKey: string;
  geminiKey: string;
  grokKey: string;
  anthropicKey: string;
  mistralKey: string;
  groqKey: string;
  model: AIModel;
  modelPerModule: Partial<Record<string, AIModel>>;
  driveEnabled: boolean;
  drivePath: string;
  driveOutDir: string;
  prompts: Record<string, string>;
  /** Perfil da empresa distribuidora que assina os materiais */
  distribuidora: DistribuidoraPerfil;
};

const STORAGE_KEY = "briefflow_ai_config";

export const DEFAULT_DISTRIBUIDORA: DistribuidoraPerfil = {
  nome: "",
  siteUrl: "",
  siteUrlSecundario: "",
  coresMarca: "",
  tom: "",
  slogan: "",
  notasDesign: "",
  razaoSocial: "",
  endereco: "",
  contato: "",
  emailContato: "",
};

const DEFAULT_CONFIG: AIConfig = {
  openaiKey: "", geminiKey: "", grokKey: "",
  anthropicKey: "", mistralKey: "", groqKey: "",
  model: "gemini-3.1-flash-lite",
  modelPerModule: {
    audio: "gemini-2.5-flash-live",
  },
  driveEnabled: false,
  drivePath: "/Forlab/Campanhas",
  driveOutDir: "/Forlab/Materiais",
  prompts: {},
  distribuidora: { ...DEFAULT_DISTRIBUIDORA },
};

// ─── Safe storage ─────────────────────────────────────────────────────────────

function storageAvailable(): boolean {
  try { localStorage.setItem("__t__", "1"); localStorage.removeItem("__t__"); return true; }
  catch { return false; }
}

let _memConfig: AIConfig | null = null;

function readRaw(): string | null {
  if (storageAvailable()) return localStorage.getItem(STORAGE_KEY);
  return _memConfig ? JSON.stringify(_memConfig) : null;
}

function writeRaw(v: string): void {
  if (storageAvailable()) localStorage.setItem(STORAGE_KEY, v);
  else { try { _memConfig = JSON.parse(v); } catch { /* ignore */ } }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function loadAIConfig(): AIConfig {
  try {
    const raw = readRaw();
    if (!raw) return { ...DEFAULT_CONFIG };
    const saved = JSON.parse(raw) as Partial<AIConfig>;
    const model = saved.model && MODEL_CATALOG[saved.model as AIModel]
      ? (saved.model as AIModel) : DEFAULT_CONFIG.model;
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      model,
      modelPerModule: { ...DEFAULT_CONFIG.modelPerModule, ...(saved.modelPerModule ?? {}) },
      distribuidora: { ...DEFAULT_DISTRIBUIDORA, ...(saved.distribuidora ?? {}) },
    };
  } catch { return { ...DEFAULT_CONFIG }; }
}

export function saveAIConfig(config: AIConfig): void {
  writeRaw(JSON.stringify(config));
}

/** Retorna o modelo configurado para um módulo específico, com fallback para o modelo global. */
export function getModuleModel(moduleKey: string, config: AIConfig): AIModel {
  const perModule = config.modelPerModule?.[moduleKey] as AIModel | undefined;
  if (perModule && MODEL_CATALOG[perModule]) return perModule;
  return config.model;
}

/**
 * Monta um bloco de contexto rico sobre a distribuidora para injetar nos prompts.
 * Instrui a IA a acessar o site e extrair paleta, tipografia e tom de design.
 * Retorna string vazia se nenhuma informação foi preenchida.
 */
export function buildDistribuidoraContext(d: DistribuidoraPerfil): string {
  if (!d.nome && !d.siteUrl) return "";

  const lines: string[] = [
    "═══════════════════════════════════════════════════════════",
    "CONTEXTO DA EMPRESA DISTRIBUIDORA — LEIA COM ATENÇÃO",
    "═══════════════════════════════════════════════════════════",
    "",
    "📌 PAPEL DA DISTRIBUIDORA:",
    "Os materiais abaixo são produzidos e assinados pela empresa DISTRIBUIDORA.",
    "O produto/marca divulgado é do FABRICANTE — a distribuidora é quem comercializa e envia.",
    "Portanto: o remetente, o design e a identidade visual devem refletir a DISTRIBUIDORA, não o fabricante.",
    "",
    "🏢 DADOS DA DISTRIBUIDORA:",
  ];

  if (d.nome)    lines.push(`- Nome: ${d.nome}`);
  if (d.slogan)  lines.push(`- Slogan / Posicionamento: ${d.slogan}`);
  if (d.tom)     lines.push(`- Tom de comunicação: ${d.tom}`);

  if (d.siteUrl || d.siteUrlSecundario) {
    lines.push("", "🌐 REFERÊNCIAS DE DESIGN (sites da distribuidora):");
    if (d.siteUrl) {
      lines.push(
        `- Site principal: ${d.siteUrl}`,
        `  → ACESSE este site e analise: paleta de cores predominante, tipografia usada,`,
        `    layout geral (headers, botões, cards), tom visual (formal/moderno/próximo).`,
        `  → Utilize EXATAMENTE essas escolhas de design nos materiais gerados.`,
        `  → NÃO use as cores ou o estilo visual do fabricante divulgado.`,
      );
    }
    if (d.siteUrlSecundario) {
      lines.push(
        `- Site secundário / portal de revendedores: ${d.siteUrlSecundario}`,
        `  → Use este como referência complementar de design para materiais de vendas.`,
      );
    }
  }

  if (d.coresMarca) {
    lines.push(
      "",
      "🎨 CORES DEFINIDAS MANUALMENTE (têm prioridade sobre a análise do site):",
      `- ${d.coresMarca}`,
      "  → Use estes hex exatos em botões, cabeçalhos, destaques e CTAs dos e-mails HTML.",
    );
  }

  if (d.notasDesign) {
    lines.push(
      "",
      "📝 NOTAS ADICIONAIS DE DESIGN (instruções manuais da distribuidora):",
      ...d.notasDesign.split("\n").map((l) => `  ${l}`),
    );
  }

  if (d.razaoSocial || d.endereco || d.contato || d.emailContato) {
    lines.push("", "📧 DADOS PARA RODAPÉ DOS E-MAILS:");
    if (d.razaoSocial)  lines.push(`- Razão social / CNPJ: ${d.razaoSocial}`);
    if (d.endereco)     lines.push(`- Endereço: ${d.endereco}`);
    if (d.contato)      lines.push(`- Telefone / WhatsApp: ${d.contato}`);
    if (d.emailContato) lines.push(`- E-mail: ${d.emailContato}`);
  }

  lines.push(
    "",
    "⚠️  REGRA CRÍTICA:",
    "Nunca atribua os materiais ao fabricante do produto divulgado.",
    "Sempre identifique a distribuidora como a empresa que produz e envia os conteúdos.",
    "═══════════════════════════════════════════════════════════",
  );

  return lines.join("\n");
}

export function getOpenAIKey()    { return loadAIConfig().openaiKey; }
export function getGeminiKey()    { return loadAIConfig().geminiKey; }
export function getGrokKey()      { return loadAIConfig().grokKey; }
export function getAnthropicKey() { return loadAIConfig().anthropicKey; }
export function getMistralKey()   { return loadAIConfig().mistralKey; }
export function getGroqKey()      { return loadAIConfig().groqKey; }
export function getActiveModel(): AIModel { return loadAIConfig().model; }

export function getActiveKey(): string {
  const config = loadAIConfig();
  const p = getModelProvider(config.model);
  if (p === "openai")    return config.openaiKey;
  if (p === "grok")      return config.grokKey;
  if (p === "anthropic") return config.anthropicKey;
  if (p === "mistral")   return config.mistralKey;
  if (p === "groq")      return config.groqKey;
  return config.geminiKey;
}

export function getDistribuidora(): DistribuidoraPerfil {
  return loadAIConfig().distribuidora;
}
