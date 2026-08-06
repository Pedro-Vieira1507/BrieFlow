// src/components/briefflow/BannerPreview.tsx
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { Sparkles, Hexagon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRef } from "react";
import { cleanText, isEmptyLike } from "@/lib/sanitize";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function BannerPreview({ state, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const themeColor = state.themeColor || "#2563EB";
  const secondaryColor = state.secondaryColor || "#FF5722";

  const title = cleanText(state.title, "Título da campanha");
  const subtitle = cleanText(state.subtitle);
  const cta = cleanText(state.cta, "Saiba mais");
  const brandName = cleanText(state.brandName, "MARCA");

  const hasSubtitle = !isEmptyLike(subtitle);
  const hasCta = !isEmptyLike(cta);

  const images = Array.from(
    new Set([
      ...(state.productImageUrl ? [state.productImageUrl] : []),
      ...(state.productImages || []),
    ]),
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({ productImageUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div
      className="mx-auto flex w-full flex-col space-y-4"
      data-testid="banner-preview"
    >
      {/*
        LAYOUT ROBUSTO
        - Grid principal em duas colunas (texto / produtos), cada uma se auto-organiza em rows.
        - BrandHeader vive na PRIMEIRA row do grid da coluna de texto (nunca absoluto sobre título).
        - Título/subtítulo usam break-words + line-clamp para não estourar.
        - CTA usa mt-auto para colar no rodapé mesmo com texto longo.
      */}
      <div
        className={cn(
          "relative isolate w-full shrink-0 overflow-hidden rounded-[24px] shadow-2xl",
          "aspect-[21/9] md:aspect-[2.5/1] min-h-[360px]",
          "grid grid-cols-1 md:grid-cols-2 bg-[#f8fafc]",
        )}
      >
        {/* Background layer decorativo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-slate-50"
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 100% 0%, ${secondaryColor}, transparent 50%)`,
            }}
          />
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 0% 100%, ${themeColor}, transparent 70%)`,
            }}
          />
        </div>

        {/* Coluna de texto */}
        <div
          className="relative z-10 flex h-full min-w-0 flex-col px-8 py-6 md:px-14 md:py-8"
          style={{ backgroundColor: themeColor }}
        >
          {/* Header da marca (row 1) */}
          <div className="flex items-center gap-2 text-white">
            <div className="grid size-8 place-items-center rounded-lg bg-white text-slate-900 shadow-lg">
              <Hexagon className="size-5 fill-current" />
            </div>
            <span className="truncate text-sm font-black uppercase tracking-widest drop-shadow-md">
              {brandName}
            </span>
          </div>

          {/* Miolo (row flexível) */}
          <div className="mt-6 flex min-h-0 flex-1 flex-col justify-center">
            <div className="mb-3 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-md">
              <Sparkles className="size-3 text-white" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                Lançamento
              </span>
            </div>

            <Editable
              as="h2"
              value={title}
              onChange={(v) => onChange({ title: v })}
              className={cn(
                "mb-3 text-white font-black leading-tight tracking-tight",
                "text-[26px] md:text-[38px]",
                "text-balance break-words line-clamp-3",
              )}
            />

            {hasSubtitle && (
              <Editable
                as="p"
                value={subtitle}
                onChange={(v) => onChange({ subtitle: v })}
                className={cn(
                  "text-white/85 font-medium leading-relaxed",
                  "text-[13px] md:text-[15px]",
                  "break-words line-clamp-2",
                )}
              />
            )}
          </div>

          {/* CTA (row rodapé, nunca cortado) */}
          {hasCta && (
            <div className="mt-6 flex">
              <div
                className={cn(
                  "inline-flex max-w-full items-center rounded-md bg-white px-6 py-3 md:px-8 md:py-3.5",
                  "font-black uppercase tracking-widest shadow-xl",
                  "transition-transform hover:scale-105",
                )}
                style={{ color: themeColor }}
              >
                <Editable
                  as="span"
                  value={cta}
                  onChange={(v) => onChange({ cta: v })}
                  className="block max-w-[24ch] truncate"
                />
              </div>
            </div>
          )}
        </div>

        {/* Coluna de produtos */}
        <div className="relative z-10 flex h-full min-h-[180px] items-center justify-center overflow-hidden">
          {images.length > 0 ? (
            images.map((src, i) => <DraggableImage key={`${src}-${i}`} src={src} />)
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center">
              <Upload className="size-5 text-slate-400" />
              <p className="text-sm font-medium text-slate-400">
                Nenhum produto importado
              </p>
              <p className="text-[11px] text-slate-400/80">
                Arraste ou faça upload abaixo
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Estúdio:{" "}
          <span style={{ color: themeColor }}>CANVAS INTERATIVO</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileRef}
            onChange={handleFileChange}
            data-testid="banner-upload-input"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-border-strong bg-surface-2 text-xs font-bold"
            onClick={() => fileRef.current?.click()}
            data-testid="banner-upload-btn"
          >
            <Upload className="mr-2 size-3.5" /> Upload Foto
          </Button>
        </div>
      </div>
    </div>
  );
}
