// Persistent AI configuration stored in localStorage

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

export function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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
