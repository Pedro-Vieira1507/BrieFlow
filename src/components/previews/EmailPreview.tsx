import { useEffect } from "react";
import { EditableField } from "@/components/EditableField";
import { useInlineEditor } from "@/hooks/useInlineEditor";
import { cn } from "@/lib/utils";

interface EmailData {
  subject?: string;
  preheader?: string;
  headline?: string;
  subheadline?: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  footer?: string;
  brand_color?: string;
  logo_url?: string;
}

interface EmailPreviewProps {
  data: EmailData;
  sessionId?: string;
  onDataChange?: (d: EmailData) => void;
}

/**
 * EmailPreview — renders a realistic email template with fully inline-editable fields.
 * Every text node can be clicked and edited directly. Changes are debounce-synced
 * with the backend session via useInlineEditor.
 */
export function EmailPreview({ data, sessionId, onDataChange }: EmailPreviewProps) {
  const { data: editable, setField, reset } = useInlineEditor({
    sessionId,
    contentType: "email",
    initialData: data as Record<string, string>,
    onSync: (d) => onDataChange?.(d as EmailData),
  });

  // Reset when a new artifact arrives
  useEffect(() => {
    reset(data as Record<string, string>);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);

  const accent = editable.brand_color || "#01696f";

  return (
    <div className="mx-auto max-w-[600px] rounded-xl border border-border bg-white shadow-lg overflow-hidden text-[#1a1a1a] font-sans">
      {/* Meta strip — subject + preheader */}
      <div className="border-b border-border/60 bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-foreground">Assunto:</span>
          <EditableField
            as="span"
            value={editable.subject ?? ""}
            onChange={(v) => setField("subject", v)}
            placeholder="Linha de assunto…"
            className="flex-1 text-foreground font-medium"
          />
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="font-semibold">Preheader:</span>
          <EditableField
            as="span"
            value={editable.preheader ?? ""}
            onChange={(v) => setField("preheader", v)}
            placeholder="Texto de previsualização…"
            className="flex-1"
          />
        </div>
      </div>

      {/* Hero banner */}
      <div
        className="flex flex-col items-center justify-center px-8 py-12 text-center"
        style={{ backgroundColor: accent }}
      >
        {editable.logo_url && (
          <img
            src={editable.logo_url}
            alt="Logo"
            className="mb-6 h-10 w-auto object-contain"
          />
        )}
        <EditableField
          as="h1"
          value={editable.headline ?? ""}
          onChange={(v) => setField("headline", v)}
          placeholder="Headline principal…"
          className="text-2xl font-bold leading-tight text-white"
        />
        {(editable.subheadline ?? "").length > 0 && (
          <EditableField
            as="p"
            value={editable.subheadline ?? ""}
            onChange={(v) => setField("subheadline", v)}
            placeholder="Subtítulo…"
            className="mt-3 text-base text-white/85 max-w-md"
          />
        )}
      </div>

      {/* Body */}
      <div className="px-8 py-8">
        <EditableField
          as="p"
          value={editable.body ?? ""}
          onChange={(v) => setField("body", v)}
          placeholder="Corpo do e-mail…"
          multiline
          className="text-sm leading-relaxed text-[#444]"
        />

        {/* CTA button */}
        <div className="mt-8 flex justify-center">
          <EditableField
            as="span"
            value={editable.cta_text ?? ""}
            onChange={(v) => setField("cta_text", v)}
            placeholder="Texto do botão"
            className={cn(
              "inline-block rounded-lg px-8 py-3 text-sm font-bold text-white cursor-text"
            )}
            style={{ backgroundColor: accent } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/40 bg-muted/30 px-8 py-5 text-center">
        <EditableField
          as="p"
          value={editable.footer ?? ""}
          onChange={(v) => setField("footer", v)}
          placeholder="Rodapé do e-mail…"
          multiline
          className="text-xs text-muted-foreground leading-relaxed"
        />
      </div>
    </div>
  );
}
