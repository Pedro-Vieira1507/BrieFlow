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

/** Informações sobre a empresa distribuidora que produz os materiais. */
export type DistribuidoraPerfil = {
  /** Nome da empresa distribuidora (ex: Forlab) */
  nome: string;
  /** Site principal — a IA analisa design, cores e identidade visual */
  siteUrl: string;
  /** Cores principais da marca (ex: "#1A3C6E, #F5A623") */
  coresMarca: string;
  /** Tom de comunicação da distribuidora */
  tom: string;
  /** Slogan ou posicionamento */
  slogan: string;
  /** CNPJ / razão social (opcional, para rodapés de e-mail) */
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
  coresMarca: "",
  tom: "",
  slogan: "",
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
 * Monta um bloco de contexto sobre a distribuidora para injetar nos prompts.
 * Retorna string vazia se nenhuma informação foi preenchida.
 */
export function buildDistribuidoraContext(d: DistribuidoraPerfil): string {
  if (!d.nome && !d.siteUrl) return "";
  const lines: string[] = [
    "IDENTIDADE DA EMPRESA DISTRIBUIDORA (quem assina e produz os materiais):",
  ];
  if (d.nome)          lines.push(`- Nome: ${d.nome}`);
  if (d.slogan)        lines.push(`- Slogan/Posicionamento: ${d.slogan}`);
  if (d.siteUrl)       lines.push(`- Site: ${d.siteUrl} — use as cores, tom e identidade visual deste site como referência de design dos materiais`);
  if (d.coresMarca)    lines.push(`- Cores da marca: ${d.coresMarca}`);
  if (d.tom)           lines.push(`- Tom de comunicação: ${d.tom}`);
  if (d.razaoSocial)   lines.push(`- Razão social: ${d.razaoSocial}`);
  if (d.endereco)      lines.push(`- Endereço (rodapé): ${d.endereco}`);
  if (d.contato)       lines.push(`- Contato/WhatsApp: ${d.contato}`);
  if (d.emailContato)  lines.push(`- E-mail de contato: ${d.emailContato}`);
  lines.push(
    "IMPORTANTE: os materiais são produzidos pela distribuidora acima para divulgar a marca do fabricante.",
    "A distribuidora é quem assina, envia e aparece como remetente. O fabricante é o produto divulgado.",
    "Adapte todo o design, cores e identidade visual à distribuidora — não ao fabricante."
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
