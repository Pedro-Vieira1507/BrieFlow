// AI configuration — safe storage with localStorage fallback.
// localStorage is blocked in sandboxed iframes (e.g. Lovable preview);
// we fall back to a module-level in-memory store so the app never crashes.

// ─── Model definitions ──────────────────────────────────────────────────────

export type AIProvider = "gemini" | "openai";

export type AIModel =
  // ── Gemini free-tier (Google AI Studio) ──
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-2.5-pro"
  | "gemini-3-flash"
  | "gemini-3.1-flash"
  | "gemini-3.1-pro"
  // ── OpenAI ──
  | "gpt-4o-mini"
  | "gpt-4o";

export type ModelMeta = {
  label: string;
  provider: AIProvider;
  /** Free tier RPM (requests/min). 0 = not available on free tier. */
  freeRpm: number;
  /** Free tier TPM (tokens/min). 0 = not available. */
  freeTpm: number;
  badge: "free" | "paid" | "limited";
  note: string;
};

export const MODEL_CATALOG: Record<AIModel, ModelMeta> = {
  // Free tier — recommended
  "gemini-2.5-flash": {
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    freeRpm: 10,
    freeTpm: 250_000,
    badge: "free",
    note: "Melhor custo-benefício — rápido e preciso. Recomendado.",
  },
  "gemini-2.5-flash-lite": {
    label: "Gemini 2.5 Flash Lite",
    provider: "gemini",
    freeRpm: 10,
    freeTpm: 250_000,
    badge: "free",
    note: "Versão mais leve do Flash — ideal para testes rápidos.",
  },
  "gemini-3-flash": {
    label: "Gemini 3 Flash",
    provider: "gemini",
    freeRpm: 100,
    freeTpm: 30_000,
    badge: "free",
    note: "Alta taxa de requisições gratuitas (100 RPM). Bom para uso contínuo.",
  },
  "gemini-3.1-flash": {
    label: "Gemini 3.1 Flash",
    provider: "gemini",
    freeRpm: 10,
    freeTpm: 250_000,
    badge: "free",
    note: "Versão mais recente do Flash — qualidade superior ao 3 Flash.",
  },
  // Free tier — premium quality
  "gemini-2.5-pro": {
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    freeRpm: 5,
    freeTpm: 250_000,
    badge: "limited",
    note: "Máxima qualidade de raciocínio. Limite de 5 req/min no free tier.",
  },
  "gemini-3.1-pro": {
    label: "Gemini 3.1 Pro",
    provider: "gemini",
    freeRpm: 5,
    freeTpm: 250_000,
    badge: "limited",
    note: "Mais recente e poderoso. 5 req/min — use para briefings complexos.",
  },
  // OpenAI (paid)
  "gpt-4o-mini": {
    label: "GPT-4o Mini",
    provider: "openai",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Rápido e econômico. Requer chave OpenAI com créditos.",
  },
  "gpt-4o": {
    label: "GPT-4o",
    provider: "openai",
    freeRpm: 0,
    freeTpm: 0,
    badge: "paid",
    note: "Melhor qualidade OpenAI. Requer chave OpenAI com créditos.",
  },
};

// Helper to get provider of a model
export function getModelProvider(model: AIModel): AIProvider {
  return MODEL_CATALOG[model].provider;
}

export function isOpenAIModel(model: AIModel): boolean {
  return getModelProvider(model) === "openai";
}

// ─── Config type ─────────────────────────────────────────────────────────────

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
  model: "gemini-2.5-flash",
  driveEnabled: false,
  drivePath: "/Forlab/Campanhas",
  driveOutDir: "/Forlab/Materiais",
  prompts: {},
};

// ─── Safe storage helpers ────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

export function loadAIConfig(): AIConfig {
  try {
    const raw = readRaw();
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAIConfig(config: AIConfig): void {
  writeRaw(JSON.stringify(config));
}

export function getOpenAIKey(): string  { return loadAIConfig().openaiKey; }
export function getGeminiKey(): string  { return loadAIConfig().geminiKey; }
export function getActiveModel(): AIModel { return loadAIConfig().model; }

export function getActiveKey(): string {
  const config = loadAIConfig();
  return isOpenAIModel(config.model) ? config.openaiKey : config.geminiKey;
}
