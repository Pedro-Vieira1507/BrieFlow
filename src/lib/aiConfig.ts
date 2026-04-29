// AI configuration — safe storage with localStorage fallback.
// localStorage is blocked in sandboxed iframes (e.g. Lovable preview);
// we fall back to a module-level in-memory store so the app never crashes.

export type AIModel =
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gpt-4o-mini"
  | "gpt-4o";

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

// ─── Safe storage helpers ───────────────────────────────────────────────────

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

// In-memory fallback for sandboxed environments
let _memConfig: AIConfig | null = null;

function readRaw(): string | null {
  if (storageAvailable()) {
    return localStorage.getItem(STORAGE_KEY);
  }
  return _memConfig ? JSON.stringify(_memConfig) : null;
}

function writeRaw(value: string): void {
  if (storageAvailable()) {
    localStorage.setItem(STORAGE_KEY, value);
  } else {
    try {
      _memConfig = JSON.parse(value);
    } catch {
      // ignore
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

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

export function getOpenAIKey(): string {
  return loadAIConfig().openaiKey;
}

export function getGeminiKey(): string {
  return loadAIConfig().geminiKey;
}

export function getActiveModel(): AIModel {
  return loadAIConfig().model;
}

export function isOpenAIModel(model: AIModel): boolean {
  return model.startsWith("gpt-");
}

export function getActiveKey(): string {
  const config = loadAIConfig();
  return isOpenAIModel(config.model) ? config.openaiKey : config.geminiKey;
}
