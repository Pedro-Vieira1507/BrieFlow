// AI configuration — safe storage with localStorage fallback.
// localStorage is blocked in sandboxed iframes (e.g. Lovable preview);
// we fall back to a module-level in-memory store so the app never crashes.

// ─── Model definitions ──────────────────────────────────────────────────

export type AIProvider = "gemini" | "openai" | "grok" | "anthropic" | "mistral" | "groq";

export type AIModel =
  // Gemini (gratuito)
  | "gemini-2.0-flash"
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  // Groq — gratuito, ultra-rápido (Llama / Gemma)
  | "llama-3.3-70b-versatile"
  | "llama-3.1-8b-instant"
  | "gemma2-9b-it"
  // OpenAI (pago)
  | "gpt-4o-mini"
  | "gpt-4o"
  // Grok / xAI (pago)
  | "grok-3"
  | "grok-3-mini"
  // Mistral (pago)
  | "mistral-large-latest"
  | "mistral-small-latest"
  // Anthropic (pago)
  | "claude-3-5-sonnet-20241022"
  | "claude-3-haiku-20240307";

export type ModelMeta = {
  label: string;
  provider: AIProvider;
  apiId: string;
  freeRpm: number;
  freeTpm: number;
  badge: "free" | "paid" | "limited";
  note: string;
};

export const MODEL_CATALOG: Record<AIModel, ModelMeta> = {
  // ── Gemini ─────────────────────────────────────────────────────────────
  "gemini-2.0-flash": {
    label: "Gemini 2.0 Flash",
    provider: "gemini",
    apiId: "gemini-2.0-flash",
    freeRpm: 15,
    freeTpm: 1_000_000,
    badge: "free",
    note: "15 req/min gratuitos · 1M tokens/min. Mais estável para geração em série. Recomendado.",
  },
  "gemini-2.5-flash": {
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    apiId: "gemini-2.5-flash-preview-04-17",
    freeRpm: 10,
    freeTpm: 250_000,
    badge: "free",
    note: "Raciocínio superior ao 2.0. 10 req/min gratuitos.",
  },
  "gemini-2.5-pro": {
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    apiId: "gemini-2.5-pro-preview-05-06",
    freeRpm: 5,
    freeTpm: 250_000,
    badge: "limited",
    note: "Máxima qualidade Gemini. 5 req/min — use para briefings complexos.",
  },
  // ── Groq (gratuito, ultra-rápido) ──────────────────────────────────────────
  "llama-3.3-70b-versatile": {
    label: "Llama 3.3 70B (Groq)",
    provider: "groq",
    apiId: "llama-3.3-70b-versatile",
    freeRpm: 30,
    freeTpm: 6_000,
    badge: "free",
    note: "30 req/min gratuitos via Groq. Modelo open-source de alta qualidade. Ótimo em português.",
  },
  "llama-3.1-8b-instant": {
    label: "Llama 3.1 8B Instant (Groq)",
    provider: "groq",
    apiId: "llama-3.1-8b-instant",
    freeRpm: 30,
    freeTpm: 20_000,
    badge: "free",
    note: "30 req/min gratuitos via Groq. Ultra-rápido. Ideal para rascunhos e textos curtos.",
  },
  "gemma2-9b-it": {
    label: "Gemma 2 9B (Groq)",
    provider: "groq",
    apiId: "gemma2-9b-it",
    freeRpm: 30,
    freeTpm: 15_000,
    badge: "free",
    note: "30 req/min gratuitos via Groq. Modelo Google open-source, leve e preciso.",
  },
  // ── OpenAI (pago) ────────────────────────────────────────────────────────────
  "gpt-4o-mini": {
    label: "GPT-4o Mini",
    provider: "openai",
    apiId: "gpt-4o-mini",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Rápido e econômico. Requer chave OpenAI com créditos.",
  },
  "gpt-4o": {
    label: "GPT-4o",
    provider: "openai",
    apiId: "gpt-4o",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Melhor qualidade OpenAI. Requer chave OpenAI com créditos.",
  },
  // ── Grok / xAI (pago) ────────────────────────────────────────────────────────
  "grok-3": {
    label: "Grok 3",
    provider: "grok",
    apiId: "grok-3",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Modelo flagship da xAI. API compatível com OpenAI. Requer chave xAI.",
  },
  "grok-3-mini": {
    label: "Grok 3 Mini",
    provider: "grok",
    apiId: "grok-3-mini",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Versão leve e econômica do Grok 3. Requer chave xAI.",
  },
  // ── Mistral (pago) ───────────────────────────────────────────────────────────
  "mistral-large-latest": {
    label: "Mistral Large",
    provider: "mistral",
    apiId: "mistral-large-latest",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Melhor modelo Mistral. Excelente em português. Requer chave Mistral.",
  },
  "mistral-small-latest": {
    label: "Mistral Small",
    provider: "mistral",
    apiId: "mistral-small-latest",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Versão econômica Mistral. Bom custo-benefício. Requer chave Mistral.",
  },
  // ── Anthropic (pago) ─────────────────────────────────────────────────────────
  "claude-3-5-sonnet-20241022": {
    label: "Claude 3.5 Sonnet",
    provider: "anthropic",
    apiId: "claude-3-5-sonnet-20241022",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Melhor modelo Anthropic para copywriting. Requer chave Anthropic.",
  },
  "claude-3-haiku-20240307": {
    label: "Claude 3 Haiku",
    provider: "anthropic",
    apiId: "claude-3-haiku-20240307",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Modelo leve e rápido da Anthropic. Requer chave Anthropic.",
  },
};

