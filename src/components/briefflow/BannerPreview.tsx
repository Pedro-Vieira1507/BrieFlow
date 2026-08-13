// src/components/briefflow/BannerPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Upload, ImagePlus, RefreshCw, Loader2, AlertCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanText, isEmptyLike } from "@/lib/sanitize";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  exportWrapperClass?: string;
  exportWrapperStyle?: React.CSSProperties;
}

export function BannerPreview({ state, onChange, exportWrapperClass, exportWrapperStyle }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const themeColor = state.themeColor || "#0080ff";
  const title = cleanText(state.title, "Equipamentos que impulsionam a performance");
  const subtitle = cleanText(state.subtitle);
  const bodyText = cleanText(state.body);
  const footerInfo = cleanText(state.footerInfo);
  const benefits = state.keyBenefits || [];
  
  const prompt = cleanText(state.imagePrompt || "");
  const isProductImage = !!state.productImageUrl;
  
  const badgePrimary = cleanText(state.badgePrimary);
  const badgeSecondary = cleanText(state.badgeSecondary);
  const backgroundShape = state.backgroundShape || "curve";
  const layoutStyle = state.layoutStyle || "split";

  const hasSubtitle = !isEmptyLike(subtitle);
  const images = Array.from(
    new Set([
      ...(state.productImageUrl ? [state.productImageUrl] : []),
      ...(state.productImages || []),
    ]),
  );

  const heroUrl = useMemo(() => {
    if (!prompt) return null;
    return useFallback
      ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed })
      : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed });
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

  const isCurve = backgroundShape === "curve";
  const isDiagonal = backgroundShape === "diagonal";
  const isReverse = layoutStyle === "reverse";
  const isCentered = layoutStyle === "centered" || layoutStyle === "minimalist";

  // CLASSES DE GEOMETRIA (Normal vs Modo Vertical/Mobile export)
  const shapeClass = isCurve 
    ? isReverse 
      ? "[clip-path:ellipse(80%_150%_at_100%_50%)] [.force-mobile_&]:![clip-path:ellipse(150%_100%_at_50%_100%)]" 
      : "[clip-path:ellipse(80%_150%_at_0%_50%)] [.force-mobile_&]:![clip-path:ellipse(150%_100%_at_50%_100%)]"
    : isDiagonal
      ? isReverse
        ? "[clip-path:polygon(20%_0,100%_0,100%_100%,0%_100%)] [.force-mobile_&]:![clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]"
        : "[clip-path:polygon(0_0,100%_0,80%_100%,0%_100%)] [.force-mobile_&]:![clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]"
      : "";

  const lineClass = isCurve
    ? isReverse
      ? "[clip-path:ellipse(83%_155%_at_100%_50%)] [.force-mobile_&]:![clip-path:ellipse(155%_103%_at_50%_100%)]"
      : "[clip-path:ellipse(83%_155%_at_0%_50%)] [.force-mobile_&]:![clip-path:ellipse(155%_103%_at_50%_100%)]"
    : "";

  return (
    <div className="mx-auto flex w-full flex-col space-y-3" data-testid="banner-preview">
      {/* 
        Container Principal. No preview, ele usa 'aspect-[2/1] min-h-[380px]'. 
        Na exportação vertical, o PageBuilder injeta '.force-mobile' aqui dentro, ativando as overrides mágicas. 
      */}
      <div 
         id="banner-export-node" 
         className={cn(
            "relative w-full overflow-hidden shadow-2xl bg-slate-100 flex rounded-[16px]",
            exportWrapperClass || "aspect-[2/1] min-h-[380px]",
            isCentered ? "flex-col" : "[.force-mobile_&]:!flex-col"
         )}
         style={exportWrapperStyle}
      >
         {isCentered ? (
            /* =========================================
               LAYOUT CENTRALIZADO
            ========================================= */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-8 md:p-12 text-center [.force-mobile_&]:!p-6">
               <div className="absolute inset-0 z-0 bg-[#0a192f]">
                  {heroUrl && <img src={heroUrl} crossOrigin="anonymous" className="w-full h-full object-cover opacity-30 mix-blend-luminosity" />}
               </div>
               <div className="absolute inset-0 z-10 opacity-90 mix-blend-multiply" style={{ backgroundColor: themeColor }} />
               
               <div className="relative z-20 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                  <div className="bg-[#0a192f] text-white p-6 md:p-8 rounded-[16px] shadow-xl relative mb-4 w-full max-w-2xl pointer-events-auto [.force-mobile_&]:!p-5 [.force-mobile_&]:!max-w-[90%]">
                      <Editable as="h2" value={title} onChange={(v)=>onChange({title:v})} className="font-bold text-[24px] md:text-[36px] leading-[1.15] break-words [.force-mobile_&]:!text-[24px]" />
                  </div>
                  
                  {hasSubtitle && <Editable as="p" multiline value={subtitle} onChange={(v)=>onChange({subtitle:v})} className="text-white/95 font-medium text-[14px] md:text-[18px] leading-relaxed max-w-[90%] break-words mb-2 drop-shadow-md pointer-events-auto [.force-mobile_&]:!text-[14px]" />}
                  {bodyText && <Editable as="p" multiline value={bodyText} onChange={(v)=>onChange({body:v})} className="text-white/80 font-normal text-[12px] md:text-[14px] leading-relaxed max-w-[90%] break-words mb-4 drop-shadow-md pointer-events-auto hidden md:block [.force-mobile_&]:!hidden" />}
                  
                  {benefits.length > 0 && (
                     <div className="flex flex-wrap justify-center gap-2 mt-2 pointer-events-auto">
                        {benefits.map((ben, i) => (
                           <span key={i} className="bg-white/10 border border-white/20 text-white text-[10px] md:text-[11px] uppercase tracking-wider font-bold px-3 py-1 rounded shadow-sm backdrop-blur-sm [.force-mobile_&]:!text-[9px]">{ben}</span>
                        ))}
                     </div>
                  )}

                  {footerInfo && (
                     <div className="mt-auto pt-6 pointer-events-auto">
                        <Editable as="p" value={footerInfo} onChange={(v)=>onChange({footerInfo:v})} className="text-white/60 font-medium text-[10px] md:text-[12px] uppercase tracking-widest break-words [.force-mobile_&]:!text-[9px]" />
                     </div>
                  )}

                  {(badgePrimary || badgeSecondary) && (
                     <div className="absolute z-30 bottom-6 right-6 flex flex-col items-end gap-2 pointer-events-auto [.force-mobile_&]:!bottom-4 [.force-mobile_&]:!right-4">
                        {badgePrimary && (
                           <div className="bg-[#0a192f] text-white rounded-full size-[90px] md:size-[120px] flex items-center justify-center text-center p-3 shadow-2xl border-[4px] border-white [.force-mobile_&]:!size-[80px]">
                              <Editable as="span" value={badgePrimary} onChange={(v)=>onChange({badgePrimary:v})} className="font-black text-2xl md:text-3xl leading-[1.1] [.force-mobile_&]:!text-xl" />
                           </div>
                        )}
                        {badgeSecondary && (
                           <div className="bg-white rounded-full px-4 py-2 text-center shadow-xl border-2 border-slate-100 relative z-10">
                              <Editable as="span" value={badgeSecondary} onChange={(v)=>onChange({badgeSecondary:v})} className="font-bold text-[11px] md:text-xs leading-tight" style={{ color: themeColor }} />
                           </div>
                        )}
                     </div>
                  )}
               </div>
            </div>
         ) : (
            /* =========================================
               LAYOUTS SPLIT E REVERSE
            ========================================= */
            <div className={cn("relative w-full h-full flex overflow-hidden", isReverse ? "flex-row-reverse" : "flex-row", "[.force-mobile_&]:!flex-col")}>
               
               {/* 1. IMAGEM AO FUNDO */}
               <div className={cn(
                  "absolute inset-y-0 z-0 flex items-center justify-center overflow-hidden w-[55%]", 
                  isReverse ? "left-0" : "right-0",
                  "[.force-mobile_&]:!inset-auto [.force-mobile_&]:!top-0 [.force-mobile_&]:!left-0 [.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%]"
               )}>
                  {heroUrl && !images.length && (
                     <img src={heroUrl} crossOrigin="anonymous" className={cn("w-full h-full object-cover transition-opacity duration-700 opacity-90", imageStatus === "loading" ? "opacity-0" : "opacity-100")} onLoad={() => setImageStatus("loaded")} onError={handleImageError} />
                  )}
                  {images.length > 0 ? (
                     <div className="relative z-30 flex h-full w-full items-center justify-center">
                        {images.map((src, i) => <DraggableImage key={`${src}-${i}`} src={src} />)}
                     </div>
                  ) : !heroUrl ? (
                     <div className={cn("relative z-10 flex h-full items-center justify-center w-full", isReverse ? "justify-start pl-[5%]" : "justify-end pr-[5%]", "[.force-mobile_&]:!justify-center [.force-mobile_&]:!px-0")}>
                        <div className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 backdrop-blur-sm">
                           <ImagePlus className="size-8 text-slate-400" />
                           <p className="text-sm font-bold text-slate-500">Upload</p>
                        </div>
                     </div>
                  ) : null}
               </div>

               {/* 2. GEOMETRIAS DO FUNDO COLORIDO */}
               <div className={cn(
                  "absolute inset-y-0 w-[65%] z-10 shadow-[10px_0_30px_rgba(0,0,0,0.2)] pointer-events-none", 
                  isReverse ? "right-0" : "left-0",
                  shapeClass,
                  "[.force-mobile_&]:!inset-auto [.force-mobile_&]:!bottom-0 [.force-mobile_&]:!left-0 [.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%] [.force-mobile_&]:!shadow-[0_-10px_30px_rgba(0,0,0,0.2)]"
               )} style={{ backgroundColor: themeColor }} />

               {isCurve && (
                  <div className={cn(
                     "absolute inset-y-0 w-[65%] z-10 border-[3px] border-white/40 pointer-events-none", 
                     isReverse ? "right-0" : "left-0",
                     lineClass,
                     "[.force-mobile_&]:!inset-auto [.force-mobile_&]:!bottom-0 [.force-mobile_&]:!left-0 [.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%]"
                  )} />
               )}

               {/* 3. COLUNA DE TEXTOS E BADGES */}
               <div className={cn(
                  "relative z-20 w-[55%] h-full flex flex-col justify-center py-8 pointer-events-none", 
                  isReverse ? "pr-6 md:pr-10 pl-4 items-end text-right" : "pl-6 md:pl-10 pr-4 items-start text-left",
                  "[.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%] [.force-mobile_&]:!mt-auto [.force-mobile_&]:!items-center [.force-mobile_&]:!text-center [.force-mobile_&]:!px-6 [.force-mobile_&]:!pb-8"
               )}>
                  
                  {/* Caixa Escura - Título */}
                  <div className="bg-[#0a192f] text-white p-5 md:p-8 rounded-[16px] shadow-xl relative mb-4 w-full max-w-[420px] pointer-events-auto [.force-mobile_&]:!p-4 [.force-mobile_&]:!max-w-[90%]">
                      <Editable as="h2" value={title} onChange={(v)=>onChange({title:v})} className="font-bold text-[22px] md:text-[30px] lg:text-[34px] leading-[1.15] break-words [.force-mobile_&]:!text-[24px]" />
                      <div className={cn("absolute top-5", isReverse ? "left-5" : "right-5", "[.force-mobile_&]:!hidden")}>
                         <ArrowUpRight className="size-6 md:size-8 text-white" strokeWidth={3} />
                      </div>
                  </div>

                  {/* Parágrafos */}
                  {hasSubtitle && <Editable as="p" multiline value={subtitle} onChange={(v)=>onChange({subtitle:v})} className="text-white/95 font-medium text-[13px] md:text-[16px] leading-relaxed max-w-[95%] break-words mb-2 drop-shadow-md pointer-events-auto [.force-mobile_&]:!text-[14px]" />}
                  {bodyText && <Editable as="p" multiline value={bodyText} onChange={(v)=>onChange({body:v})} className="text-white/80 font-normal text-[11px] md:text-[13px] leading-relaxed max-w-[95%] break-words mb-4 drop-shadow-md pointer-events-auto hidden md:block [.force-mobile_&]:!hidden" />}
                  
                  {/* Tópicos de Benefício */}
                  {benefits.length > 0 && (
                     <div className={cn("flex flex-wrap gap-2 mt-2 pointer-events-auto max-w-[90%]", isReverse ? "justify-end" : "justify-start", "[.force-mobile_&]:!justify-center")}>
                        {benefits.map((ben, i) => (
                           <span key={i} className="bg-white/10 border border-white/20 text-white text-[9px] md:text-[11px] uppercase tracking-wider font-bold px-3 py-1.5 rounded shadow-sm backdrop-blur-sm [.force-mobile_&]:!text-[9px]">{ben}</span>
                        ))}
                     </div>
                  )}

                  {/* Rodapé / Cupom */}
                  {footerInfo && (
                     <div className="mt-auto pt-6 pointer-events-auto hidden md:block [.force-mobile_&]:!block">
                        <Editable as="p" value={footerInfo} onChange={(v)=>onChange({footerInfo:v})} className="text-white/60 font-medium text-[9px] md:text-[11px] uppercase tracking-widest break-words" />
                     </div>
                  )}
               </div>

               {/* 4. BADGES FLUTUANTES (Deslocam para o meio no mobile) */}
               {(badgePrimary || badgeSecondary) && (
                  <div className={cn(
                     "absolute z-30 flex flex-col items-center gap-1 pointer-events-auto top-1/2 -translate-y-1/2",
                     isReverse ? "right-[55%] translate-x-1/2" : "left-[55%] -translate-x-1/2",
                     "[.force-mobile_&]:!right-auto [.force-mobile_&]:!left-1/2 [.force-mobile_&]:!-translate-x-1/2 [.force-mobile_&]:!top-[45%]"
                  )}>
                     {badgePrimary && (
                        <div className="bg-[#0a192f] text-white rounded-full size-[90px] md:size-[120px] flex items-center justify-center text-center p-2 shadow-2xl border-[4px] border-white [.force-mobile_&]:!size-[100px]">
                           <Editable as="span" value={badgePrimary} onChange={(v)=>onChange({badgePrimary:v})} className="font-black text-[22px] md:text-[28px] leading-[1.1] [.force-mobile_&]:!text-[24px]" />
                        </div>
                     )}
                     {badgeSecondary && (
                        <div className="bg-white rounded-full size-[60px] md:size-[80px] flex items-center justify-center text-center p-2 shadow-xl border-4 border-slate-100 -mt-3 md:-mt-5 relative z-10 [.force-mobile_&]:!size-[70px] [.force-mobile_&]:!-mt-4">
                           <Editable as="span" value={badgeSecondary} onChange={(v)=>onChange({badgeSecondary:v})} className="font-bold text-[9px] md:text-[12px] leading-tight [.force-mobile_&]:!text-[10px]" style={{ color: themeColor }} />
                        </div>
                     )}
                  </div>
               )}
            </div>
         )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3 opacity-80 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100 mt-3">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Peça: <span style={{ color: themeColor }} className="mr-3">BANNER</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileRef}
            onChange={handleFileChange}
          />
          <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs font-bold" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Foto
          </Button>
          <Button size="sm" variant="ghost" className="h-8 shrink-0 text-xs font-bold" onClick={handleRegenerate}>
            <RefreshCw className="mr-1.5 size-3.5" /> IA
          </Button>
        </div>
      </div>
    </div>
  );
}