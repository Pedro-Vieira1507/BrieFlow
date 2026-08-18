// src/components/briefflow/EmailPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, RefreshCw, Trash2, ImagePlus, Sparkles, Palette, LayoutTemplate, Type, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { cleanText, isEmptyLike } from "@/lib/sanitize";
import { analyzeImageWithVisionFn } from "@/lib/vision-api";
import { toast } from "sonner";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function EmailPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const [analyzingColors, setAnalyzingColors] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  
  const { builder } = useBriefflowStore();

  const layoutStyle = state.layoutStyle || "centered";
  const backgroundShape = state.backgroundShape || "square";
  const themeColor = state.themeColor || "#2563eb";
  const textColor = state.textColor || "#0f172a";
  const boxColor = state.boxColor || "#ffffff";
  const fontClass = state.fontFamily === "serif" ? "font-serif" : state.fontFamily === "mono" ? "font-mono" : "font-sans";

  const brandName = cleanText(state.brandName, "SUA MARCA");
  const heroBadge = cleanText(state.heroBadge, "");
  const title = cleanText(state.subtitle || state.title, "Headline de Alta Conversão");
  const cta = cleanText(state.cta, "Acessar Agora");
  const footerInfo = cleanText(state.footerInfo, "");
  
  const paragraphs = useMemo(() => 
     cleanText(state.body ?? "").split(/\n+/).map(cleanText).filter(Boolean),
  [state.body]);
  
  const testimonials = state.testimonials || [];
  const prompt = cleanText(state.emailHeroImagePrompt);
  
  const hasImportedImage = !!state.productImageUrl;
  const isProductImage = hasImportedImage;
  
  const offerRaw = builder.discoveryPlan?.offer;
  const hasOffer = !isEmptyLike(offerRaw);

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
      setImageStatus((prev) => (prev === "loading" ? (useFallback || isProductImage ? "error" : setUseFallback(true), "loading") : prev));
    }, 5000);
    return () => clearTimeout(timer);
  }, [heroUrl, useFallback, isProductImage]);

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
            secondaryColor: visionResult.secondaryBrandColor || "#0f172a"
          });
          toast.success("Paleta harmonizada com o e-mail!", { id: toastId });
        } else {
          toast.dismiss(toastId);
        }
      } catch (err) {
        console.error("Erro Vision API:", err);
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

  // Gerador da Forma Visual de E-mail (Mapeado para border-radius, já que clip-path quebra no Outlook/Gmail)
  const shapeStyle = useMemo(() => {
    switch (backgroundShape) {
      case "arch": return { borderRadius: "1000px 1000px 16px 16px" };
      case "pill": return { borderRadius: "1000px" };
      case "blob": return { borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%" };
      case "curve": return { borderRadius: "16px 16px 50% 50%" };
      default: return { borderRadius: "16px" }; // square
    }
  }, [backgroundShape]);

  const renderImage = (classes: string, customShapeStyle: React.CSSProperties = shapeStyle) => {
    if (!activeHeroUrl && imageStatus !== "loading" && draggableImages.length === 0) {
      return (
        <div 
          className={cn("relative w-full overflow-hidden flex flex-col items-center justify-center border-2 border-dashed cursor-pointer transition-colors", classes)} 
          style={{ borderColor: `${themeColor}40`, backgroundColor: `${themeColor}10`, ...customShapeStyle }}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-8 mb-2" style={{ color: themeColor }} />
          <span className="text-sm font-bold opacity-80" style={{ color: textColor }}>Adicionar Imagem</span>
        </div>
      );
    }

    return (
      <div className={cn("relative w-full overflow-hidden group/hero-img", classes)} style={{ backgroundColor: themeColor, ...customShapeStyle }}>
        {!hasImportedImage && imageStatus === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <Loader2 className="animate-spin text-white/60" />
          </div>
        )}
        
        {!hasImportedImage && imageStatus !== "error" && heroUrl && (
          <img 
            src={heroUrl} 
            alt="Capa Gerada" 
            onLoad={() => setImageStatus("loaded")} 
            onError={() => setImageStatus("error")} 
            className="absolute inset-0 z-0 w-full h-full object-cover transition-opacity duration-700" 
            style={{ opacity: imageStatus === 'loaded' ? 1 : 0 }} 
          />
        )}

        {hasImportedImage && (
          <div className="absolute inset-0 z-10 bg-black flex items-center justify-center">
            <img 
              src={state.productImageUrl!} 
              alt="Capa Importada" 
              className="w-full h-full object-cover object-center opacity-90" 
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

        {!hasImportedImage && draggableImages.length > 0 && (
          <div className="relative z-20 w-full h-full">
            {draggableImages.map((src, i) => <DraggableImage key={`${src}-${i}`} src={src} />)}
          </div>
        )}
      </div>
    );
  };

  // Correção de Contraste para "Texto Branco no Fundo Branco" 
  const renderTestimonials = (cardClasses: string, titleClasses: string, textClasses: string, forceInvertedStyle = false) => {
    if (testimonials.length === 0) return null;
    
    // Se o layout for invertido (modern), usamos boxColor como texto para garantir que ele apareça. 
    // Caso contrário, usamos themeColor para as bordas e textColor pro texto.
    const textC = forceInvertedStyle ? boxColor : textColor;
    const borderC = forceInvertedStyle ? `${boxColor}50` : `${themeColor}40`;
    
    return (
      <div className="mt-8 space-y-4 text-left">
        {testimonials.map((test, i) => {
          const parts = test.split(/\||\n/);
          const header = parts[0]?.trim() || "";
          const text = parts[1]?.trim() || test;
          return (
            <div key={i} className={cardClasses} style={{ backgroundColor: forceInvertedStyle ? themeColor : boxColor, borderColor: borderC }}>
               <p className={titleClasses} style={{ color: textC }}>{header}</p>
               <p className={textClasses} style={{ color: textC, opacity: 0.8 }}>{text.replace(/["']/g, '')}</p>
            </div>
          )
        })}
      </div>
    );
  };

  let content;

  // LAYOUT: EDITORIAL (Arco no topo, tipografia clássica)
  if (layoutStyle === "editorial") {
    content = (
      <div id="email-export-node" className={cn("rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border overflow-hidden text-center flex flex-col", fontClass)} style={{ backgroundColor: boxColor, borderColor: `${textColor}20`, color: textColor }}>
         <div className="py-6 border-b" style={{ borderColor: `${textColor}10` }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-bold tracking-widest uppercase text-sm" style={{ color: textColor }} />
         </div>
         <div className="px-8 pt-10 pb-6 flex justify-center">
            {renderImage("h-[280px] md:h-[360px] w-4/5 shadow-2xl mx-auto")}
         </div>
         <div className="px-8 md:px-16 pb-12">
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-serif text-3xl md:text-[42px] leading-tight mb-6" style={{ color: textColor }} />
            <div className="text-[15px] leading-relaxed opacity-80 space-y-4">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor }} />)}
            </div>
            {hasOffer && <div className="mt-8 font-bold text-lg mb-8 py-5 px-6 rounded-xl border text-center shadow-sm" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}
            {cta && (
              <button className="mt-8 px-10 py-4 font-bold text-[15px] text-white shadow-xl hover:scale-105 active:scale-95 transition-transform" style={{ backgroundColor: themeColor, borderRadius: '0' }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
            {renderTestimonials("border-t border-b py-4 my-8", "font-bold text-[15px]", "text-[14px] italic mt-1")}
            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-10 text-xs opacity-50" style={{ color: textColor }} />}
         </div>
      </div>
    );
  } 
  // LAYOUT: NEWSLETTER (Imagem estourada, header limpo)
  else if (layoutStyle === "newsletter") {
    content = (
      <div id="email-export-node" className={cn("rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border overflow-hidden text-left flex flex-col", fontClass)} style={{ backgroundColor: boxColor, borderColor: `${textColor}20`, color: textColor }}>
         <div className="px-8 py-8 flex items-center justify-between border-b" style={{ borderColor: `${textColor}10` }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-black text-xl tracking-tight" style={{ color: textColor }} />
            <span className="text-[10px] uppercase font-bold opacity-50">Edição Especial</span>
         </div>
         {renderImage("h-[300px] w-full", { borderRadius: "0" })}
         <div className="p-8 md:p-12">
            {heroBadge && <div className="inline-block px-3 py-1 mb-5 text-[10px] font-bold uppercase tracking-widest border rounded-md" style={{ color: themeColor, borderColor: themeColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold text-3xl md:text-[36px] mb-6 leading-[1.1]" style={{ color: textColor }} />
            <div className="text-[16px] leading-relaxed space-y-5">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor, opacity: 0.9 }} />)}
            </div>
            {hasOffer && <div className="font-bold text-lg mb-8 py-5 px-6 rounded-xl border text-center shadow-sm mt-8" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}
            {cta && (
              <button className="mt-4 px-8 py-4 rounded-md font-bold text-sm text-white shadow-md hover:bg-opacity-90 transition-colors w-full active:scale-[0.98]" style={{ backgroundColor: themeColor }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
            {renderTestimonials("p-5 bg-gray-50 rounded-lg my-8 border-l-4", "font-bold text-[15px]", "text-[14px] italic mt-1")}
            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-8 text-xs text-center opacity-50" style={{ color: textColor }} />}
         </div>
      </div>
    );
  }
  // LAYOUT: MODERN (Split em colunas com design geométrico)
  else if (layoutStyle === "modern") {
    content = (
      <div id="email-export-node" className={cn("rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border overflow-hidden flex flex-col md:flex-row text-left", fontClass)} style={{ backgroundColor: themeColor, borderColor: `${textColor}20`, color: boxColor }}>
         <div className="p-10 md:p-14 flex-1 flex flex-col justify-center border-b md:border-b-0 md:border-r" style={{ borderColor: `${boxColor}20` }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-bold tracking-widest text-xs mb-8 uppercase opacity-80" />
            {heroBadge && <div className="inline-block px-4 py-1.5 rounded-full mb-5 text-[10px] font-bold uppercase tracking-widest border w-max" style={{ borderColor: boxColor, color: boxColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-3xl md:text-[38px] mb-6 leading-[1.1]" style={{ color: boxColor }} />
            <div className="text-[14px] leading-relaxed space-y-4 opacity-90 mb-8">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: boxColor }} />)}
            </div>
            {cta && (
              <button className="px-8 py-4 rounded-xl font-bold text-[14px] shadow-2xl hover:scale-105 active:scale-95 transition-transform w-max" style={{ color: themeColor, backgroundColor: boxColor }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
         </div>
         <div className="flex-1 p-6 md:p-10 flex flex-col items-center justify-center bg-black/10">
            {renderImage("w-full aspect-[4/5] shadow-2xl")}
            {hasOffer && <div className="mt-8 font-bold text-lg py-5 px-6 rounded-xl border text-center shadow-lg w-full backdrop-blur-md" style={{ color: boxColor, backgroundColor: `${boxColor}20`, borderColor: `${boxColor}40` }}>{offerRaw}</div>}
            {renderTestimonials("p-5 border rounded-xl my-6 w-full backdrop-blur-sm", "font-bold text-[14px] mb-1", "text-[13px] italic", true)}
         </div>
      </div>
    );
  }
  // LAYOUT: OVERLAP (Blocos de cor com imagem invadindo a sessão de baixo)
  else if (layoutStyle === "overlap") {
    content = (
      <div id="email-export-node" className={cn("rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border overflow-hidden flex flex-col text-center", fontClass)} style={{ backgroundColor: boxColor, borderColor: `${textColor}20`, color: textColor }}>
         <div className="p-10 md:p-16 pb-32 relative" style={{ backgroundColor: themeColor, color: boxColor }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-bold tracking-widest text-sm mb-6 uppercase opacity-80" />
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-black tracking-tight text-3xl md:text-[46px] mb-6 leading-[1.1] drop-shadow-md" style={{ color: boxColor }} />
            {heroBadge && <div className="inline-block px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white backdrop-blur-sm"><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
         </div>
         
         <div className="px-8 -mt-24 relative z-10 flex justify-center">
            {renderImage("w-48 h-48 md:w-64 md:h-64 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[6px]", { ...shapeStyle, borderColor: boxColor })}
         </div>
         
         <div className="p-10 md:p-14 pt-8 text-left">
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
    );
  }
  // LAYOUTS CLÁSSICOS (Minimalist, Split, Diagonal, Centered)
  else if (layoutStyle === "minimalist") {
    content = (
      <div id="email-export-node" className={cn("rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border overflow-hidden text-left flex flex-col", fontClass)} style={{ backgroundColor: boxColor, borderColor: `${textColor}20`, color: textColor }}>
         <div className="px-8 py-8 flex justify-center border-b" style={{ borderColor: `${themeColor}20` }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-black text-2xl tracking-tight uppercase" style={{ color: textColor }} />
         </div>
         {renderImage("h-64 md:h-80")}
         <div className="p-8 md:p-12 text-left">
            {heroBadge && <div className="inline-block px-3 py-1 mb-5 text-[10px] font-bold uppercase tracking-widest border rounded-md" style={{ color: themeColor, borderColor: themeColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-3xl md:text-[40px] mb-6 leading-[1.1]" style={{ color: textColor }} />
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
    content = (
      <div id="email-export-node" className={cn("rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border overflow-hidden flex flex-col text-center", fontClass)} style={{ backgroundColor: boxColor, borderColor: `${textColor}20`, color: textColor }}>
         {renderImage("h-64 md:h-96")}
         <div className="p-10 md:p-14 relative transition-colors duration-500" style={{ backgroundColor: themeColor }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-bold tracking-widest text-sm mb-5 uppercase" style={{ color: textColor, opacity: 0.8 }} />
            {heroBadge && <div className="inline-block px-4 py-1.5 rounded-full mb-5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm" style={{ backgroundColor: `${textColor}20`, color: textColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-3xl md:text-[42px] mb-8 leading-[1.1] drop-shadow-sm" style={{ color: textColor }} />
            {cta && (
              <button className="px-10 py-4 rounded-full font-bold text-[15px] shadow-xl hover:scale-105 active:scale-95 transition-transform" style={{ color: themeColor, backgroundColor: boxColor }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
         </div>
         <div className="p-10 md:p-14 text-left">
            <div className="text-[16px] leading-relaxed space-y-5">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor, opacity: 0.9 }} />)}
            </div>
            {renderTestimonials("p-6 border rounded-2xl shadow-sm my-8", "font-bold text-[15px] mb-1.5", "text-[14px] italic")}
            {hasOffer && <div className="p-6 border rounded-2xl text-center font-bold text-lg my-8 shadow-sm" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}
            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-8 text-xs text-center" style={{ color: textColor, opacity: 0.5 }} />}
         </div>
      </div>
    );
  } else if (layoutStyle === "diagonal") {
    content = (
      <div id="email-export-node" className={cn("rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border overflow-hidden relative flex flex-col", fontClass)} style={{ backgroundColor: boxColor, borderColor: `${textColor}20`, color: textColor }}>
         <div className="p-10 md:p-14 pb-28 text-center relative z-0 transition-colors duration-500" style={{ backgroundColor: themeColor, clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)" }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-black text-2xl tracking-tighter mb-6" style={{ color: textColor, opacity: 0.9 }} />
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-3xl md:text-[40px] leading-[1.1] max-w-sm mx-auto drop-shadow-md" style={{ color: textColor }} />
         </div>
         <div className="px-6 md:px-12 -mt-20 relative z-10">
            {renderImage("h-56 md:h-72 shadow-2xl border-[6px]")}
         </div>
         <div className="p-8 md:p-12 text-center">
            {heroBadge && <div className="inline-block px-5 py-2 mb-8 text-[11px] font-black uppercase tracking-widest rounded-lg shadow-md" style={{ color: themeColor, backgroundColor: boxColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <div className="text-[16px] leading-relaxed space-y-5 text-left">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} style={{ color: textColor, opacity: 0.9 }} />)}
            </div>
            {renderTestimonials("p-6 rounded-2xl shadow-md text-left border-l-4 my-8", "font-bold text-[15px] mb-1.5", "text-[14px] italic")}
            {hasOffer && <div className="p-6 rounded-2xl font-bold text-lg my-8 border" style={{ color: textColor, backgroundColor: `${textColor}0A`, borderColor: `${textColor}20` }}>{offerRaw}</div>}
            {cta && (
              <button className="w-full py-4 rounded-xl font-bold text-[15px] text-white mt-4 shadow-xl hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: themeColor, boxShadow: `0 12px 30px -10px ${themeColor}80` }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-8 text-xs" style={{ color: textColor, opacity: 0.5 }} />}
         </div>
      </div>
    );
  } else {
    // centered
    content = (
      <div id="email-export-node" className={cn("rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border overflow-hidden transition-colors duration-500", fontClass)} style={{ backgroundColor: themeColor, borderColor: `${textColor}20` }}>
        <div className="w-full text-center py-8 pb-6">
          <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-extrabold italic text-2xl tracking-wider drop-shadow-sm" style={{ color: textColor, opacity: 0.9 }} />
        </div>
        <div className="relative px-8 md:px-12 pb-12 text-center">
            {heroBadge && (
              <div className="inline-block px-4 py-1.5 rounded-full mb-6 text-[10px] font-black uppercase tracking-widest backdrop-blur-md border" style={{ color: textColor, backgroundColor: `${textColor}15`, borderColor: `${textColor}33` }}>
                <Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} />
              </div>
            )}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-3xl md:text-[44px] leading-[1.1] mb-8 drop-shadow-lg" style={{ color: textColor }} />
            {cta && (
              <button className="px-10 py-4 rounded-full font-bold text-[15px] transition-all hover:scale-105 active:scale-95 shadow-xl" style={{ backgroundColor: boxColor, color: themeColor }}>
                 <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
            <div className="mt-12">
               {renderImage("h-56 md:h-80 border-[4px] shadow-2xl")}
            </div>
        </div>
        <div className="rounded-t-[40px] px-8 md:px-12 py-12 text-center shadow-[0_-10px_30px_rgba(0,0,0,0.15)] relative z-10" style={{ backgroundColor: boxColor, color: textColor }}>
            <div className="text-[16px] leading-relaxed space-y-5 text-left">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} className={i === 0 ? "font-bold text-xl mb-6 text-center" : ""} style={{ color: textColor, opacity: i === 0 ? 1 : 0.85 }} />)}
            </div>
            {renderTestimonials("p-6 border-2 rounded-2xl shadow-sm text-left my-8", "font-bold text-[15px] mb-1.5", "text-[14px] italic")}
            {hasOffer && <div className="mt-8 rounded-2xl p-6 font-bold text-xl shadow-md border" style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}33` }}>{offerRaw}</div>}
            {cta && (
              <div className="mt-10">
                <button className="px-10 py-4 rounded-full font-bold text-[15px] text-white transition-all hover:scale-105 active:scale-95 shadow-lg" style={{ backgroundColor: themeColor, boxShadow: `0 10px 25px -5px ${themeColor}60` }}>
                  <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
                </button>
              </div>
            )}
            {footerInfo && (
              <div className="mt-8">
                <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="text-[11px]" style={{ color: textColor, opacity: 0.5 }} />
              </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col space-y-4" data-testid="email-preview">
      {content}
      <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-2 p-3 shadow-md transition-opacity hover:opacity-100 mt-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-fg-muted flex items-center gap-2">
          Peça: <span className="px-2 py-1 rounded bg-brand/10 text-brand">E-MAIL ({layoutStyle.toUpperCase()})</span>
          {analyzingColors && <span className="text-xs text-brand animate-pulse flex items-center gap-1"><Sparkles className="size-3" /> Extraindo Cores...</span>}
        </div>
        <div className="flex gap-2">
          
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
                    <LayoutTemplate className="mr-1.5 size-3" /> Template
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    <Button size="sm" variant={layoutStyle === 'editorial' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'editorial' })} className="h-7 text-[10px] px-1">Editorial</Button>
                    <Button size="sm" variant={layoutStyle === 'newsletter' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'newsletter' })} className="h-7 text-[10px] px-1">Newsletter</Button>
                    <Button size="sm" variant={layoutStyle === 'modern' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'modern' })} className="h-7 text-[10px] px-1">Modern</Button>
                    <Button size="sm" variant={layoutStyle === 'overlap' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'overlap' })} className="h-7 text-[10px] px-1">Overlap</Button>
                    
                    <Button size="sm" variant={layoutStyle === 'split' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'split' })} className="h-7 text-[10px] px-1">Metade</Button>
                    <Button size="sm" variant={layoutStyle === 'diagonal' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'diagonal' })} className="h-7 text-[10px] px-1">Diagonal</Button>
                    <Button size="sm" variant={layoutStyle === 'centered' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'centered' })} className="h-7 text-[10px] px-1">Centro</Button>
                    <Button size="sm" variant={layoutStyle === 'minimalist' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'minimalist' })} className="h-7 text-[10px] px-1">Clean</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <Layers className="mr-1.5 size-3" /> Forma da Imagem
                  </h4>
                  <div className="grid grid-cols-5 gap-1">
                    <Button size="sm" variant={backgroundShape === 'square' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'square' })} className="h-7 text-[10px] px-1">Reto</Button>
                    <Button size="sm" variant={backgroundShape === 'curve' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'curve' })} className="h-7 text-[10px] px-1">Curva</Button>
                    <Button size="sm" variant={backgroundShape === 'arch' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'arch' })} className="h-7 text-[10px] px-1">Arco</Button>
                    <Button size="sm" variant={backgroundShape === 'pill' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'pill' })} className="h-7 text-[10px] px-1">Pílula</Button>
                    <Button size="sm" variant={backgroundShape === 'blob' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'blob' })} className="h-7 text-[10px] px-1">Blob</Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <Palette className="mr-1.5 size-3" /> Cores
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Fundo Topo</label>
                      <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                        <input type="color" value={themeColor} onChange={(e) => onChange({ themeColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <span className="text-[10px] uppercase text-fg-primary">{themeColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Fundo Base</label>
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

          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleFileChange} />
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