// src/components/briefflow/EmailPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, RefreshCw, Trash2, ImagePlus, Sparkles, Palette, LayoutTemplate, Type, Layers, Move } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { cleanText, isEmptyLike } from "@/lib/sanitize";
import { analyzeImageWithVisionFn } from "@/lib/vision-api";
import { toast } from "sonner";
import { uploadCampaignAsset } from "@/lib/supabase";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  exportWrapperClass?: string;
  exportWrapperStyle?: React.CSSProperties;
}

const blockCache = new Map<string, { x: number; y: number }>();

function DraggableBlock({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const cached = useMemo(() => blockCache.get(id) || { x: 0, y: 0 }, [id]);
  const [pos, setPos] = useState(cached);
  const [isDragging, setIsDragging] = useState(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
      const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
      
      const parent = containerRef.current?.closest('#banner-export-node, #email-export-node');
      const pWidth = parent ? parent.clientWidth : window.innerWidth;
      const pHeight = parent ? parent.clientHeight : window.innerHeight;

      const deltaX = ((clientX - startMousePos.current.x) / pWidth) * 100;
      const deltaY = ((clientY - startMousePos.current.y) / pHeight) * 100;

      setPos({
        x: startPos.current.x + deltaX,
        y: startPos.current.y + deltaY,
      });
    };

    const handleUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("touchend", handleUp);
    }
    
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleUp);
    };
  }, [isDragging]);

  useEffect(() => {
    blockCache.set(id, pos);
  }, [pos, id]);

  const onPointerDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (["p", "h1", "h2", "h3", "span"].includes(target.tagName.toLowerCase())) return;
    
    setIsDragging(true);
    let clientX = 0, clientY = 0;
    if ("clientX" in e) { clientX = e.clientX; clientY = e.clientY; } 
    else if ("touches" in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    
    startMousePos.current = { x: clientX, y: clientY };
    startPos.current = { ...pos };
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative transition-all duration-300 cursor-move group/drag", isDragging ? "z-50 shadow-2xl scale-[1.02]" : "hover:scale-[1.01]", className)}
      style={{ position: 'relative', left: `${pos.x}%`, top: `${pos.y}%` }}
      onPointerDown={onPointerDown}
    >
      <div className="absolute -top-3 -right-3 opacity-0 group-hover/drag:opacity-100 transition-opacity bg-black/50 text-white p-2 rounded-full z-10 pointer-events-none shadow-lg">
        <Move className="size-3" />
      </div>
      {children}
    </div>
  );
}

