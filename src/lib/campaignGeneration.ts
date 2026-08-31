import type { BuilderState } from "../types/builder";

const LEGACY_ERROR_TITLE = /não consegui gerar este (?:banner|e-mail)/i;
const LEGACY_ERROR_CAPTION = /não consegui gerar este post/i;

export function getGenerationErrorMessage(
  content: BuilderState,
): string | undefined {
  const explicit = content.generationError?.trim();
  if (explicit) return explicit;

  const legacyError =
    LEGACY_ERROR_TITLE.test(content.title ?? "") ||
    LEGACY_ERROR_CAPTION.test(content.caption ?? "");
  if (!legacyError) return undefined;

  return (
    content.body?.trim() ||
    content.subtitle?.trim() ||
    "A IA não conseguiu concluir esta peça agora. Tente novamente."
  );
}