export function getModelProvider(model: AIModel): AIProvider {
  return MODEL_CATALOG[model].provider;
}

export function isOpenAIModel(model: AIModel): boolean {
  return getModelProvider(model) === "openai";
}

export function isGroqModel(model: AIModel): boolean {
  return getModelProvider(model) === "groq";
}

export function isGrokModel(model: AIModel): boolean {
  return getModelProvider(model) === "grok";
}

export function isMistralModel(model: AIModel): boolean {
  return getModelProvider(model) === "mistral";
}

export function isAnthropicModel(model: AIModel): boolean {
  return getModelProvider(model) === "anthropic";
}

export function geminiApiId(model: AIModel): string {
  return MODEL_CATALOG[model]?.apiId ?? "gemini-2.0-flash";
}

// ─── Config type ──────────────────────────────────────────────────

export type AIConfig = {
  openaiKey: string;
  geminiKey: string;
  grokKey: string;
  anthropicKey: string;
  mistralKey: string;
  groqKey: string;
  model: AIModel;
  driveEnabled: boolean;
  drivePath: string;
  driveOutDir: string;
  prompts: Record<string, string>;
};

const STORAGE_KEY = "briefflow_ai_config";

const DEFAULT_CONFIG: AIConfig = {
  openaiKey: "",
  geminiKey: "",
  grokKey: "",
  anthropicKey: "",
  mistralKey: "",
  groqKey: "",
  model: "gemini-2.0-flash",
  driveEnabled: false,
  drivePath: "/Forlab/Campanhas",
  driveOutDir: "/Forlab/Materiais",
  prompts: {},
};

// ─── Safe storage helpers ───────────────────────────────────────────────

function storageAvailable(): boolean {
  try {
    const k = "__briefflow_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

let _memConfig: AIConfig | null = null;

function readRaw(): string | null {
  if (storageAvailable()) return localStorage.getItem(STORAGE_KEY);
  return _memConfig ? JSON.stringify(_memConfig) : null;
}

function writeRaw(value: string): void {
  if (storageAvailable()) {
    localStorage.setItem(STORAGE_KEY, value);
  } else {
    try { _memConfig = JSON.parse(value); } catch { /* ignore */ }
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export function loadAIConfig(): AIConfig {
  try {
    const raw = readRaw();
    if (!raw) return { ...DEFAULT_CONFIG };
    const saved = JSON.parse(raw) as Partial<AIConfig>;
    const model = saved.model && MODEL_CATALOG[saved.model as AIModel]
      ? (saved.model as AIModel)
      : DEFAULT_CONFIG.model;
    return { ...DEFAULT_CONFIG, ...saved, model };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAIConfig(config: AIConfig): void {
  writeRaw(JSON.stringify(config));
}

export function getOpenAIKey(): string    { return loadAIConfig().openaiKey; }
export function getGeminiKey(): string    { return loadAIConfig().geminiKey; }
export function getGrokKey(): string      { return loadAIConfig().grokKey; }
export function getAnthropicKey(): string { return loadAIConfig().anthropicKey; }
export function getMistralKey(): string   { return loadAIConfig().mistralKey; }
export function getGroqKey(): string      { return loadAIConfig().groqKey; }
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
