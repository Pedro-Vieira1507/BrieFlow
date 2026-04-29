// AI configuration — safe storage with localStorage fallback.
// localStorage is blocked in sandboxed iframes (e.g. Lovable preview);
// we fall back to a module-level in-memory store so the app never crashes.

// ─── Model definitions ─────────────────────────────────────────────────────

export type AIProvider = "gemini" | "openai";

export type AIModel =
  // ── Gemini (Google AI Studio) ──
  | "gemini-2.0-flash"          // gemini-2.0-flash  — 100 RPM free
  | "gemini-2.5-flash"          // gemini-2.5-flash-preview-04-17
  | "gemini-2.5-pro"            // gemini-2.5-pro-preview-05-06
  // ── OpenAI ──
  | "gpt-4o-mini"
  | "gpt-4o";

export type ModelMeta = {
  label: string;
  provider: AIProvider;
  apiId: string;          // ID real usado na chamada à API
  freeRpm: number;        // req/min no free tier (0 = sem free tier)
  freeTpm: number;        // tokens/min no free tier
  badge: "free" | "paid" | "limited";
  note: string;
};

export const MODEL_CATALOG: Record<AIModel, ModelMeta> = {
  // —— Gemini free tier ——
  "gemini-2.0-flash": {
    label: "Gemini 2.0 Flash",
    provider: "gemini",
    apiId: "gemini-2.0-flash",
    freeRpm: 15,
    freeTpm: 1_000_000,
    badge: "free",
    note: "15 req/min gratuitos. Mais rápido e estável para uso contínuo. Recomendado.",
  },
  "gemini-2.5-flash": {
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    apiId: "gemini-2.5-flash-preview-04-17",
    freeRpm: 10,
    freeTpm: 250_000,
    badge: "free",
    note: "Melhor qualidade de raciocínio no free tier. 10 req/min.",
  },
  "gemini-2.5-pro": {
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    apiId: "gemini-2.5-pro-preview-05-06",
    freeRpm: 5,
    freeTpm: 250_000,
    badge: "limited",
    note: "Máxima qualidade. Limite de 5 req/min — use para briefings complexos.",
  },
  // —— OpenAI (pago) ——
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
};

export function getModelProvider(model: AIModel): AIProvider {
  return MODEL_CATALOG[model].provider;
}

export function isOpenAIModel(model: AIModel): boolean {
  return getModelProvider(model) === "openai";
}

/** Retorna o ID exato que a API do Gemini espera receber. */
export function geminiApiId(model: AIModel): string {
  return MODEL_CATALOG[model]?.apiId ?? "gemini-2.0-flash";
}

// ─── Config type ─────────────────────────────────────────────────────────

export type AIConfig = {
  openaiKey: string;
  geminiKey: string;
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
  model: "gemini-2.0-flash",   // padrão: mais estável no free tier
  driveEnabled: false,
  drivePath: "/Forlab/Campanhas",
  driveOutDir: "/Forlab/Materiais",
  prompts: {},
};

// ─── Safe storage helpers ─────────────────────────────────────────────────

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

// ─── Public API ─────────────────────────────────────────────────────────

export function loadAIConfig(): AIConfig {
  try {
    const raw = readRaw();
    if (!raw) return { ...DEFAULT_CONFIG };
    const saved = JSON.parse(raw) as Partial<AIConfig>;
    // Garante que modelos removidos do catalog sejam resetados para o default
    const model = saved.model && MODEL_CATALOG[saved.model]
      ? saved.model
      : DEFAULT_CONFIG.model;
    return { ...DEFAULT_CONFIG, ...saved, model };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAIConfig(config: AIConfig): void {
  writeRaw(JSON.stringify(config));
}

export function getOpenAIKey(): string   { return loadAIConfig().openaiKey; }
export function getGeminiKey(): string   { return loadAIConfig().geminiKey; }
export function getActiveModel(): AIModel { return loadAIConfig().model; }

export function getActiveKey(): string {
  const config = loadAIConfig();
  return isOpenAIModel(config.model) ? config.openaiKey : config.geminiKey;
}
