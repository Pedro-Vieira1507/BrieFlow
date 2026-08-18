// src/components/briefflow/BannerPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Upload, ImagePlus, RefreshCw, Loader2, ArrowUpRight, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanText, isEmptyLike } from "@/lib/sanitize";
import { analyzeImageWithVisionFn } from "@/lib/vision-api";
import { toast } from "sonner";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  exportWrapperClass?: string;
  exportWrapperStyle?: React.CSSProperties;
}

export function BannerPreview({ state, onChange, exportWrapperClass, exportWrapperStyle }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const [analyzingColors, setAnalyzingColors] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const themeColor = state.themeColor || "#6366f1";
  const title = cleanText(state.title, "Equipamentos que impulsionam a performance");
  const subtitle = cleanText(state.subtitle);
  const bodyText = cleanText(state.body);
  const footerInfo = cleanText(state.footerInfo);
  const benefits = state.keyBenefits || [];
  const prompt = cleanText(state.imagePrompt || "");
  
  const hasImportedImage = !!state.productImageUrl;
  const isProductImage = hasImportedImage;
  const badgePrimary = cleanText(state.badgePrimary);
  const badgeSecondary = cleanText(state.badgeSecondary);
  const backgroundShape = state.backgroundShape || "curve";
  const layoutStyle = state.layoutStyle || "split";
  const hasSubtitle = !isEmptyLike(subtitle);

  const draggableImages = Array.from(new Set(state.productImages || []));

  const heroUrl = useMemo(() => {
    if (!prompt) return null;
    return useFallback
      ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed })
      : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed });
  }, [prompt, state.imageSeed, useFallback]);

  const activeHeroUrl = hasImportedImage ? state.productImageUrl : heroUrl;

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      
      onChange({ productImageUrl: base64 });

      setAnalyzingColors(true);
      const toastId = toast.loading("Extraindo paleta de cores...");

      try {
        const visionResult = await analyzeImageWithVisionFn({ data: { imageBase64: base64 } });
        
        if (visionResult.primaryBrandColor) {
          onChange({
            productImageUrl: base64,
            themeColor: visionResult.primaryBrandColor,
            secondaryColor: visionResult.secondaryBrandColor || "#1e1b4b"
          });
          toast.success("Paleta harmonizada com a foto!", { id: toastId });
        } else {
          toast.dismiss(toastId);
        }
      } catch (err) {
        console.error("Falha ao analisar cor:", err);
        toast.dismiss(toastId);
      } finally {
        setAnalyzingColors(false);
      }
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
    <div className="mx-auto flex w-full flex-col space-y-4" data-testid="banner-preview">
      <div
          id="banner-export-node"
          className={cn(
            "relative w-full overflow-hidden shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] border border-white/10 bg-slate-950 flex rounded-2xl transition-colors duration-500",
            exportWrapperClass || "aspect-[2/1] min-h-[380px]",
            isCentered ? "flex-col" : "[.force-mobile_&]:!flex-col"
         )}
         style={exportWrapperStyle}
      >
         {isCentered ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-8 md:p-12 text-center [.force-mobile_&]:!p-6">
               <div className="absolute inset-0 z-0 bg-[#06060a] group/hero-img">
                  {!hasImportedImage && heroUrl && <img src={heroUrl} crossOrigin="anonymous" className="w-full h-full object-cover opacity-40 mix-blend-luminosity" />}
                  {hasImportedImage && (
                    <div className="w-full h-full flex items-center justify-center relative bg-black/80">
                      <img 
                        src={state.productImageUrl!} 
                        className="w-full h-full object-contain" 
                        style={{ imageRendering: "high-quality" }}
                      />
                      <button 
                        onClick={() => onChange({ productImageUrl: null })}
                        className="absolute top-4 left-4 z-50 p-2.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-full opacity-0 group-hover/hero-img:opacity-100 transition-all backdrop-blur-md shadow-2xl"
                        title="Remover imagem importada"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
               </div>
               
               {/* Apenas plica opacidade de cor se NÃO for imagem importada, para não estragar a cor real da foto */}
               {!hasImportedImage && <div className="absolute inset-0 z-10 opacity-80 mix-blend-multiply pointer-events-none transition-colors duration-500" style={{ backgroundColor: themeColor }} />}
               
               <div className="relative z-20 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                  <div className="bg-[#06060a]/50 backdrop-blur-xl border border-white/10 text-white p-6 md:p-8 rounded-2xl shadow-2xl relative mb-5 w-full max-w-2xl pointer-events-auto [.force-mobile_&]:!p-5 [.force-mobile_&]:!max-w-[90%]">
                      <Editable as="h2" value={title} onChange={(v)=>onChange({title:v})} className="font-extrabold text-[24px] md:text-[38px] leading-[1.15] tracking-tight break-words [.force-mobile_&]:!text-[24px]" />
                  </div>
                  
                  {hasSubtitle && <Editable as="p" multiline value={subtitle} onChange={(v)=>onChange({subtitle:v})} className="text-white/95 font-medium text-[14px] md:text-[18px] leading-relaxed max-w-[90%] break-words mb-3 drop-shadow-md pointer-events-auto [.force-mobile_&]:!text-[14px]" />}
                  {bodyText && <Editable as="p" multiline value={bodyText} onChange={(v)=>onChange({body:v})} className="text-white/70 font-normal text-[12px] md:text-[14px] leading-relaxed max-w-[90%] break-words mb-5 drop-shadow-md pointer-events-auto hidden md:block [.force-mobile_&]:!hidden" />}
                  
                  {benefits.length > 0 && (
                     <div className="flex flex-wrap justify-center gap-2 mt-2 pointer-events-auto">
                        {benefits.map((ben, i) => (
                           <span key={i} className="bg-white/10 border border-white/20 text-white text-[10px] md:text-[11px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-md shadow-sm backdrop-blur-md [.force-mobile_&]:!text-[9px]">{ben}</span>
                        ))}
                     </div>
                  )}
                  {footerInfo && (
                     <div className="mt-auto pt-6 pointer-events-auto">
                        <Editable as="p" value={footerInfo} onChange={(v)=>onChange({footerInfo:v})} className="text-white/50 font-medium text-[10px] md:text-[12px] uppercase tracking-widest break-words [.force-mobile_&]:!text-[9px]" />
                     </div>
                  )}
               </div>
            </div>
         ) : (
            <div className={cn("relative w-full h-full flex overflow-hidden bg-white/5", isReverse ? "flex-row-reverse" : "flex-row", "[.force-mobile_&]:!flex-col")}>
               
               {/* 1. IMAGEM AO FUNDO (Agora ocupa 100% da sua coluna, sendo cover) */}
               <div className={cn(
                  "absolute inset-y-0 z-0 flex items-center justify-center overflow-hidden w-[55%] group/hero-img", 
                  isReverse ? "left-0" : "right-0",
                  "[.force-mobile_&]:!inset-auto [.force-mobile_&]:!top-0 [.force-mobile_&]:!left-0 [.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%]"
               )}>
                  {!hasImportedImage && heroUrl && !draggableImages.length && (
                     <img src={heroUrl} crossOrigin="anonymous" className={cn("w-full h-full object-cover transition-opacity duration-1000 ease-out opacity-90", imageStatus === "loading" ? "opacity-0 scale-105" : "opacity-100 scale-100")} onLoad={() => setImageStatus("loaded")} onError={handleImageError} />
                  )}
                  
                  {/* UX/DESIGN: A imagem importada agora é tratada como "Pôster", preenchendo toda a lateral sem caixas esquisitas */}
                  {hasImportedImage && (
                    <div className="w-full h-full flex items-center justify-center relative bg-black/10">
                      <img 
                        src={state.productImageUrl!} 
                        className="w-full h-full object-cover object-center" 
                        style={{ imageRendering: "high-quality" }}
                      />
                      <button 
                        onClick={() => onChange({ productImageUrl: null })}
                        className="absolute top-4 right-4 z-50 p-2.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-full opacity-0 group-hover/hero-img:opacity-100 transition-all backdrop-blur-md shadow-2xl"
                        title="Remover imagem importada"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}

                  {draggableImages.length > 0 && !hasImportedImage && (
                     <div className="relative z-30 flex h-full w-full items-center justify-center">
                        {draggableImages.map((src, i) => <DraggableImage key={`${src}-${i}`} src={src} />)}
                     </div>
                  )}

                  {!activeHeroUrl && draggableImages.length === 0 && (
                     <div className={cn("relative z-10 flex h-full items-center justify-center w-full", isReverse ? "justify-start pl-[5%]" : "justify-end pr-[5%]", "[.force-mobile_&]:!justify-center [.force-mobile_&]:!px-0")}>
                        <div className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-dashed border-slate-400 bg-white/5 backdrop-blur-sm cursor-pointer hover:bg-white/10 transition-colors" onClick={() => fileRef.current?.click()}>
                           <ImagePlus className="size-8 text-slate-400" />
                           <p className="text-sm font-bold text-slate-400">Adicionar Imagem</p>
                        </div>
                     </div>
                  )}
               </div>

               {/* 2. GEOMETRIAS DO FUNDO COLORIDO */}
               <div className={cn(
                  "absolute inset-y-0 w-[65%] z-10 shadow-[10px_0_40px_rgba(0,0,0,0.4)] pointer-events-none transition-colors duration-500 backdrop-blur-xl", 
                  isReverse ? "right-0" : "left-0",
                  shapeClass,
                  "[.force-mobile_&]:!inset-auto [.force-mobile_&]:!bottom-0 [.force-mobile_&]:!left-0 [.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%] [.force-mobile_&]:!shadow-[0_-10px_30px_rgba(0,0,0,0.2)]"
               )} style={{ backgroundColor: themeColor }} />

               {isCurve && (
                  <div className={cn(
                     "absolute inset-y-0 w-[65%] z-10 border-[4px] border-white/20 pointer-events-none", 
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
                  <div className="bg-[#06060a]/50 backdrop-blur-2xl border border-white/10 text-white p-5 md:p-8 rounded-2xl shadow-xl relative mb-4 w-full max-w-[420px] pointer-events-auto [.force-mobile_&]:!p-4 [.force-mobile_&]:!max-w-[90%]">
                      <Editable as="h2" value={title} onChange={(v)=>onChange({title:v})} className="font-extrabold text-[22px] md:text-[32px] lg:text-[36px] leading-[1.15] tracking-tight break-words drop-shadow-md [.force-mobile_&]:!text-[24px]" />
                      <div className={cn("absolute top-5", isReverse ? "left-5" : "right-5", "[.force-mobile_&]:!hidden")}>
                         <ArrowUpRight className="size-6 md:size-8 text-white/40" strokeWidth={2.5} />
                      </div>
                  </div>

                  {/* Parágrafos */}
                  {hasSubtitle && <Editable as="p" multiline value={subtitle} onChange={(v)=>onChange({subtitle:v})} className="text-white/95 font-semibold text-[13px] md:text-[16px] leading-relaxed max-w-[95%] break-words mb-2 drop-shadow-md pointer-events-auto [.force-mobile_&]:!text-[14px]" />}
                  {bodyText && <Editable as="p" multiline value={bodyText} onChange={(v)=>onChange({body:v})} className="text-white/80 font-normal text-[11px] md:text-[13px] leading-relaxed max-w-[95%] break-words mb-4 drop-shadow-md pointer-events-auto hidden md:block [.force-mobile_&]:!hidden" />}
                  
                  {/* Tópicos de Benefício */}
                  {benefits.length > 0 && (
                     <div className={cn("flex flex-wrap gap-2 mt-2 pointer-events-auto max-w-[90%]", isReverse ? "justify-end" : "justify-start", "[.force-mobile_&]:!justify-center")}>
                        {benefits.map((ben, i) => (
                           <span key={i} className="bg-white/15 border border-white/20 text-white text-[9px] md:text-[11px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-md shadow-sm backdrop-blur-md [.force-mobile_&]:!text-[9px]">{ben}</span>
                        ))}
                     </div>
                  )}

                  {/* Rodapé / Cupom */}
                  {footerInfo && (
                     <div className="mt-auto pt-6 pointer-events-auto hidden md:block [.force-mobile_&]:!block">
                        <Editable as="p" value={footerInfo} onChange={(v)=>onChange({footerInfo:v})} className="text-white/50 font-medium text-[9px] md:text-[11px] uppercase tracking-widest break-words" />
                     </div>
                  )}
               </div>

               {/* 4. BADGES FLUTUANTES */}
               {(badgePrimary || badgeSecondary) && (
                  <div className={cn(
                     "absolute z-30 flex flex-col items-center gap-1 pointer-events-auto top-1/2 -translate-y-1/2",
                     isReverse ? "right-[55%] translate-x-1/2" : "left-[55%] -translate-x-1/2",
                     "[.force-mobile_&]:!right-auto [.force-mobile_&]:!left-1/2 [.force-mobile_&]:!-translate-x-1/2 [.force-mobile_&]:!top-[45%]"
                  )}>
                     {badgePrimary && (
                        <div className="bg-[#06060a]/90 backdrop-blur-md text-white rounded-full size-[90px] md:size-[130px] flex items-center justify-center text-center p-2 shadow-2xl border-[4px] border-white/20 [.force-mobile_&]:!size-[100px] hover:scale-105 transition-transform">
                           <Editable as="span" value={badgePrimary} onChange={(v)=>onChange({badgePrimary:v})} className="font-black text-[22px] md:text-[30px] leading-[1.1] tracking-tight [.force-mobile_&]:!text-[24px]" />
                        </div>
                     )}
                     {badgeSecondary && (
                        <div className="bg-white/95 backdrop-blur-sm rounded-full size-[60px] md:size-[80px] flex items-center justify-center text-center p-2 shadow-xl border-4 border-slate-100 -mt-3 md:-mt-5 relative z-10 [.force-mobile_&]:!size-[70px] [.force-mobile_&]:!-mt-4 hover:scale-105 transition-transform">
                           <Editable as="span" value={badgeSecondary} onChange={(v)=>onChange({badgeSecondary:v})} className="font-bold text-[9px] md:text-[12px] leading-tight [.force-mobile_&]:!text-[10px]" style={{ color: themeColor }} />
                        </div>
                     )}
                  </div>
               )}
            </div>
         )}
      </div>

      {/* Toolbar Inferior */}
      <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-2 p-3 shadow-md transition-opacity hover:opacity-100 mt-3">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] font-bold uppercase tracking-widest text-fg-muted flex items-center gap-2">
          Peça: <span className="px-2 py-1 rounded bg-brand/10 text-brand">BANNER</span>
          {analyzingColors && <span className="text-xs text-brand animate-pulse flex items-center gap-1"><Sparkles className="size-3" /> Extraindo Cores...</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileRef}
            onChange={handleFileChange}
          />
          <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Foto
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs font-bold rounded-lg bg-surface-3 hover:bg-surface-2 text-fg-primary" onClick={handleRegenerate}>
            <RefreshCw className="mr-1.5 size-3.5" /> IA
          </Button>
        </div>
      </div>
    </div>
  );
}