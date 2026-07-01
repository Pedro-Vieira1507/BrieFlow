import { useEffect } from "react";
import { EditableField } from "@/components/EditableField";
import { useInlineEditor } from "@/hooks/useInlineEditor";
import { Badge } from "@/components/ui/badge";

interface CopyData {
  platform?: string;
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string;
  character_count?: string;
}

interface CopyPreviewProps {
  data: CopyData;
  sessionId?: string;
  onDataChange?: (d: CopyData) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  linkedin: "bg-blue-700",
  twitter: "bg-sky-500",
  facebook: "bg-blue-600",
  tiktok: "bg-black",
};

/**
 * CopyPreview — renders a social media post preview.
 * Every text section (hook, body, CTA, hashtags) is inline-editable.
 * Shows a character counter that updates as the user types.
 */
export function CopyPreview({ data, sessionId, onDataChange }: CopyPreviewProps) {
  const { data: editable, setField, reset } = useInlineEditor({
    sessionId,
    contentType: "copy",
    initialData: data as Record<string, string>,
    onSync: (d) => onDataChange?.(d as CopyData),
  });

  useEffect(() => {
    reset(data as Record<string, string>);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);

  const platform = (editable.platform ?? "instagram").toLowerCase();
  const gradient = PLATFORM_COLORS[platform] ?? "bg-primary";
  const totalChars =
    (editable.hook?.length ?? 0) +
    (editable.body?.length ?? 0) +
    (editable.cta?.length ?? 0) +
    (editable.hashtags?.length ?? 0);

  return (
    <div className="mx-auto max-w-[520px] rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
      {/* Platform header */}
      <div className={`${gradient} px-5 py-3 flex items-center justify-between`}>
        <span className="text-sm font-semibold text-white capitalize">{platform}</span>
        <Badge variant="secondary" className="text-xs">
          {totalChars} caracteres
        </Badge>
      </div>

      {/* Post mock */}
      <div className="p-6 space-y-4">
        {/* Avatar mock */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-muted" />
          <div className="space-y-1">
            <div className="h-2.5 w-24 rounded bg-muted" />
            <div className="h-2 w-16 rounded bg-muted/70" />
          </div>
        </div>

        {/* Hook */}
        <EditableField
          as="p"
          value={editable.hook ?? ""}
          onChange={(v) => setField("hook", v)}
          placeholder="Hook — primeira linha que prende a atenção…"
          className="text-sm font-semibold leading-snug text-foreground"
        />

        {/* Body */}
        <EditableField
          as="p"
          value={editable.body ?? ""}
          onChange={(v) => setField("body", v)}
          placeholder="Corpo do post…"
          multiline
          className="text-sm leading-relaxed text-foreground/90"
        />

        {/* CTA */}
        {(editable.cta ?? "").length > 0 && (
          <EditableField
            as="p"
            value={editable.cta ?? ""}
            onChange={(v) => setField("cta", v)}
            placeholder="CTA…"
            className="text-sm font-medium text-primary"
          />
        )}

        {/* Hashtags */}
        <EditableField
          as="p"
          value={editable.hashtags ?? ""}
          onChange={(v) => setField("hashtags", v)}
          placeholder="#hashtags"
          className="text-xs text-blue-500/80 leading-relaxed"
        />
      </div>
    </div>
  );
}