export function EmailPreview({ state: propState, onChange, exportWrapperClass, exportWrapperStyle }: Props) {
  const { builder } = useBriefflowStore();
  const isExportClone = !!exportWrapperClass;

  // CORREÇÃO: A fonte da verdade agora é SEMPRE o propState atualizado enviado pelo pai (PageBuilder)
  const state = propState;

  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const [analyzingColors, setAnalyzingColors] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const layoutStyle = state.layoutStyle || "centered";
  const backgroundShape = state.backgroundShape || "square";

  const themeColor = state.themeColor || "#2563eb";
  const textColor = state.textColor || "#0f172a";
  const boxColor = state.boxColor || "#ffffff";
  const fontClass = state.fontFamily === "serif" ? "font-serif" : state.fontFamily === "mono" ? "font-mono" : "font-sans";
  const baseFontFamily = state.fontFamily === 'serif' 
    ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' 
    : state.fontFamily === 'mono' 
      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' 
      : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  const brandName = cleanText(state.brandName, "SUA MARCA");
  const heroBadge = cleanText(state.heroBadge, "");
  const title = cleanText(state.subtitle || state.title, "Headline de Alta Conversão");
  const cta = cleanText(state.cta, "Acessar Agora");
  const footerInfo = cleanText(state.footerInfo, "");
  const paragraphs = useMemo(() => 
      cleanText(state.body ?? "").split(/\n+/).map((paragraph) => cleanText(paragraph)).filter(Boolean),
  [state.body]);

  const testimonials = state.testimonials || [];
  const prompt = cleanText(state.emailHeroImagePrompt);
  const offerRaw = builder.discoveryPlan?.offer;
  const hasOffer = !isEmptyLike(offerRaw);

  const draggableImages = Array.from(new Set(state.productImages || [])).filter(
    (src): src is string => typeof src === "string" && src.trim().length > 0,
  );

  const heroUrl = useMemo(() => {
    if (!prompt) return null;
    return useFallback
      ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed })
      : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed });
  }, [prompt, state.imageSeed, useFallback]);

  const activeBgUrl = state.productImageUrl || heroUrl;
  
  // CORREÇÃO: Inicialização Síncrona do Fundo
  const [safeBgUrl, setSafeBgUrl] = useState<string | null>(() => {
    return activeBgUrl?.startsWith("blob:") ? null : (activeBgUrl || null);
  });

  useEffect(() => {
    let isMounted = true;
    if (activeBgUrl?.startsWith("blob:")) {
      fetch(activeBgUrl)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (isMounted) setSafeBgUrl(reader.result as string);
          };
          reader.readAsDataURL(blob);
        }).catch(() => {
          if (isMounted) setSafeBgUrl(activeBgUrl);
        });
    } else {
      if (isMounted) setSafeBgUrl(activeBgUrl || null);
    }
    return () => { isMounted = false; };
  }, [activeBgUrl]);

  const isLocalBg = safeBgUrl?.startsWith("data:") || safeBgUrl?.startsWith("blob:");

  useEffect(() => {
    if (!heroUrl) return;
    setImageStatus("loading");
    const timer = setTimeout(() => {
      setImageStatus((prev) => (prev === "loading" ? (useFallback || state.productImageUrl ? "error" : setUseFallback(true), "loading") : prev));
    }, 5000);
    return () => clearTimeout(timer);
  }, [heroUrl, useFallback, state.productImageUrl]);

  const handleImageError = () => {
    if (!useFallback && !state.productImageUrl) setUseFallback(true);
    else setImageStatus("error");
  };

  const handleProductChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const toastId = toast.loading(`Fazendo upload de ${files.length} produto(s)...`);
    const newImages: string[] = [];

    try {
      for (const file of files) {
        const publicUrl = await uploadCampaignAsset(file, 'products');
        newImages.push(publicUrl);
      }
      onChange({ productImages: [...(state.productImages || []), ...newImages] });
      toast.success("Upload de produtos concluído!", { id: toastId });
    } catch (err) {
      console.error("Falha no upload múltiplo:", err);
      toast.error("Erro no upload de um ou mais produtos.", { id: toastId });
    }
    
    e.target.value = "";
  };

  const handleBackgroundChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading("Enviando fundo para a nuvem...");

    try {
      const publicUrl = await uploadCampaignAsset(file, 'backgrounds');
      onChange({ productImageUrl: publicUrl });

      setAnalyzingColors(true);
      toast.loading("Extraindo paleta de cores...", { id: toastId });

      const visionResult = await analyzeImageWithVisionFn({ data: { imageUrl: publicUrl } });
      
      if (visionResult.primaryBrandColor) {
        onChange({
          productImageUrl: publicUrl,
          themeColor: visionResult.primaryBrandColor,
          secondaryColor: visionResult.secondaryBrandColor || "#0f172a"
        });
        toast.success("Paleta harmonizada com o e-mail!", { id: toastId });
      } else {
        toast.success("Fundo aplicado com sucesso!", { id: toastId });
      }
    } catch (err) {
      console.error("Erro Vision API / Upload:", err);
      toast.error("Erro ao processar fundo do e-mail", { id: toastId });
    } finally {
      setAnalyzingColors(false);
    }
    
    e.target.value = "";
  };

  const handleRegenerate = () => {
    setImageStatus("loading");
    setUseFallback(false);
    onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
  };

  const renderImageWindow = (classes: string, extraStyles?: React.CSSProperties) => {
    return (
      <div 
         className={cn("relative w-full flex flex-col items-center justify-center transition-colors pointer-events-auto overflow-hidden", classes, safeBgUrl ? "border-transparent" : "border-2 border-dashed cursor-pointer")}
         style={{ ...extraStyles, borderColor: safeBgUrl ? 'transparent' : (extraStyles?.borderColor || `${themeColor}40`), backgroundColor: safeBgUrl ? 'transparent' : `${themeColor}10` }}
        onClick={() => !safeBgUrl && bgRef.current?.click()}
      >
        {safeBgUrl ? (
           <img 
               src={safeBgUrl} 
               crossOrigin={isLocalBg ? undefined : "anonymous"}
              className={cn("w-full h-full object-cover transition-opacity duration-1000", (!state.productImageUrl && imageStatus === "loading") ? "opacity-0 scale-105" : "opacity-100 scale-100")}
              onLoad={() => setImageStatus("loaded")} 
               onError={handleImageError} 
           />
        ) : (
          <div className="flex flex-col items-center opacity-70">
             <ImagePlus className="size-8 mb-2" style={{ color: themeColor }} />
             <span className="text-sm font-bold" style={{ color: textColor }}>Adicionar Fundo</span>
          </div>
        )}
      </div>
    );
  };

  const renderTestimonials = (cardClasses: string, titleClasses: string, textClasses: string, forceInvertedStyle = false) => {
    if (testimonials.length === 0) return null;
    
    const textC = forceInvertedStyle ? boxColor : textColor;
    const borderC = forceInvertedStyle ? `${boxColor}50` : `${themeColor}40`;
    
    return (
      <div className="mt-8 space-y-4 text-left pointer-events-auto">
        {testimonials.map((test, i) => {
          const parts = test.split(/\|/);
          const header = parts[0]?.trim() || "";
          const text = parts[1]?.trim() || test;
          
          return (
            <div key={i} className={cardClasses} style={{ backgroundColor: forceInvertedStyle ? themeColor + 'E6' : boxColor + 'E6', borderColor: borderC }}>
               <Editable 
                  as="p" 
                  value={header} 
                  onChange={(v) => {
                    const n = [...testimonials];
                    n[i] = `${v} | ${text}`;
                    onChange({ testimonials: n });
                  }}
                  className={titleClasses}
                  style={{ color: textC }}
                />
               <Editable 
                  as="p" 
                  multiline 
                  value={text.replace(/["']/g, '')} 
                  onChange={(v) => {
                    const n = [...testimonials];
                    n[i] = `${header} | ${v}`;
                    onChange({ testimonials: n });
                  }}
                  className={textClasses}
                  style={{ color: textC, opacity: 0.8 }}
                />
            </div>
          )
        })}
      </div>
    );
  };

  const textCardShapeClass = 
    backgroundShape === 'arch' ? 'rounded-t-[80px] rounded-b-3xl' : 
    backgroundShape === 'pill' ? 'rounded-[100px] px-8' : 
    backgroundShape === 'blob' ? 'rounded-[30%_70%_70%_30%/30%_30%_70%_70%]' : 
    backgroundShape === 'curve' ? 'rounded-3xl rounded-tr-[100px]' : 
    'rounded-3xl';

  const textCardClass = cn("p-12 shadow-2xl relative z-10 w-full pointer-events-auto transition-all", textCardShapeClass);
  const textCardStyle = { backgroundColor: `${boxColor}F2`, color: textColor, borderColor: themeColor, borderWidth: '2px' };

  let emailContent;

  if (layoutStyle === "editorial") {
    emailContent = (
      <div className={cn("w-full h-full flex flex-col pointer-events-auto", fontClass)}>
         <div className="h-[360px] w-full shrink-0">
            {renderImageWindow("h-full w-4/5 mx-auto rounded-[16px] mt-10")}
         </div>
         
         <div className="flex-1 rounded-[24px] shadow-2xl p-10 flex flex-col justify-center" style={{ backgroundColor: boxColor + 'F2', color: textColor }}>
            <div className="py-6 border-b text-center mb-10" style={{ borderColor: `${textColor}10` }}>
               <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-bold tracking-widest uppercase text-sm" style={{ color: textColor }} />
            </div>

            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-serif text-[42px] leading-tight mb-6 text-center" style={{ color: textColor }} />

            <div className="text-[15px] leading-relaxed opacity-80 space-y-4 px-6">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor }} />)}
            </div>

            {hasOffer && <div className="mt-8 font-bold text-lg mb-8 py-5 px-6 rounded-xl border text-center shadow-sm mx-6" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}
            
            {cta && (
              <div className="mt-8 flex justify-center">
                 <button className="px-10 py-4 font-bold text-[15px] text-white shadow-xl hover:scale-105 active:scale-95 transition-transform" style={{ backgroundColor: themeColor, borderRadius: '0' }}>
                   <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
                 </button>
              </div>
            )}

            <div className="px-6">
               {renderTestimonials("border-t border-b py-4 my-8", "font-bold text-[15px]", "text-[14px] italic mt-1")}
               {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-10 text-xs opacity-50 text-center" style={{ color: textColor }} />}
            </div>
         </div>
      </div>
    );
  } else if (layoutStyle === "newsletter") {
    emailContent = (
      <div className={cn("w-full h-full flex flex-col pointer-events-auto", fontClass)}>
         <div className="px-8 py-6 flex items-center justify-between border-b relative z-10 shadow-sm" style={{ borderColor: `${textColor}10`, backgroundColor: `${boxColor}E6` }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-black text-xl tracking-tight" style={{ color: textColor }} />
            <span className="text-[10px] uppercase font-bold opacity-50" style={{ color: textColor }}>Edição Especial</span>
         </div>
         
         <div className="h-[280px] w-full shrink-0">
            {renderImageWindow("h-full w-full")}
         </div>
         
         <div className={cn(textCardClass, "rounded-b-none rounded-t-[40px] flex-1 -mt-8")} style={textCardStyle}>
            {heroBadge && <div className="inline-block px-3 py-1 mb-5 text-[10px] font-bold uppercase tracking-widest border rounded-md" style={{ color: themeColor, borderColor: themeColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}

            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold text-[32px] mb-6 leading-[1.1]" style={{ color: textColor }} />

            <div className="text-[16px] leading-relaxed space-y-5">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor, opacity: 0.9 }} />)}
            </div>
            
            {hasOffer && <div className="font-bold text-lg mb-8 py-5 px-6 rounded-xl border text-center shadow-sm mt-8" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}
            
            {cta && (
              <button className="mt-4 px-8 py-4 rounded-md font-bold text-sm text-white shadow-md hover:bg-opacity-90 transition-colors w-full active:scale-[0.98]" style={{ backgroundColor: themeColor }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}

            {renderTestimonials("p-5 bg-black/5 rounded-lg my-8 border-l-4", "font-bold text-[15px]", "text-[14px] italic mt-1")}

            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-8 text-xs text-center opacity-50" style={{ color: textColor }} />}
         </div>
      </div>
    );
  } else if (layoutStyle === "modern") {
    emailContent = (
      <div className={cn("w-full h-full flex flex-col pointer-events-auto", fontClass)}>
         <div className={cn(textCardClass, "w-full rounded-none min-h-[400px] flex flex-col justify-center border-0")} style={textCardStyle}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-bold tracking-widest text-xs mb-8 uppercase opacity-80" />
            
            {heroBadge && <div className="inline-block px-4 py-1.5 rounded-full mb-5 text-[10px] font-bold uppercase tracking-widest border w-max" style={{ borderColor: themeColor, color: themeColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-[34px] mb-6 leading-[1.1]" style={{ color: textColor }} />
            
            <div className="text-[14px] leading-relaxed space-y-4 opacity-90 mb-8">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor }} />)}
            </div>

            {hasOffer && <div className="font-bold text-lg py-5 px-6 rounded-xl border text-center shadow-lg w-full mb-6" style={{ color: themeColor, backgroundColor: `${themeColor}20`, borderColor: `${themeColor}40` }}>{offerRaw}</div>}

            {cta && (
              <button className="px-8 py-4 rounded-xl font-bold text-[14px] shadow-2xl hover:scale-105 active:scale-95 transition-transform w-full" style={{ color: boxColor, backgroundColor: themeColor }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
         </div>

         <div className="flex-1 p-8 flex flex-col items-center justify-start">
            {renderImageWindow("w-full aspect-[4/5] shadow-2xl rounded-[16px] mb-8")}
            {renderTestimonials("p-5 border rounded-xl my-6 w-full", "font-bold text-[14px] mb-1", "text-[13px] italic")}
         </div>
      </div>
    );
  } else if (layoutStyle === "overlap") {
    emailContent = (
      <div className={cn("w-full h-full flex flex-col pointer-events-auto", fontClass)}>
         <div className="p-16 pb-40 relative text-center rounded-b-[60px] shadow-xl" style={{ backgroundColor: `${themeColor}E6`, color: boxColor }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-bold tracking-widest text-sm mb-6 uppercase opacity-80" />
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-black tracking-tight text-[46px] mb-6 leading-[1.1] drop-shadow-md" style={{ color: boxColor }} />
            {heroBadge && <div className="inline-block px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white"><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
         </div>
         
         <div className="px-6 -mt-24 relative z-10 flex flex-col items-center pb-12">
            <div className="mb-8 w-64 h-64">
               {renderImageWindow("w-full h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[6px] rounded-[16px]", { borderColor: boxColor })}
            </div>

            <div className={cn(textCardClass, "max-w-[95%]")} style={textCardStyle}>
               <div className="text-[16px] leading-relaxed space-y-5 text-center">
                  {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor, opacity: 0.9 }} />)}
               </div>

               {renderTestimonials("p-6 rounded-2xl shadow-md my-8 border border-b-4", "font-bold text-[15px] mb-1.5", "text-[14px] italic")}

               {hasOffer && <div className="p-6 rounded-2xl text-center font-bold text-xl my-8 shadow-sm border" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}

               {cta && (
                 <div className="mt-8 text-center">
                   <button className="px-10 py-4 rounded-full font-bold text-[15px] text-white shadow-xl hover:scale-105 active:scale-95 transition-transform" style={{ backgroundColor: themeColor, boxShadow: `0 10px 30px -5px ${themeColor}80` }}>
                     <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
                   </button>
                 </div>
               )}

               {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-10 text-xs text-center" style={{ color: textColor, opacity: 0.5 }} />}
            </div>
         </div>
      </div>
    );
  } else if (layoutStyle === "minimalist") {
    emailContent = (
      <div className={cn("w-full h-full flex flex-col pointer-events-auto", fontClass)}>
         <div className="px-8 py-8 flex justify-center border-b" style={{ borderColor: `${themeColor}20`, backgroundColor: boxColor + 'E6' }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-black text-2xl tracking-tight uppercase" style={{ color: textColor }} />
         </div>
         
         <div className="h-72 w-full shrink-0">
            {renderImageWindow("h-full w-full")}
         </div>
         
         <div className="p-10 text-left flex-1" style={{ backgroundColor: boxColor + 'E6', color: textColor }}>
            {heroBadge && <div className="inline-block px-3 py-1 mb-5 text-[10px] font-bold uppercase tracking-widest border rounded-md" style={{ color: themeColor, borderColor: themeColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-[36px] mb-6 leading-[1.1]" style={{ color: textColor }} />
            
            <div className="text-[16px] leading-relaxed space-y-5">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor, opacity: i === 0 ? 1 : 0.8, fontWeight: i === 0 ? 'bold' : 'normal' }} />)}
            </div>

            {renderTestimonials("border-l-[4px] pl-5 py-2 my-8 rounded-r-xl", "font-bold text-[15px]", "text-[14px] italic mt-1")}

            {hasOffer && <div className="font-bold text-lg mb-8 py-5 px-6 rounded-xl border text-center shadow-sm" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}
            
            {cta && (
              <button className="px-8 py-4 rounded-full font-bold text-sm text-white shadow-lg hover:scale-105 transition-transform w-auto active:scale-95" style={{ backgroundColor: themeColor, boxShadow: `0 10px 25px -5px ${themeColor}60` }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}

            {footerInfo && <div className="mt-10 pt-6 border-t" style={{ borderColor: `${textColor}15` }}><Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="text-xs text-center" style={{ color: textColor, opacity: 0.5 }} /></div>}
         </div>
      </div>
    );
  } else if (layoutStyle === "split") {
    emailContent = (
      <div className={cn("flex flex-col text-center pointer-events-auto w-full h-full", fontClass)} style={{ color: textColor }}>
         <div className="h-[280px] w-full shrink-0">
            {renderImageWindow("h-full w-full")}
         </div>
         
         <div className="relative shadow-2xl transition-colors duration-500 rounded-t-[40px] border-t-4 z-10 -mt-10" style={{ backgroundColor: `${themeColor}E6`, borderColor: boxColor }}>
            <div className="p-12 pb-8">
               <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-bold tracking-widest text-sm mb-5 uppercase" style={{ color: boxColor, opacity: 0.8 }} />
               {heroBadge && <div className="inline-block px-4 py-1.5 rounded-full mb-5 text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: `${boxColor}20`, color: boxColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}

               <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-black text-[38px] mb-4 leading-tight" style={{ color: boxColor }} />
            </div>
         </div>

         <div className="flex-1 p-10 flex flex-col items-center" style={{ backgroundColor: boxColor + 'E6' }}>
            <div className="text-[16px] leading-relaxed space-y-4 max-w-[90%]">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor }} />)}
            </div>

            {hasOffer && <div className="font-bold text-lg mb-8 py-5 px-6 rounded-xl border text-center shadow-sm w-full mt-6" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}

            {renderTestimonials("p-4 bg-black/5 rounded-lg my-6 w-full text-left", "font-bold text-[14px]", "text-[13px] italic mt-1")}

            {cta && (
              <button className="mt-8 px-12 py-4 rounded-xl font-bold text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-transform" style={{ backgroundColor: themeColor }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}

            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-10 text-[11px] opacity-40 uppercase tracking-widest" style={{ color: textColor }} />}
         </div>
      </div>
    );
  } else {
    emailContent = (
      <div className={cn("flex flex-col items-center text-center p-12 pointer-events-auto h-full", fontClass)} style={{ backgroundColor: `${boxColor}F2` }}>
         <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-black tracking-[0.2em] text-sm uppercase mb-10 opacity-70" style={{ color: textColor }} />
         
         {heroBadge && <div className="inline-block px-4 py-1.5 rounded-full mb-6 text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: `${themeColor}20`, color: themeColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}

         <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold text-[42px] leading-tight mb-8 drop-shadow-sm max-w-[95%]" style={{ color: textColor }} />

         <div className="w-full aspect-video mb-10">
            {renderImageWindow("w-full h-full rounded-[24px] shadow-2xl border border-white/10")}
         </div>

         <div className="text-[16px] leading-relaxed space-y-5 max-w-[90%] mx-auto">
            {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor, opacity: 0.9 }} />)}
         </div>

         {renderTestimonials("p-6 border border-b-4 rounded-xl shadow-sm my-10 w-full text-left", "font-bold text-[15px] mb-1.5", "text-[14px] italic")}

         {hasOffer && <div className="w-full font-bold text-xl py-6 px-6 rounded-2xl border text-center shadow-sm my-6" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}

         {cta && (
           <button className="mt-8 px-12 py-5 rounded-2xl font-bold text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-all w-full max-w-sm" style={{ backgroundColor: themeColor, boxShadow: `0 20px 40px -10px ${themeColor}80` }}>
             <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
           </button>
         )}

         {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-12 text-xs opacity-50 uppercase tracking-widest" style={{ color: textColor }} />}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col space-y-4" data-testid="email-preview">
      <div 
         id="email-export-node"
         data-export-node="email"
         className={cn(
            "relative mx-auto bg-[#f8f9fa] shadow-2xl rounded-2xl overflow-hidden transition-colors duration-500",
            exportWrapperClass || "w-full max-w-[600px] min-h-[800px]"
         )}
         style={{ fontFamily: baseFontFamily, width: isExportClone ? '600px' : '100%', margin: isExportClone ? '0 auto' : undefined, ...exportWrapperStyle }}
      >
        {/* Produtos adicionados pelo usuário são preservados na arte final, sem controles interativos. */}
        <div className="absolute inset-0 z-50 pointer-events-none [&>*]:pointer-events-auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
            {draggableImages.length > 0 && draggableImages.map((src, i) => (
               <DraggableImage key={`email-img-${i}`} src={src} type="email" isExport={isExportClone} />
            ))}
        </div>
        {emailContent}
      </div>

      {!isExportClone && (
      <div className="editor-toolbar rounded-2xl border border-border-subtle bg-surface-1/85 p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted flex items-center gap-2">
          Peça: <span className="px-2 py-1 rounded bg-brand/10 text-brand">E-MAIL MARKETING</span>
          {analyzingColors && <span className="text-xs text-brand animate-pulse flex items-center gap-1"><Sparkles className="size-3" /> Cores...</span>}
        </div>
        <div className="editor-toolbar-actions shrink-0">
          
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3">
                <Palette className="mr-1.5 size-3.5" /> Design
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="mb-2 w-[min(340px,calc(100vw-24px))] rounded-2xl border-border-strong bg-surface-1 p-4 shadow-[var(--shadow-elevated)] z-50">
              <div className="space-y-4">
                
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <LayoutTemplate className="mr-1.5 size-3" /> Estrutura
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant={layoutStyle === 'centered' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'centered' })} className="h-7 text-[11px]">Centro</Button>
                    <Button size="sm" variant={layoutStyle === 'minimalist' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'minimalist' })} className="h-7 text-[11px]">Clean</Button>
                    <Button size="sm" variant={layoutStyle === 'split' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'split' })} className="h-7 text-[11px]">Blocos</Button>
                    <Button size="sm" variant={layoutStyle === 'editorial' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'editorial' })} className="h-7 text-[11px]">Revista</Button>
                    <Button size="sm" variant={layoutStyle === 'newsletter' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'newsletter' })} className="h-7 text-[11px]">News</Button>
                    <Button size="sm" variant={layoutStyle === 'modern' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'modern' })} className="h-7 text-[11px]">Moderno</Button>
                    <Button size="sm" variant={layoutStyle === 'overlap' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'overlap' })} className="h-7 text-[11px]">Overlap</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <Layers className="mr-1.5 size-3" /> Forma do Card
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant={backgroundShape === 'square' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'square' })} className="h-7 text-[11px]">Quadrado</Button>
                    <Button size="sm" variant={backgroundShape === 'curve' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'curve' })} className="h-7 text-[11px]">Curva</Button>
                    <Button size="sm" variant={backgroundShape === 'arch' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'arch' })} className="h-7 text-[11px]">Arco</Button>
                    <Button size="sm" variant={backgroundShape === 'pill' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'pill' })} className="h-7 text-[11px]">Pílula</Button>
                    <Button size="sm" variant={backgroundShape === 'blob' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'blob' })} className="h-7 text-[11px]">Orgânico</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <Palette className="mr-1.5 size-3" /> Cores
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Destaque (Botão/Icon)</label>
                      <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                        <input type="color" value={themeColor} onChange={(e) => onChange({ themeColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <span className="text-[10px] uppercase text-fg-primary">{themeColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Fundo Principal</label>
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
                    <Button size="sm" variant={(!state.fontFamily || state.fontFamily === 'sans') ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'sans' })} className="h-7 text-[11px] font-sans">Modern (Sans)</Button>
                    <Button size="sm" variant={state.fontFamily === 'serif' ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'serif' })} className="h-7 text-[11px] font-serif">Classic (Serif)</Button>
                    <Button size="sm" variant={state.fontFamily === 'mono' ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'mono' })} className="h-7 text-[11px] font-mono">Tech (Mono)</Button>
                  </div>
                </div>

              </div>
            </PopoverContent>
          </Popover>

          <input type="file" multiple accept="image/*" className="hidden" ref={fileRef} onChange={handleProductChange} />
          <input type="file" accept="image/*" className="hidden" ref={bgRef} onChange={handleBackgroundChange} />
          
          <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="mr-1.5 size-3.5" /> Produtos
          </Button>

          <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3" onClick={() => bgRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Fundo
          </Button>

          {state.productImageUrl && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ productImageUrl: null })} title="Remover Fundo" className="text-rose-400 hover:text-rose-500 hover:bg-rose-500/10">
              <Trash2 className="size-4" />
            </Button>
          )}

          {(state.productImages?.length || 0) > 0 && (
             <Button size="sm" variant="ghost" onClick={() => onChange({ productImages: [] })} title="Limpar Produtos" className="text-orange-400 hover:text-orange-500 hover:bg-orange-500/10">
               <Trash2 className="size-4" />
             </Button>
          )}

          <Button size="sm" variant="ghost" className="h-8 rounded-lg bg-surface-3 text-xs font-bold text-fg-primary hover:bg-surface-2 sm:ml-2" onClick={handleRegenerate}>
            <RefreshCw className="mr-1.5 size-3.5" /> IA
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
