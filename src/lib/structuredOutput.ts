function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

/**
 * Normaliza as pequenas variações que ainda aparecem em modelos de raciocínio
 * mesmo quando a API está em JSON mode. Não tenta "adivinhar" conteúdo: só
 * remove envelopes conhecidos e vírgulas finais antes de validar o JSON.
 */
export function parseStructuredJson(text: string): unknown | null {
  if (!text?.trim()) return null;

  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  const candidates = [cleaned, extractBalancedJson(cleaned)].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  for (const candidate of candidates) {
    for (const normalized of [
      candidate,
      candidate.replace(/,\s*([}\]])/g, "$1"),
    ]) {
      try {
        return JSON.parse(normalized);
      } catch {
        // Tenta apenas a próxima normalização segura.
      }
    }
  }

  return null;
}

export function supportsReasoningControls(model: string): boolean {
  return /^(?:qwen\/qwen3|openai\/gpt-oss)/i.test(model);
}
