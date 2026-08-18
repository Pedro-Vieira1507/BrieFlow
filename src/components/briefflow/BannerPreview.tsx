// src/components/briefflow/BannerPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Upload, ImagePlus, RefreshCw, Loader2, ArrowUpRight, Trash2, Sparkles, Palette, LayoutTemplate, Type, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  // Configurações de Design
  const themeColor = state.themeColor || "#6366f1";
  const textColor = state.textColor || "#ffffff";
  const boxColor = state.boxColor || "#06060a";
  const fontClass = state.fontFamily === "serif" ? "font-serif" : state.fontFamily === "mono" ? "font-mono" : "font-sans";

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

  // Logica dos Shapes Avançados
  const isCurve = backgroundShape === "curve";
  const isDiagonal = backgroundShape === "diagonal";
  const isBlob = backgroundShape === "blob";
  const isGeometric = backgroundShape === "geometric";
  const isFrame = backgroundShape === "frame";
  const isArch = backgroundShape === "arch";
  const isWave = backgroundShape === "wave";
  const isPill = backgroundShape === "pill";
  const isOffset = backgroundShape === "offset";
  
  const isReverse = layoutStyle === "reverse";
  const isCentered = layoutStyle === "centered" || layoutStyle === "minimalist";

  // Agrupa layouts complexos onde a imagem tem uma forma específica contida e o fundo é liso ou com grid
  const isComplexShape = isFrame || isBlob || isGeometric || isArch || isPill || isOffset;

  // Classes de Clip-Path para as formas base (quando não é um dos shapes complexos que usam border-radius direto)
  let shapeClass = "";
  if (isCurve) {
     shapeClass = isReverse
       ? "[clip-path:ellipse(80%_150%_at_100%_50%)] [.force-mobile_&]:![clip-path:ellipse(150%_100%_at_50%_100%)]"
       : "[clip-path:ellipse(80%_150%_at_0%_50%)] [.force-mobile_&]:![clip-path:ellipse(150%_100%_at_50%_100%)]";
  } else if (isDiagonal) {
      shapeClass = isReverse
        ? "[clip-path:polygon(20%_0,100%_0,100%_100%,0%_100%)] [.force-mobile_&]:![clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]"
        : "[clip-path:polygon(0_0,100%_0,80%_100%,0%_100%)] [.force-mobile_&]:![clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]";
  } else if (isWave) {
      shapeClass = isReverse
        ? "[clip-path:polygon(100%_0,0_0,0_100%,40%_85%,100%_100%)]"
        : "[clip-path:polygon(0_0,100%_0,100%_100%,60%_85%,0_100%)]";
  }

  const lineClass = isCurve
    ? isReverse
      ? "[clip-path:ellipse(83%_155%_at_100%_50%)] [.force-mobile_&]:![clip-path:ellipse(155%_103%_at_50%_100%)]"
      : "[clip-path:ellipse(83%_155%_at_0%_50%)] [.force-mobile_&]:![clip-path:ellipse(155%_103%_at_50%_100%)]"
    : "";

  // Grid SVG dinâmico para o fundo Geométrico
  const gridBackground = isGeometric ? {
    backgroundImage: `radial-gradient(${textColor}20 2px, transparent 2px)`,
    backgroundSize: '24px 24px'
  } : {};

  return (
    <div className="mx-auto flex w-full flex-col space-y-4" data-testid="banner-preview">
      <div
          id="banner-export-node"
          className={cn(
            "relative w-full overflow-hidden shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] flex rounded-2xl transition-colors duration-500",
            exportWrapperClass || "aspect-[2/1] min-h-[380px]",
            isCentered ? "flex-col" : "[.force-mobile_&]:!flex-col",
            fontClass
         )}
         style={{ ...exportWrapperStyle, backgroundColor: boxColor, borderColor: `${textColor}20`, borderWidth: '1px', ...gridBackground }}
      >
         {isCentered ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-8 md:p-12 text-center [.force-mobile_&]:!p-6 z-10">
               
               {/* Container da Imagem Centralizada */}
               <div className={cn(
                  "absolute inset-0 z-0 group/hero-img transition-all duration-500",
                  isFrame ? "m-8 rounded-t-full rounded-b-3xl border-8 shadow-2xl overflow-hidden" : "",
                  isBlob ? "m-6 rounded-[30%_70%_70%_30%/30%_30%_70%_70%] overflow-hidden shadow-xl" : "",
                  isArch ? "m-6 rounded-t-[1000px] rounded-b-2xl border-[10px] shadow-2xl overflow-hidden" : "",
                  isPill ? "m-8 rounded-full border-4 shadow-xl overflow-hidden" : "",
                  isOffset ? "m-12 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden scale-95" : ""
               )} style={{ backgroundColor: isComplexShape ? themeColor : boxColor, borderColor: isComplexShape ? boxColor : 'transparent' }}>
                  
                  {!hasImportedImage && heroUrl && <img src={heroUrl} crossOrigin="anonymous" className={cn("w-full h-full object-cover mix-blend-luminosity", isComplexShape ? "opacity-90" : "opacity-40")} />}
                  
                  {hasImportedImage && (
                    <div className="w-full h-full flex items-center justify-center relative bg-black/80">
                      <img 
                        src={state.productImageUrl!} 
                        className={cn("w-full h-full", isComplexShape ? "object-cover" : "object-contain")} 
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
               
               {!hasImportedImage && !isComplexShape && <div className="absolute inset-0 z-10 opacity-80 mix-blend-multiply pointer-events-none transition-colors duration-500" style={{ backgroundColor: themeColor }} />}
               
               <div className="relative z-20 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                  {/* Caixa de Título (Se for complexo, deixamos o fundo da caixa mais forte pra ler melhor) */}
                  <div 
                    className={cn(
                      "backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-2xl shadow-2xl relative mb-5 w-full max-w-2xl pointer-events-auto [.force-mobile_&]:!p-5 [.force-mobile_&]:!max-w-[90%]",
                      isComplexShape && "shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                    )}
                    style={{ backgroundColor: `${boxColor}${isComplexShape ? 'E6' : '99'}`, color: textColor }}
                  >
                      <Editable as="h2" value={title} onChange={(v)=>onChange({title:v})} className="font-extrabold text-[24px] md:text-[38px] leading-[1.15] tracking-tight break-words [.force-mobile_&]:!text-[24px]" style={{ color: textColor }} />
                  </div>
                  
                  {hasSubtitle && <Editable as="p" multiline value={subtitle} onChange={(v)=>onChange({subtitle:v})} className={cn("font-medium opacity-95 text-[14px] md:text-[18px] leading-relaxed max-w-[90%] break-words mb-3 pointer-events-auto [.force-mobile_&]:!text-[14px]", !isComplexShape && "drop-shadow-md")} style={{ color: textColor }} />}
                  {bodyText && <Editable as="p" multiline value={bodyText} onChange={(v)=>onChange({body:v})} className={cn("font-normal opacity-70 text-[12px] md:text-[14px] leading-relaxed max-w-[90%] break-words mb-5 pointer-events-auto hidden md:block [.force-mobile_&]:!hidden", !isComplexShape && "drop-shadow-md")} style={{ color: textColor }} />}
                  
                  {benefits.length > 0 && (
                     <div className="flex flex-wrap justify-center gap-2 mt-2 pointer-events-auto">
                        {benefits.map((ben, i) => (
                           <span key={i} className="border text-[10px] md:text-[11px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-md shadow-sm backdrop-blur-md [.force-mobile_&]:!text-[9px]" style={{ color: textColor, borderColor: `${textColor}33`, backgroundColor: `${boxColor}80` }}>{ben}</span>
                        ))}
                     </div>
                  )}
                  {footerInfo && (
                     <div className="mt-auto pt-6 pointer-events-auto">
                        <Editable as="p" value={footerInfo} onChange={(v)=>onChange({footerInfo:v})} className="font-medium opacity-50 text-[10px] md:text-[12px] uppercase tracking-widest break-words [.force-mobile_&]:!text-[9px]" style={{ color: textColor }} />
                     </div>
                  )}
                  {(badgePrimary || badgeSecondary) && (
                     <div className="absolute z-30 bottom-6 right-6 flex flex-col items-end gap-2 pointer-events-auto [.force-mobile_&]:!bottom-4 [.force-mobile_&]:!right-4">
                        {badgePrimary && (
                           <div className="backdrop-blur-md rounded-full size-[90px] md:size-[130px] flex items-center justify-center text-center p-3 shadow-2xl border-[4px] [.force-mobile_&]:!size-[80px]" style={{ backgroundColor: `${boxColor}E6`, color: textColor, borderColor: `${textColor}33` }}>
                              <Editable as="span" value={badgePrimary} onChange={(v)=>onChange({badgePrimary:v})} className="font-black text-2xl md:text-3xl leading-[1.1] [.force-mobile_&]:!text-xl" style={{ color: textColor }} />
                           </div>
                        )}
                        {badgeSecondary && (
                           <div className="backdrop-blur-sm rounded-full px-4 py-2 text-center shadow-xl border relative z-10" style={{ backgroundColor: textColor, color: themeColor, borderColor: textColor }}>
                              <Editable as="span" value={badgeSecondary} onChange={(v)=>onChange({badgeSecondary:v})} className="font-bold text-[11px] md:text-xs leading-tight" style={{ color: themeColor }} />
                           </div>
                        )}
                     </div>
                  )}
               </div>
            </div>
         ) : (
            <div className={cn("relative w-full h-full flex overflow-hidden z-10", isReverse ? "flex-row-reverse" : "flex-row", "[.force-mobile_&]:!flex-col")} style={{ backgroundColor: isGeometric ? 'transparent' : themeColor }}>
               
               {/* 1. IMAGEM (Coluna Lateral) */}
               <div className={cn(
                  "absolute inset-y-0 z-0 flex items-center justify-center w-[55%] group/hero-img transition-all duration-500", 
                  isReverse ? "left-0" : "right-0",
                  isFrame ? "m-6 rounded-t-full rounded-b-xl border-8 shadow-xl overflow-hidden bg-white/10" : 
                  isBlob ? "m-4 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] overflow-hidden shadow-2xl bg-white/10" : 
                  isGeometric ? "m-6 rounded-none border-l-8 border-b-8 shadow-[12px_12px_0px_rgba(0,0,0,0.2)] overflow-hidden" : 
                  isArch ? "m-6 rounded-t-[1000px] rounded-b-2xl border-[12px] shadow-2xl overflow-hidden bg-white/10" :
                  isPill ? "m-6 rounded-full border-8 shadow-xl overflow-hidden bg-white/10" :
                  isOffset ? "m-0 lg:m-6 rounded-none shadow-[20px_20px_60px_rgba(0,0,0,0.4)] overflow-hidden scale-95" :
                  "overflow-hidden",
                  "[.force-mobile_&]:!inset-auto [.force-mobile_&]:!top-0 [.force-mobile_&]:!left-0 [.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%]",
                  isComplexShape && "[.force-mobile_&]:!m-4 [.force-mobile_&]:!w-[calc(100%-32px)] [.force-mobile_&]:!h-[50%]"
               )} style={{ backgroundColor: isComplexShape ? themeColor : boxColor, borderColor: (isFrame || isArch || isPill) ? boxColor : isGeometric ? themeColor : 'transparent' }}>
                  
                  {!hasImportedImage && heroUrl && !draggableImages.length && (
                     <img src={heroUrl} crossOrigin="anonymous" className={cn("w-full h-full object-cover transition-opacity duration-1000 ease-out", imageStatus === "loading" ? "opacity-0 scale-105" : "opacity-100 scale-100", isComplexShape ? "" : "opacity-90")} onLoad={() => setImageStatus("loaded")} onError={handleImageError} />
                  )}
                  
                  {hasImportedImage && (
                    <div className="w-full h-full flex items-center justify-center relative bg-black/10">
                      <img 
                        src={state.productImageUrl!} 
                        className={cn("w-full h-full object-center", isComplexShape ? "object-cover" : "object-contain")} 
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
                     <div className={cn("relative z-10 flex h-full items-center justify-center w-full", isReverse ? "justify-start pl-[5%]" : "justify-end pr-[5%]", isComplexShape ? "justify-center px-0" : "", "[.force-mobile_&]:!justify-center [.force-mobile_&]:!px-0")}>
                        <div className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-dashed backdrop-blur-sm cursor-pointer transition-colors" style={{ borderColor: `${textColor}40`, backgroundColor: `${textColor}0A` }} onClick={() => fileRef.current?.click()}>
                           <ImagePlus className="size-8" style={{ color: textColor, opacity: 0.6 }} />
                           <p className="text-sm font-bold" style={{ color: textColor, opacity: 0.8 }}>Adicionar Imagem</p>
                        </div>
                     </div>
                  )}
               </div>

               {/* 2. GEOMETRIAS DO FUNDO COLORIDO (Só renderiza se não for shape complexo) */}
               {!isComplexShape && (
                 <>
                   <div className={cn(
                      "absolute inset-y-0 w-[65%] z-10 shadow-[10px_0_40px_rgba(0,0,0,0.4)] pointer-events-none transition-colors duration-500 backdrop-blur-xl", 
                      isReverse ? "right-0" : "left-0",
                      shapeClass,
                      "[.force-mobile_&]:!inset-auto [.force-mobile_&]:!bottom-0 [.force-mobile_&]:!left-0 [.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%] [.force-mobile_&]:!shadow-[0_-10px_30px_rgba(0,0,0,0.2)]"
                   )} style={{ backgroundColor: themeColor }} />

                   {isCurve && (
                      <div className={cn(
                         "absolute inset-y-0 w-[65%] z-10 border-[4px] pointer-events-none", 
                         isReverse ? "right-0" : "left-0",
                         lineClass,
                         "[.force-mobile_&]:!inset-auto [.force-mobile_&]:!bottom-0 [.force-mobile_&]:!left-0 [.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%]"
                      )} style={{ borderColor: `${textColor}33` }} />
                   )}
                 </>
               )}

               {/* Detalhe estético extra se for Geometric */}
               {isGeometric && (
                 <div className={cn("absolute w-12 h-24 z-0 top-10", isReverse ? "right-10" : "left-10")} style={{ backgroundColor: themeColor }} />
               )}

               {/* 3. COLUNA DE TEXTOS E BADGES */}
               <div className={cn(
                  "relative z-20 w-[55%] h-full flex flex-col justify-center py-8 pointer-events-none", 
                  isReverse ? "pr-6 md:pr-10 pl-4 items-end text-right" : "pl-6 md:pl-10 pr-4 items-start text-left",
                  isComplexShape ? (isReverse ? "pr-8 md:pr-14" : "pl-8 md:pl-14") : "",
                  // Se for offset, aplicamos uma margem negativa monstruosa para invadir a imagem
                  isOffset ? (isReverse ? "-mr-16 z-40" : "-ml-16 z-40") : "",
                  "[.force-mobile_&]:!w-full [.force-mobile_&]:!h-[55%] [.force-mobile_&]:!mt-auto [.force-mobile_&]:!items-center [.force-mobile_&]:!text-center [.force-mobile_&]:!px-6 [.force-mobile_&]:!pb-8 [.force-mobile_&]:!m-0"
               )}>
                  
                  {/* Caixa Escura - Título */}
                  <div 
                    className={cn(
                      "backdrop-blur-2xl p-5 md:p-8 rounded-2xl relative mb-4 w-full max-w-[420px] pointer-events-auto [.force-mobile_&]:!p-4 [.force-mobile_&]:!max-w-[90%]",
                      isComplexShape ? "bg-transparent border-0 shadow-none p-0 md:p-0" : "border shadow-xl",
                      isOffset && "!bg-white !p-8 !shadow-2xl border-l-8 border-b-8" // Estilo Offset Brutal
                    )}
                    style={
                      isOffset 
                        ? { backgroundColor: boxColor, borderColor: themeColor, color: textColor } 
                        : { backgroundColor: isComplexShape ? 'transparent' : boxColor, borderColor: `${textColor}1A` }
                    }
                  >
                      <Editable as="h2" value={title} onChange={(v)=>onChange({title:v})} className={cn("font-extrabold text-[22px] md:text-[32px] lg:text-[36px] leading-[1.15] tracking-tight break-words [.force-mobile_&]:!text-[24px]", !isOffset && "drop-shadow-md")} style={{ color: textColor }} />
                      
                      {!isComplexShape && (
                        <div className={cn("absolute top-5", isReverse ? "left-5" : "right-5", "[.force-mobile_&]:!hidden")}>
                           <ArrowUpRight className="size-6 md:size-8" style={{ color: textColor, opacity: 0.3 }} strokeWidth={2.5} />
                        </div>
                      )}
                  </div>

                  {/* Parágrafos */}
                  {hasSubtitle && <Editable as="p" multiline value={subtitle} onChange={(v)=>onChange({subtitle:v})} className={cn("font-semibold opacity-95 text-[13px] md:text-[16px] leading-relaxed max-w-[95%] break-words mb-2 pointer-events-auto [.force-mobile_&]:!text-[14px]", (!isComplexShape || isOffset) && "drop-shadow-md")} style={{ color: textColor }} />}
                  {bodyText && <Editable as="p" multiline value={bodyText} onChange={(v)=>onChange({body:v})} className={cn("font-normal opacity-80 text-[11px] md:text-[13px] leading-relaxed max-w-[95%] break-words mb-4 pointer-events-auto hidden md:block [.force-mobile_&]:!hidden", (!isComplexShape || isOffset) && "drop-shadow-md")} style={{ color: textColor }} />}
                  
                  {/* Tópicos de Benefício */}
                  {benefits.length > 0 && (
                     <div className={cn("flex flex-wrap gap-2 mt-2 pointer-events-auto max-w-[90%]", isReverse ? "justify-end" : "justify-start", "[.force-mobile_&]:!justify-center")}>
                        {benefits.map((ben, i) => (
                           <span key={i} className="border text-[9px] md:text-[11px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-md shadow-sm backdrop-blur-md [.force-mobile_&]:!text-[9px]" style={{ color: isComplexShape ? boxColor : textColor, borderColor: isComplexShape ? 'transparent' : `${textColor}33`, backgroundColor: isComplexShape ? themeColor : `${boxColor}33` }}>{ben}</span>
                        ))}
                     </div>
                  )}

                  {/* Rodapé / Cupom */}
                  {footerInfo && (
                     <div className="mt-auto pt-6 pointer-events-auto hidden md:block [.force-mobile_&]:!block">
                        <Editable as="p" value={footerInfo} onChange={(v)=>onChange({footerInfo:v})} className="font-medium opacity-50 text-[9px] md:text-[11px] uppercase tracking-widest break-words" style={{ color: textColor }} />
                     </div>
                  )}
               </div>

               {/* 4. BADGES FLUTUANTES */}
               {(badgePrimary || badgeSecondary) && (
                  <div className={cn(
                     "absolute z-40 flex flex-col items-center gap-1 pointer-events-auto top-1/2 -translate-y-1/2",
                     isReverse ? "right-[55%] translate-x-1/2" : "left-[55%] -translate-x-1/2",
                     "[.force-mobile_&]:!right-auto [.force-mobile_&]:!left-1/2 [.force-mobile_&]:!-translate-x-1/2 [.force-mobile_&]:!top-[45%]"
                  )}>
                     {badgePrimary && (
                        <div className="backdrop-blur-md rounded-full size-[90px] md:size-[130px] flex items-center justify-center text-center p-3 shadow-2xl border-[4px] [.force-mobile_&]:!size-[80px] hover:scale-105 transition-transform" style={{ backgroundColor: `${boxColor}E6`, color: textColor, borderColor: `${textColor}33` }}>
                           <Editable as="span" value={badgePrimary} onChange={(v)=>onChange({badgePrimary:v})} className="font-black text-[22px] md:text-[30px] leading-[1.1] tracking-tight [.force-mobile_&]:!text-[24px]" style={{ color: textColor }} />
                        </div>
                     )}
                     {badgeSecondary && (
                        <div className="backdrop-blur-sm rounded-full px-4 py-2 text-center shadow-xl border relative z-10" style={{ backgroundColor: textColor, borderColor: textColor }}>
                           <Editable as="span" value={badgeSecondary} onChange={(v)=>onChange({badgeSecondary:v})} className="font-bold text-[11px] md:text-xs leading-tight" style={{ color: themeColor }} />
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
          
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3">
                <Palette className="mr-1.5 size-3.5" /> Design
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-[340px] bg-surface-1 border-border-strong p-4 shadow-2xl rounded-xl z-50 mb-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <LayoutTemplate className="mr-1.5 size-3" /> Estrutura
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant={layoutStyle === 'split' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'split' })} className="h-7 text-[11px]">Esquerda</Button>
                    <Button size="sm" variant={layoutStyle === 'reverse' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'reverse' })} className="h-7 text-[11px]">Direita</Button>
                    <Button size="sm" variant={layoutStyle === 'centered' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'centered' })} className="h-7 text-[11px]">Centro</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <Layers className="mr-1.5 size-3" /> Forma Visual
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant={backgroundShape === 'minimalist' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'minimalist' })} className="h-7 text-[11px]">Clean</Button>
                    <Button size="sm" variant={backgroundShape === 'split' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'split' })} className="h-7 text-[11px]">Reto</Button>
                    <Button size="sm" variant={backgroundShape === 'curve' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'curve' })} className="h-7 text-[11px]">Curva</Button>
                    <Button size="sm" variant={backgroundShape === 'diagonal' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'diagonal' })} className="h-7 text-[11px]">Diagonal</Button>
                    <Button size="sm" variant={backgroundShape === 'wave' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'wave' })} className="h-7 text-[11px]">Onda</Button>
                    <Button size="sm" variant={backgroundShape === 'arch' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'arch', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Arco</Button>
                    <Button size="sm" variant={backgroundShape === 'pill' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'pill', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Pílula</Button>
                    <Button size="sm" variant={backgroundShape === 'blob' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'blob', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Orgânico</Button>
                    <Button size="sm" variant={backgroundShape === 'grid' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'geometric', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Grid</Button>
                    <Button size="sm" variant={backgroundShape === 'frame' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'frame', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Moldura</Button>
                    <Button size="sm" variant={backgroundShape === 'offset' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'offset', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Editorial</Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <Palette className="mr-1.5 size-3" /> Cores
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Fundo Principal</label>
                      <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                        <input type="color" value={themeColor} onChange={(e) => onChange({ themeColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <span className="text-[10px] uppercase text-fg-primary">{themeColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Destaque</label>
                      <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                        <input type="color" value={boxColor} onChange={(e) => onChange({ boxColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <span className="text-[10px] uppercase text-fg-primary">{boxColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] text-fg-secondary">Cor do Texto</label>
                      <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                        <input type="color" value={textColor} onChange={(e) => onChange({ textColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <span className="text-[10px] uppercase text-fg-primary">{textColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <Type className="mr-1.5 size-3" /> Tipografia
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant={(!state.fontFamily || state.fontFamily === 'sans') ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'sans' })} className="h-7 text-[11px] font-sans">Sans</Button>
                    <Button size="sm" variant={state.fontFamily === 'serif' ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'serif' })} className="h-7 text-[11px] font-serif">Serif</Button>
                    <Button size="sm" variant={state.fontFamily === 'mono' ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'mono' })} className="h-7 text-[11px] font-mono">Mono</Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

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