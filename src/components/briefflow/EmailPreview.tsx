// src/components/briefflow/EmailPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, RefreshCw, Trash2, ImagePlus, Sparkles } from "lucide-react";
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
  const themeColor = state.themeColor || "#2563eb";
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

  const renderImage = (classes: string) => {
    if (!activeHeroUrl && imageStatus !== "loading" && draggableImages.length === 0) {
      return (
        <div 
          className={cn("relative w-full overflow-hidden flex flex-col items-center justify-center bg-slate-100 border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors", classes)} 
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-8 text-slate-400 mb-2" />
          <span className="text-sm font-bold text-slate-500">Adicionar Imagem</span>
        </div>
      );
    }

    return (
      <div className={cn("relative w-full overflow-hidden group/hero-img bg-slate-900", classes)}>
        {!hasImportedImage && imageStatus === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <Loader2 className="animate-spin text-slate-400" />
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
            {/* UX/DESIGN: Transformado para Cover, tirando o padding e o box */}
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

  const renderTestimonials = (cardClasses: string, titleClasses: string, textClasses: string) => {
    if (testimonials.length === 0) return null;
    return (
      <div className="mt-8 space-y-4 text-left">
        {testimonials.map((test, i) => {
          const parts = test.split(/\||\n/);
          const header = parts[0]?.trim() || "";
          const text = parts[1]?.trim() || test;
          return (
            <div key={i} className={cardClasses}>
               <p className={titleClasses}>{header}</p>
               <p className={textClasses}>{text.replace(/["']/g, '')}</p>
            </div>
          )
        })}
      </div>
    );
  };

  let content;

  if (layoutStyle === "minimalist") {
    content = (
      <div id="email-export-node" className="bg-white rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border border-white/10 overflow-hidden text-left font-sans flex flex-col">
         <div className="px-8 py-8 flex justify-center border-b border-slate-100">
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-black text-2xl tracking-tight text-slate-900 uppercase" />
         </div>
         {renderImage("h-64 md:h-80")}
         <div className="p-8 md:p-12 text-left">
            {heroBadge && <div className="inline-block px-3 py-1 mb-5 text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-500 rounded-md"><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-3xl md:text-[40px] text-slate-900 mb-6 leading-[1.1]" />
            <div className="text-slate-600 text-[16px] leading-relaxed space-y-5">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} />)}
            </div>
            {renderTestimonials("border-l-[4px] pl-5 py-2 my-8 bg-slate-50/50 rounded-r-xl", "font-bold text-[15px] text-slate-900", "text-[14px] text-slate-600 italic mt-1")}
            {hasOffer && <div className="font-bold text-lg mb-8 py-5 px-6 bg-slate-50 rounded-xl border border-slate-100 text-center shadow-sm" style={{ color: themeColor }}>{offerRaw}</div>}
            {cta && (
              <button className="px-8 py-4 rounded-full font-bold text-sm text-white shadow-lg hover:scale-105 transition-transform w-auto active:scale-95" style={{ backgroundColor: themeColor, boxShadow: `0 10px 25px -5px ${themeColor}60` }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
            {footerInfo && <div className="mt-10 pt-6 border-t border-slate-100"><Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="text-xs text-slate-400 text-center" /></div>}
         </div>
      </div>
    );
  } else if (layoutStyle === "split") {
    content = (
      <div id="email-export-node" className="bg-white rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border border-white/10 overflow-hidden flex flex-col text-center font-sans">
         {renderImage("h-64 md:h-96")}
         <div className="p-10 md:p-14 relative transition-colors duration-500" style={{ backgroundColor: themeColor }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="text-white/80 font-bold tracking-widest text-sm mb-5 uppercase" />
            {heroBadge && <div className="inline-block px-4 py-1.5 rounded-full mb-5 text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white backdrop-blur-sm"><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-3xl md:text-[42px] text-white mb-8 leading-[1.1] drop-shadow-sm" />
            {cta && (
              <button className="px-10 py-4 rounded-full font-bold text-[15px] bg-white shadow-xl hover:scale-105 active:scale-95 transition-transform" style={{ color: themeColor }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
         </div>
         <div className="p-10 md:p-14 bg-slate-50 text-left">
            <div className="text-slate-700 text-[16px] leading-relaxed space-y-5">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} />)}
            </div>
            {renderTestimonials("p-6 bg-white border border-slate-200 rounded-2xl shadow-sm my-8", "font-bold text-[15px] text-slate-900 mb-1.5", "text-[14px] text-slate-600 italic")}
            {hasOffer && <div className="p-6 bg-white border border-slate-200 rounded-2xl text-center font-bold text-lg my-8 shadow-sm" style={{ color: themeColor }}>{offerRaw}</div>}
            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-8 text-xs text-slate-500 text-center" />}
         </div>
      </div>
    );
  } else if (layoutStyle === "diagonal") {
    content = (
      <div id="email-export-node" className="bg-slate-100 rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border border-white/10 overflow-hidden relative font-sans flex flex-col">
         <div className="p-10 md:p-14 pb-28 text-center relative z-0 transition-colors duration-500" style={{ backgroundColor: themeColor, clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)" }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="text-white font-black text-2xl tracking-tighter mb-6 opacity-90" />
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-extrabold tracking-tight text-3xl md:text-[40px] text-white leading-[1.1] max-w-sm mx-auto drop-shadow-md" />
         </div>
         <div className="px-6 md:px-12 -mt-20 relative z-10">
            {renderImage("h-56 md:h-72 rounded-2xl shadow-2xl border-[6px] border-white bg-slate-200")}
         </div>
         <div className="p-8 md:p-12 text-center">
            {heroBadge && <div className="inline-block px-5 py-2 mb-8 text-[11px] font-black uppercase tracking-widest rounded-lg bg-white shadow-md" style={{ color: themeColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <div className="text-slate-600 text-[16px] leading-relaxed space-y-5 text-left">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} />)}
            </div>
            {renderTestimonials("p-6 bg-white rounded-2xl shadow-md text-left border-l-4 my-8", "font-bold text-[15px] text-slate-900 mb-1.5", "text-[14px] text-slate-600 italic")}
            {hasOffer && <div className="p-6 bg-slate-200/50 rounded-2xl font-bold text-lg my-8 text-slate-900 border border-slate-300/50">{offerRaw}</div>}
            {cta && (
              <button className="w-full py-4 rounded-xl font-bold text-[15px] text-white mt-4 shadow-xl hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: themeColor, boxShadow: `0 12px 30px -10px ${themeColor}80` }}>
                <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-8 text-xs text-slate-400" />}
         </div>
      </div>
    );
  } else {
    // centered
    content = (
      <div id="email-export-node" className="rounded-[24px] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] border border-white/10 overflow-hidden font-sans transition-colors duration-500" style={{ backgroundColor: themeColor }}>
        <div className="w-full text-center py-8 pb-6">
          <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="text-white font-extrabold italic text-2xl tracking-wider drop-shadow-sm opacity-90" />
        </div>
        <div className="relative px-8 md:px-12 pb-12 text-center">
            {heroBadge && (
              <div className="inline-block px-4 py-1.5 rounded-full mb-6 text-[10px] font-black uppercase tracking-widest bg-white/15 text-white backdrop-blur-md border border-white/20">
                <Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} />
              </div>
            )}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="text-white font-extrabold tracking-tight text-3xl md:text-[44px] leading-[1.1] mb-8 drop-shadow-lg" />
            {cta && (
              <button className="px-10 py-4 rounded-full font-bold text-[15px] transition-all hover:scale-105 active:scale-95 shadow-xl bg-white text-slate-900">
                 <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} style={{ color: themeColor }} />
              </button>
            )}
            {renderImage("mt-12 h-56 md:h-80 rounded-2xl border-[4px] border-white/20 shadow-2xl bg-slate-950")}
        </div>
        <div className="bg-[#ffffff] rounded-t-[40px] px-8 md:px-12 py-12 text-center shadow-[0_-10px_30px_rgba(0,0,0,0.15)] relative z-10">
            <div className="text-slate-600 text-[16px] leading-relaxed space-y-5 text-left">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} className={i === 0 ? "font-bold text-xl text-slate-900 mb-6 text-center" : ""} />)}
            </div>
            {renderTestimonials("p-6 border-2 border-slate-100 rounded-2xl bg-slate-50/50 shadow-sm text-left my-8", "font-bold text-[15px] text-slate-900 mb-1.5", "text-[14px] text-slate-600 italic")}
            {hasOffer && <div className="mt-8 rounded-2xl p-6 font-bold text-xl shadow-md border border-slate-100" style={{ color: themeColor, backgroundColor: `${themeColor}10` }}>{offerRaw}</div>}
            {cta && (
              <div className="mt-10">
                <button className="px-10 py-4 rounded-full font-bold text-[15px] text-white transition-all hover:scale-105 active:scale-95 shadow-lg" style={{ backgroundColor: themeColor, boxShadow: `0 10px 25px -5px ${themeColor}60` }}>
                  <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
                </button>
              </div>
            )}
            {footerInfo && (
              <div className="mt-8">
                <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="text-[11px] text-slate-400" />
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
          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleFileChange} />
          <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Foto
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs font-bold rounded-lg bg-surface-3 hover:bg-surface-2 text-fg-primary" onClick={handleRegenerate}>
            <RefreshCw className="mr-1.5 size-3.5" /> Gerar IA
          </Button>
        </div>
      </div>
    </div>
  );
}