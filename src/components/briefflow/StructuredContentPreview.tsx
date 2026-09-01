import { useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Clock3,
  Download,
  FileJson,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_FORMATS } from "@/lib/plans";
import { formatStructuredContentText } from "@/lib/structuredContent";
import { downloadBlob, sanitizeFilenamePart } from "@/lib/export-utils";
import type { BuilderState, StructuredContentDocument } from "@/types/builder";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  compact?: boolean;
}

export function StructuredContentPreview({
  state,
  onChange,
  compact = false,
}: Props) {
  const document = state.structuredContent;
  const [copied, setCopied] = useState(false);
  const definition = document ? CONTENT_FORMATS[document.format] : null;
  const text = useMemo(
    () => (document ? formatStructuredContentText(document) : ""),
    [document],
  );

  if (!document || !definition) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-amber-400/20 bg-surface-1 p-10 text-center text-fg-secondary">
        O conteúdo estruturado desta peça não está disponível.
      </div>
    );
  }

  const patchDocument = (patch: Partial<StructuredContentDocument>) => {
    onChange({ structuredContent: { ...document, ...patch } });
  };

  const patchSection = (
    index: number,
    patch: Partial<StructuredContentDocument["sections"][number]>,
  ) => {
    patchDocument({
      sections: document.sections.map((section, current) =>
        current === index ? { ...section, ...patch } : section,
      ),
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
    toast.success("Conteúdo copiado");
  };

  const filename = sanitizeFilenamePart(
    `${document.format}_${state.brandName || document.title}`,
  );

  return (
    <article className="mx-auto w-full max-w-4xl overflow-hidden rounded-[28px] border border-border-strong bg-surface-1 shadow-[var(--shadow-elevated)]">
      <header className="border-b border-border-subtle bg-[radial-gradient(circle_at_10%_0%,rgba(124,105,255,0.14),transparent_50%)] px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
              {definition.label}
            </p>
            <Input
              value={document.title}
              onChange={(event) => patchDocument({ title: event.target.value })}
              aria-label="Título do conteúdo"
              className="h-auto border-0 bg-transparent p-0 font-display text-2xl font-semibold tracking-tight text-fg-primary shadow-none focus-visible:ring-0 sm:text-3xl"
            />
            {document.subtitle ? (
              <Input
                value={document.subtitle}
                onChange={(event) =>
                  patchDocument({ subtitle: event.target.value })
                }
                aria-label="Subtítulo do conteúdo"
                className="mt-2 h-auto border-0 bg-transparent p-0 text-sm text-fg-secondary shadow-none focus-visible:ring-0"
              />
            ) : null}
          </div>
          <div className="flex gap-2" data-export-exclude="true">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleCopy()}
              className="rounded-xl border-border-strong bg-surface-2"
            >
              {copied ? (
                <Check className="mr-2 size-4" />
              ) : (
                <Clipboard className="mr-2 size-4" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([text], { type: "text/plain;charset=utf-8" }),
                  `${filename}.txt`,
                )
              }
              className="rounded-xl border-border-strong bg-surface-2"
            >
              <Download className="mr-2 size-4" /> TXT
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([JSON.stringify(document, null, 2)], {
                    type: "application/json;charset=utf-8",
                  }),
                  `${filename}.json`,
                )
              }
              className="hidden rounded-xl border-border-strong bg-surface-2 sm:inline-flex"
            >
              <FileJson className="mr-2 size-4" /> JSON
            </Button>
          </div>
        </div>

        {document.summary ? (
          <Textarea
            value={document.summary}
            onChange={(event) => patchDocument({ summary: event.target.value })}
            aria-label="Resumo do conteúdo"
            className="mt-5 min-h-20 resize-y rounded-xl border-border-subtle bg-surface-2/70 text-sm leading-6 text-fg-secondary"
          />
        ) : null}

        {document.duration ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs text-fg-tertiary">
            <Clock3 className="size-3.5 text-brand" /> {document.duration}
          </div>
        ) : null}
      </header>

      <div className={compact ? "space-y-3 p-4" : "space-y-4 p-5 sm:p-8"}>
        {document.sections.map((section, index) => (
          <section
            key={section.id}
            className="rounded-2xl border border-border-subtle bg-surface-2/55 p-4 sm:p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-brand/20 bg-brand-muted text-[10px] font-bold text-brand">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Input
                value={section.title}
                onChange={(event) =>
                  patchSection(index, { title: event.target.value })
                }
                aria-label={`Título da seção ${index + 1}`}
                className="h-auto border-0 bg-transparent p-0 font-semibold text-fg-primary shadow-none focus-visible:ring-0"
              />
              {section.timing ? (
                <span className="shrink-0 text-[10px] font-medium text-fg-muted">
                  {section.timing}
                </span>
              ) : null}
            </div>

            {section.body ? (
              <Textarea
                value={section.body}
                onChange={(event) =>
                  patchSection(index, { body: event.target.value })
                }
                aria-label={`Conteúdo da seção ${index + 1}`}
                className="min-h-24 resize-y rounded-xl border-border-subtle bg-surface-1/70 text-sm leading-6 text-fg-secondary"
              />
            ) : null}

            {section.items?.length ? (
              <div className="mt-3 rounded-xl border border-border-subtle bg-surface-1/50 p-3">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                  <ListChecks className="size-3.5" /> Itens
                </p>
                <Textarea
                  value={section.items.join("\n")}
                  onChange={(event) =>
                    patchSection(index, {
                      items: event.target.value
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                  aria-label={`Itens da seção ${index + 1}`}
                  className="min-h-16 resize-y border-0 bg-transparent p-0 text-xs leading-5 text-fg-secondary shadow-none focus-visible:ring-0"
                />
              </div>
            ) : null}

            {section.visualDirection ? (
              <p className="mt-3 text-xs leading-5 text-fg-tertiary">
                <span className="font-semibold text-fg-secondary">
                  Direção visual:
                </span>{" "}
                {section.visualDirection}
              </p>
            ) : null}
            {section.speakerNotes ? (
              <p className="mt-2 text-xs leading-5 text-fg-muted">
                <span className="font-semibold">Notas:</span>{" "}
                {section.speakerNotes}
              </p>
            ) : null}
          </section>
        ))}

        {document.cta || document.disclaimer ? (
          <footer className="rounded-2xl border border-border-subtle bg-surface-2/30 p-4 text-sm leading-6 text-fg-secondary">
            {document.cta ? (
              <p>
                <strong>Próxima ação:</strong> {document.cta}
              </p>
            ) : null}
            {document.disclaimer ? (
              <p className="mt-2 text-xs text-fg-muted">
                {document.disclaimer}
              </p>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}
