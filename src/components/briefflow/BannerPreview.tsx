// src/components/briefflow/BannerPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Sparkles, Hexagon, Upload, ImagePlus, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanText, isEmptyLike } from "@/lib/sanitize";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function BannerPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const themeColor = state.themeColor || "#2563EB";
  const secondaryColor = state.secondaryColor || "#FF5722";
  const title = cleanText(state.title, "Título da campanha");
  const subtitle = cleanText(state.subtitle);
  const cta = cleanText(state.cta, "Saiba mais");
  const brandName = cleanText(state.brandName, "MARCA");
  const prompt = cleanText(state.imagePrompt || "");
  const isProductImage = !!state.productImageUrl;

  const hasSubtitle = !isEmptyLike(subtitle);
  const hasCta = !isEmptyLike(cta);

  const images = Array.from(
    new Set([
      ...(state.productImageUrl ? [state.productImageUrl] : []),
      ...(state.productImages || []),
    ]),
  );

  const heroUrl = useMemo(() => {
    if (!prompt) return null;
    return useFallback
      ? buildFallbackUrl(prompt, { width: 800, height: 800, seed: state.imageSeed })
      : buildPollinationsUrl(prompt, { width: 800, height: 800, seed: state.imageSeed });
  }, [prompt, state.imageSeed, useFallback]);

  useEffect(() => {
    if (!heroUrl) return;
    setImageStatus("loading");

    const timer = setTimeout(() => {
      setImageStatus((prev) => {
        if (prev === "loading") {
          if (!useFallback && !isProductImage) {
            setUseFallback(true);
            return "loading";
          }
          return "error";
        }
        return prev;
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [heroUrl, useFallback, isProductImage]);

  const handleImageError = () => {
    if (!useFallback && !isProductImage) setUseFallback(true);
    else setImageStatus("error");
  };

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

  const handleRegenerate = () => {
    setImageStatus("loading");
    setUseFallback(false);
    onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
  };

  return (
    <div className="mx-auto flex w-full flex-col space-y-3" data-testid="banner-preview">
      
      {/* PAI: O @container fica sozinho aqui fora para medir larguras com precisão */}
      <div id="banner-export-node" className="@container w-full h-full">
         
        {/* FILHO: Aqui ficam as regras de Flex que observam o @container */}
        <div
          id="banner-inner-wrapper"
          className={cn(
            "relative isolate w-full h-full shrink-0 overflow-hidden shadow-2xl",
            "rounded-[20px]", 
            "min-h-[380px]", 
            "flex flex-col @xl:flex-row items-stretch", 
          )}
          style={{
            background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 55%, ${secondaryColor}99 100%)`,
          }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute -right-20 -top-20 size-[420px] rounded-full opacity-10"
              style={{ background: `radial-gradient(circle, ${secondaryColor}, transparent 70%)` }}
            />
            <div
              className="absolute -bottom-16 -left-16 size-[300px] rounded-full opacity-15"
              style={{ background: `radial-gradient(circle, #ffffff, transparent 65%)` }}
            />
          </div>

          {/* ÁREA DE TEXTO */}
          <div className="relative z-10 flex w-full @xl:w-[55%] shrink-0 flex-col justify-center overflow-hidden min-h-0 px-6 py-5 @xl:px-10 @xl:py-5">
             
            <div className="flex items-center gap-2 mb-3 @xl:mb-4 shrink-0">
              <div
                className="grid size-7 @xl:size-8 shrink-0 place-items-center rounded-lg shadow-lg"
                style={{ backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
              >
                <Hexagon className="size-4 text-white drop-shadow-sm" />
              </div>
              <span className="truncate text-[10px] @xl:text-[11px] font-black uppercase tracking-[0.2em] text-[rgba(255,255,255,0.9)] drop-shadow-sm">
                {brandName}
              </span>
            </div>

            <div className="flex min-h-0 flex-col justify-center gap-2 @xl:gap-2.5 shrink-0">
              <div className="flex w-fit items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.1)] px-2.5 py-1 backdrop-blur-md">
                <Sparkles className="size-3 text-[#fde047]" />
                <span className="text-[9px] @xl:text-[10px] font-extrabold uppercase tracking-widest text-[rgba(255,255,255,0.9)]">
                  Lançamento
                </span>
              </div>

              {/* Ajuste fino na fonte e linha para não cortar nada */}
              <Editable
                as="h2"
                value={title}
                onChange={(v) => onChange({ title: v })}
                className={cn(
                  "font-black leading-[1.15] tracking-tight text-white drop-shadow-md",
                  "text-[20px] @sm:text-[24px] @md:text-[28px] @xl:text-[32px] @3xl:text-[36px]",
                  "break-words",
                )}
              />

              {hasSubtitle && (
                <Editable
                  as="p"
                  value={subtitle}
                  onChange={(v) => onChange({ subtitle: v })}
                  className={cn(
                    "font-medium leading-snug text-[rgba(255,255,255,0.85)]",
                    "text-[12px] @xl:text-[14px]",
                    "break-words",
                  )}
                />
              )}
            </div>

            {hasCta && (
              <div className="mt-3 @xl:mt-4 flex shrink-0">
                <div
                  className={cn(
                    "inline-flex max-w-full items-center rounded-lg @xl:rounded-xl",
                    "px-5 py-2.5 @xl:px-6 @xl:py-3",
                    "font-black uppercase tracking-widest shadow-2xl",
                    "transition-transform duration-200 hover:scale-105 cursor-pointer",
                    "border border-[rgba(255,255,255,0.1)]",
                  )}
                  style={{
                    backgroundColor: "white",
                    color: themeColor,
                  }}
                >
                  <Editable
                    as="span"
                    value={cta}
                    onChange={(v) => onChange({ cta: v })}
                    className="block max-w-[24ch] truncate text-[10px] @xl:text-[12px]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ÁREA DA IMAGEM */}
          <div
            className={cn(
              "relative z-10 flex w-full @xl:w-[45%] shrink-0 flex-col items-center justify-center overflow-hidden",
              "min-h-[160px] @xl:min-h-0", 
              "@xl:border-l @xl:border-[rgba(255,255,255,0.1)]",
            )}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom-left, ${secondaryColor}30, ${themeColor}20)`,
                backdropFilter: "blur(2px)",
              }}
            />
            
            {heroUrl && (
               <>
                 {imageStatus === "loading" && (
                   <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(0,0,0,0.2)] backdrop-blur-sm">
                     <Loader2 className="size-8 animate-spin text-[rgba(255,255,255,0.5)]" />
                   </div>
                 )}

                 {imageStatus === "error" ? (
                   <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.2)] backdrop-blur-sm">
                     <AlertCircle className="mb-2 size-8 text-[rgba(255,255,255,0.5)]" />
                   </div>
                 ) : (
                   <img
                     src={heroUrl}
                     alt="Arte do Banner"
                     crossOrigin="anonymous" 
                     onLoad={() => setImageStatus("loaded")}
                     onError={handleImageError}
                     loading="lazy"
                     className={cn(
                       "absolute inset-0 z-0 h-full w-full object-cover mix-blend-overlay opacity-60",
                       "transition-opacity duration-700",
                       imageStatus === "loading" ? "opacity-0" : "opacity-100",
                     )}
                   />
                 )}
               </>
            )}

            {images.length > 0 ? (
              <div className="relative z-20 flex h-full w-full items-center justify-center">
                {images.map((src, i) => (
                  <DraggableImage key={`${src}-${i}`} src={src} />
                ))}
              </div>
            ) : !heroUrl ? (
              <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-8 text-center">
                <div
                  className="flex size-16 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.2)] shadow-inner"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
                >
                  <ImagePlus className="size-7 text-[rgba(255,255,255,0.6)]" />
                </div>
                <div className="space-y-1">
                  <p className="text-[13px] font-bold text-[rgba(255,255,255,0.7)]">
                    Canvas de Produto
                  </p>
                  <p className="text-[11px] text-[rgba(255,255,255,0.45)]">
                    Faça upload para visualizar
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3 opacity-80 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Peça:{" "}
          <span style={{ color: themeColor }} className="mr-3">
            BANNER INSTITUCIONAL
          </span>
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
          <Button size="sm" variant="outline" className="h-8 shrink-0 border-border-strong bg-surface-2 text-xs font-bold" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Upload Foto
          </Button>
          <Button size="sm" variant="ghost" className="h-8 shrink-0 text-xs font-bold" onClick={handleRegenerate}>
            <RefreshCw className="mr-1.5 size-3.5" /> Gerar IA
          </Button>
        </div>
      </div>
    </div>
  );
}