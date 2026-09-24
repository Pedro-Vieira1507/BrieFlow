type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      const block = object(part);
      return block?.type === "text" && typeof block.text === "string"
        ? block.text
        : "";
    })
    .join("")
    .trim();
}

/** Accept native Workers AI envelopes and OpenAI-compatible completions.
 * Reasoning and tool arguments must never become user-facing copy.
 */
export function readAiCompletion(payload: unknown): {
  content: string;
  finishReason: string | null;
  usage: { prompt_tokens?: number; completion_tokens?: number };
} {
  const root = object(payload) ?? {};
  const result = object(root.result) ?? root;
  const choices = Array.isArray(result.choices) ? result.choices : [];
  const choice = object(choices[0]);
  const message = object(choice?.message);
  const usage = object(result.usage) ?? object(root.usage) ?? {};
  const tokenCount = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : undefined;
  return {
    content:
      textContent(root.result) ||
      textContent(result.response) ||
      textContent(message?.content),
    finishReason:
      typeof choice?.finish_reason === "string" ? choice.finish_reason : null,
    usage: {
      prompt_tokens: tokenCount(usage.prompt_tokens),
      completion_tokens: tokenCount(usage.completion_tokens),
    },
  };
}

/** Respect long cooldowns by moving to the next provider, without early retries. */
export function boundedRetryDelay(
  header: string | null,
  now = Date.now(),
): number | null {
  if (!header?.trim()) return 1500;
  const seconds = Number(header);
  const duration = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(header) - now;
  if (!Number.isFinite(duration)) return 1500;
  return duration > 4000 ? null : Math.max(750, duration);
}
