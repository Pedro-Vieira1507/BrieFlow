import { useEffect, useRef } from "react";
import { EditableField } from "@/components/EditableField";
import { useInlineEditor } from "@/hooks/useInlineEditor";
import { ImageIcon } from "lucide-react";

interface BannerData {
  headline?: string;
  subheadline?: string;
  cta_text?: string;
  background_url?: string;
  brand_color?: string;
  format?: "square" | "landscape" | "story" | "banner";
}

interface BannerPreviewProps {
  data: BannerData;
  sessionId?: string;
  onDataChange?: (d: BannerData) => void;
}

const FORMAT_DIMS: Record<string, { width: number; height: number; label: string }> = {
  square: { width: 500, height: 500, label: "1080×1080 (Feed)" },
  landscape: { width: 500, height: 281, label: "1920×1080 (Landscape)" },
  story: { width: 281, height: 500, label: "1080×1920 (Stories)" },
  banner: { width: 600, height: 160, label: "1200×314 (Banner)" },
};

/**
 * BannerPreview — renders a social/banner canvas with editable overlay text.
 * The background image can be replaced by clicking the image area.
 * All copy elements are inline-editable.
 */
export function BannerPreview({ data, sessionId, onDataChange }: BannerPreviewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: editable, setField, reset } = useInlineEditor({
    sessionId,
    contentType: "banner",
    initialData: data as Record<string, string>,
    onSync: (d) => onDataChange?.(d as BannerData),
  });

  useEffect(() => {
    reset(data as Record<string, string>);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);

  const fmt = FORMAT_DIMS[editable.format ?? "square"];
  const accent = editable.brand_color || "#01696f";
  const hasBg = Boolean(editable.background_url);

  function handleBgClick() {
    fileRef.current?.click();
  }

  function handleBgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setField("background_url", ev.target.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="mx-auto flex flex-col items-center gap-3">
      <span className="text-xs text-muted-foreground">{fmt.label}</span>

      {/* Canvas */}
      <div
        className="relative overflow-hidden rounded-xl border border-border shadow-lg"
        style={{
          width: fmt.width,
          height: fmt.height,
          backgroundColor: accent,
          backgroundImage: hasBg ? `url(${editable.background_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark overlay when there's a background image */}
        {hasBg && <div className="absolute inset-0 bg-black/45" />}

        {/* Editable overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center z-10">
          <EditableField
            as="h2"
            value={editable.headline ?? ""}
            onChange={(v) => setField("headline", v)}
            placeholder="Headline…"
            className="text-2xl font-extrabold leading-tight text-white drop-shadow-md"
          />
          {(editable.subheadline ?? "").length > 0 && (
            <EditableField
              as="p"
              value={editable.subheadline ?? ""}
              onChange={(v) => setField("subheadline", v)}
              placeholder="Subtítulo…"
              className="text-sm text-white/85 max-w-xs drop-shadow"
            />
          )}
          {(editable.cta_text ?? "").length > 0 && (
            <EditableField
              as="span"
              value={editable.cta_text ?? ""}
              onChange={(v) => setField("cta_text", v)}
              placeholder="CTA"
              className="mt-2 inline-block rounded-full bg-white px-6 py-2 text-sm font-bold drop-shadow"
              style={{ color: accent } as React.CSSProperties}
            />
          )}
        </div>

        {/* Replace background button */}
        <button
          onClick={handleBgClick}
          className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/70 transition-colors"
          title="Trocar imagem de fundo"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Trocar fundo
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBgChange} />
      </div>
    </div>
  );
}
