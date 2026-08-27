export type AiGenerationStage = "discovery" | "content";
export type CloudAiProviderName = "groq" | "gemini";

export interface AiRoutingEnvironment {
  groqApiKey?: string;
  geminiApiKey?: string;
  groqModel?: string;
  groqContentModel?: string;
  groqDiscoveryModel?: string;
  groqPrimaryModel?: string;
  groqFirstFallbackModel?: string;
  groqSecondFallbackModel?: string;
  geminiContentModel?: string;
  geminiDiscoveryModel?: string;
}

export interface CloudAiCandidate {
  name: CloudAiProviderName;
  url: string;
  key?: string;
  model: string;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/**
 * Mantém a decisão de modelo separada do transporte HTTP. Assim, a conversa de
 * descoberta prioriza economia e a copy final prioriza qualidade, sem duplicar
 * essa regra nos clientes de IA.
 */
export function resolveCloudAiRoute(
  stage: AiGenerationStage,
  env: AiRoutingEnvironment,
): CloudAiCandidate[] {
  const onboardingGroqModel = env.groqDiscoveryModel || env.groqModel || "openai/gpt-oss-20b";
  const primaryGroqModel = env.groqPrimaryModel || env.groqContentModel || "qwen/qwen3.8-27b";
  const firstFallbackGroqModel = env.groqFirstFallbackModel || "qwen/qwen3.6-27b";
  const secondFallbackGroqModel = env.groqSecondFallbackModel || env.groqModel || "openai/gpt-oss-20b";
  const geminiModel = stage === "content"
    ? env.geminiContentModel || "gemini-2.5-flash"
    : env.geminiDiscoveryModel || "gemini-2.5-flash-lite";

  const gemini: CloudAiCandidate = {
    name: "gemini",
    url: GEMINI_URL,
    key: env.geminiApiKey,
    model: geminiModel,
  };
  const groq = (model: string): CloudAiCandidate => ({
    name: "groq",
    url: GROQ_URL,
    key: env.groqApiKey,
    model,
  });

  const route = stage === "content"
    ? [
        groq(primaryGroqModel),
        groq(firstFallbackGroqModel),
        groq(secondFallbackGroqModel),
        gemini,
      ]
    : [
        groq(onboardingGroqModel),
        gemini,
      ];

  return route.filter((candidate) => Boolean(candidate.key));
}

export function getAiRoutingEnvironment(env: Record<string, string | undefined>): AiRoutingEnvironment {
  return {
    groqApiKey: env.VITE_GROQ_API_KEY,
    geminiApiKey: env.VITE_GEMINI_API_KEY,
    groqModel: env.VITE_GROQ_MODEL,
    groqContentModel: env.VITE_GROQ_CONTENT_MODEL,
    groqDiscoveryModel: env.VITE_GROQ_DISCOVERY_MODEL,
    groqPrimaryModel: env.VITE_GROQ_PRIMARY_MODEL,
    groqFirstFallbackModel: env.VITE_GROQ_FIRST_FALLBACK_MODEL,
    groqSecondFallbackModel: env.VITE_GROQ_SECOND_FALLBACK_MODEL,
    geminiContentModel: env.VITE_GEMINI_CONTENT_MODEL,
    geminiDiscoveryModel: env.VITE_GEMINI_DISCOVERY_MODEL,
  };
}
