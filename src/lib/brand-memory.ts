/**
 * brand-memory.ts — memória de marca por conversa (RAG local).
 *
 * Cada thread pode ter um perfil de marca associado, construído
 * progressivamente via perguntas do agente. O perfil é salvo no
 * localStorage junto ao thread e injetado como contexto em cada
 * chamada ao Ollama.
 */

export interface BrandProfile {
  threadId: string;
  companyName?: string;
  sector?: string;
  primaryColor?: string;
  secondaryColor?: string;
  toneOfVoice?: string;
  targetAudience?: string;
  website?: string;
  extra?: string; // notas livres
  updatedAt: number;
}

const KEY = "marketing-ai:brand:v1";

function safeRead(): BrandProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BrandProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(profiles: BrandProfile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profiles));
  } catch {
    // ignore quota
  }
}

export function getBrandProfile(threadId: string): BrandProfile | undefined {
  return safeRead().find((p) => p.threadId === threadId);
}

export function saveBrandProfile(profile: BrandProfile) {
  const all = safeRead();
  const idx = all.findIndex((p) => p.threadId === profile.threadId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...profile, updatedAt: Date.now() };
  } else {
    all.push({ ...profile, updatedAt: Date.now() });
  }
  safeWrite(all);
}

export function deleteBrandProfile(threadId: string) {
  safeWrite(safeRead().filter((p) => p.threadId !== threadId));
}

/**
 * Converte o perfil de marca em um bloco de contexto pronto
 * para ser inserido no system prompt do Ollama.
 */
export function brandContextBlock(profile?: BrandProfile): string {
  if (!profile) return "";
  const lines: string[] = ["=== MEMÓRIA DE MARCA DESTA CONVERSA ==="];
  if (profile.companyName) lines.push(`Empresa: ${profile.companyName}`);
  if (profile.sector) lines.push(`Setor: ${profile.sector}`);
  if (profile.primaryColor) lines.push(`Cor principal: ${profile.primaryColor}`);
  if (profile.secondaryColor) lines.push(`Cor secundária: ${profile.secondaryColor}`);
  if (profile.toneOfVoice) lines.push(`Tom de voz: ${profile.toneOfVoice}`);
  if (profile.targetAudience) lines.push(`Público-alvo: ${profile.targetAudience}`);
  if (profile.website) lines.push(`Website: ${profile.website}`);
  if (profile.extra) lines.push(`Notas adicionais: ${profile.extra}`);
  lines.push("===");
  return lines.join("\n");
}

/**
 * Detecta se o usuário está fornecendo informações de marca
 * numa mensagem livre (ex: "minha empresa é...", "use a cor #ff6600").
 * Extrai e retorna um patch parcial do BrandProfile.
 */
export function extractBrandInfo(text: string): Partial<BrandProfile> {
  const patch: Partial<BrandProfile> = {};
  const lower = text.toLowerCase();

  // Nome da empresa
  const companyMatch = text.match(
    /(?:empresa(?:\s+[eé])?|company is|minha marca(?:\s+[eé])?|nosso produto(?:\s+[eé])?)\s+["']?([A-ZÀ-Úa-zà-ú0-9 &._-]{2,40})["']?/i
  );
  if (companyMatch) patch.companyName = companyMatch[1].trim();

  // Cor (hex ou nome)
  const colorMatches = text.match(/#[0-9a-fA-F]{3,6}|(?:laranja|azul|verde|vermelho|preto|branco|cinza|roxo|amarelo|rosa)/gi);
  if (colorMatches) {
    if (!patch.primaryColor) patch.primaryColor = colorMatches[0];
    if (colorMatches[1]) patch.secondaryColor = colorMatches[1];
  }

  // Tom de voz
  if (/\b(informal|formal|descontra[ií]do|profissional|divertido|s[eé]rio|t[eé]cnico|amig[aá]vel)\b/i.test(lower)) {
    const toneMatch = lower.match(
      /\b(informal|formal|descontra[ií]do|profissional|divertido|s[eé]rio|t[eé]cnico|amig[aá]vel)\b/i
    );
    if (toneMatch) patch.toneOfVoice = toneMatch[0];
  }

  // Público-alvo
  const audienceMatch = text.match(
    /(?:p[uú]blico[- ]alvo(?:\s+[eé])?|nosso\s+cliente(?:\s+[eé])?|target(?:\s+is)?)\s+([^.,;\n]{5,60})/i
  );
  if (audienceMatch) patch.targetAudience = audienceMatch[1].trim();

  return patch;
}

/**
 * Detecta se a mensagem é um pedido de onboarding explícito
 * (usuário quer configurar a marca).
 */
export function isBrandSetupRequest(text: string): boolean {
  return /\b(configur|define|salv|guard|memoriz|lembr|minha\s+marca|dados\s+da\s+empresa|perfil\s+da\s+marca)\b/i.test(
    text.toLowerCase()
  );
}
