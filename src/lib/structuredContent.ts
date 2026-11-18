import type { BuilderState, StructuredContentDocument } from "../types/builder";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function formatStructuredContentText(
  document: StructuredContentDocument,
): string {
  if (document.format === "whatsapp") {
    const normalize = (text: string) =>
      text
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    const sections = document.sections.filter(
      (section) =>
        !/^(?:direcao|notas?|observac(?:ao|oes)|instrucoes|palavras chave|estrategia|publico alvo|objetivo|sugest(?:ao|oes) de envio|cta|chamada para acao)\b/.test(
          normalize(section.title),
        ),
    );
    const paragraphs = sections.flatMap((section) =>
      [clean(section.body), ...(section.items ?? []).map(clean)].filter(
        Boolean,
      ),
    );
    const cta =
      clean(document.cta) ||
      clean(
        document.sections.find((section) =>
          /^(?:cta|chamada para acao)\b/.test(normalize(section.title)),
        )?.body,
      );
    if (
      cta &&
      !` ${normalize(paragraphs.join(" "))} `.includes(` ${normalize(cta)} `)
    )
      paragraphs.push(cta);
    return paragraphs.join("\n\n");
  }

  const output: string[] = [document.title];

  if (clean(document.subtitle)) output.push(clean(document.subtitle));
  if (clean(document.summary)) output.push(clean(document.summary));
  if (clean(document.duration)) {
    output.push(`Duração/Extensão: ${clean(document.duration)}`);
  }

  document.sections.forEach((section, index) => {
    output.push(`${index + 1}. ${clean(section.title) || "Seção"}`);
    if (clean(section.timing)) output.push(`Timing: ${clean(section.timing)}`);
    if (clean(section.body)) output.push(clean(section.body));
    if (section.items?.length) {
      output.push(...section.items.map((item) => `- ${clean(item)}`));
    }
    if (document.format !== "blog" && clean(section.visualDirection)) {
      output.push(`Direção visual: ${clean(section.visualDirection)}`);
    }
    if (document.format !== "blog" && clean(section.speakerNotes)) {
      output.push(`Notas: ${clean(section.speakerNotes)}`);
    }
  });

  if (clean(document.cta)) output.push(`CTA: ${clean(document.cta)}`);
  if (document.keywords?.length) {
    output.push(`Palavras-chave: ${document.keywords.join(", ")}`);
  }
  if (clean(document.disclaimer)) {
    output.push(`Observações: ${clean(document.disclaimer)}`);
  }

  return output.filter(Boolean).join("\n\n").trim();
}

export function getStructuredDocument(
  state: BuilderState | undefined,
): StructuredContentDocument | null {
  if (!state?.structuredContent) return null;
  return state.structuredContent;
}
