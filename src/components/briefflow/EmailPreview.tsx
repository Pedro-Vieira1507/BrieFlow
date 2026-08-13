// src/components/briefflow/EmailPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Upload, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { cleanText, isEmptyLike } from "@/lib/sanitize";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function EmailPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { builder } = useBriefflowStore();
  
  const layoutStyle = state.layoutStyle || "centered";
  const themeColor = state.themeColor || "#2563eb";
  const brandName = cleanText(state.brandName, "SUA MARCA");
  const heroBadge = cleanText(state.heroBadge, "");
  const title = cleanText(state.subtitle || state.title, "O vale que recompensa quem indica");
  const cta = cleanText(state.cta, "Quero Indicar");
  const footerInfo = cleanText(state.footerInfo, ""); // Alterado de "*Consulte o regulamento" para vazio
  
  const paragraphs = useMemo(() =>
     cleanText(state.body ?? "").split(/\n+/).map(cleanText).filter(Boolean),
  [state.body]);
  const testimonials = state.testimonials || [];
  const prompt = cleanText(state.emailHeroImagePrompt);
  const isProductImage = !!state.productImageUrl;
  
  const offerRaw = builder.discoveryPlan?.offer;
  const hasOffer = !isEmptyLike(offerRaw);
  
  const images = Array.from(new Set([
    ...(state.productImageUrl ? [state.productImageUrl] : []),
    ...(state.productImages || []),
  ]));

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
      setImageStatus((prev) => (prev === "loading" ? (useFallback || isProductImage ? "error" : setUseFallback(true), "loading") : prev));
    }, 5000);
    return () => clearTimeout(timer);
  }, [heroUrl, useFallback, isProductImage]);

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

  const renderImage = (classes: string) => heroUrl ? (
    <div className={cn("relative w-full overflow-hidden", classes)}>
      {imageStatus === "loading" && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><Loader2 className="animate-spin text-white" /></div>}
      {imageStatus !== "error" && (
        <img src={heroUrl} alt="Capa" onLoad={() => setImageStatus("loaded")} onError={() => setImageStatus("error")} className="absolute inset-0 w-full h-full object-cover" />
      )}
      {images.map((src, i) => <DraggableImage key={`${src}-${i}`} src={src} />)}
    </div>
  ) : null;

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
      <div id="email-export-node" className="bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden text-left font-sans flex flex-col">
         <div className="px-8 py-6">
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="font-black text-2xl tracking-tight text-slate-900 uppercase" />
         </div>
         {renderImage("h-56 md:h-72")}
         <div className="p-8 pt-8 text-left">
            {heroBadge && <div className="inline-block px-3 py-1 mb-4 text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-500 rounded"><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-black text-3xl md:text-4xl text-slate-900 mb-6 leading-tight" />
            <div className="text-slate-600 text-[16px] leading-relaxed space-y-4">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} />)}
            </div>
            {renderTestimonials("border-l-4 pl-4 py-1 my-6 border-brand", "font-bold text-[15px] text-slate-900", "text-[14px] text-slate-600 italic")}
            {hasOffer && <div className="font-bold text-lg mb-6 py-4 px-5 bg-slate-50 rounded-lg border border-slate-100 text-center" style={{ color: themeColor }}>{offerRaw}</div>}
            {cta && <button className="px-8 py-3.5 rounded-md font-bold text-sm text-white shadow-md hover:scale-105 transition-transform w-auto" style={{ backgroundColor: themeColor }}><Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} /></button>}
            {footerInfo && <div className="mt-8 pt-6 border-t border-slate-100"><Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="text-xs text-slate-400" /></div>}
         </div>
      </div>
    );
  } else if (layoutStyle === "split") {
    content = (
      <div id="email-export-node" className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col text-center font-sans">
         {renderImage("h-64 md:h-80")}
         <div className="p-10 relative" style={{ backgroundColor: themeColor }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="text-white/80 font-bold tracking-widest text-sm mb-4 uppercase" />
            {heroBadge && <div className="inline-block px-4 py-1 rounded-full mb-4 text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white"><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-black text-3xl md:text-4xl text-white mb-6 leading-tight drop-shadow-sm" />
            {cta && <button className="px-8 py-3.5 rounded-full font-bold text-sm bg-white shadow-lg hover:scale-105 transition-transform" style={{ color: themeColor }}><Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} /></button>}
         </div>
         <div className="p-10 bg-slate-50 text-left">
            <div className="text-slate-700 text-[16px] leading-relaxed space-y-4">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} />)}
            </div>
            {renderTestimonials("p-5 bg-white border border-slate-200 rounded-xl shadow-sm", "font-bold text-[15px] text-slate-900 mb-1", "text-[14px] text-slate-600 italic")}
            {hasOffer && <div className="p-5 bg-white border border-slate-200 rounded-xl text-center font-bold text-lg my-6 shadow-sm" style={{ color: themeColor }}>{offerRaw}</div>}
            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-8 text-xs text-slate-500 text-center" />}
         </div>
      </div>
    );
  } else if (layoutStyle === "diagonal") {
    content = (
      <div id="email-export-node" className="bg-slate-100 rounded-xl shadow-2xl overflow-hidden relative font-sans flex flex-col">
         <div className="p-10 pb-24 text-center relative z-0" style={{ backgroundColor: themeColor, clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)" }}>
            <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="text-white font-black text-2xl tracking-tighter mb-6" />
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="font-bold text-3xl md:text-4xl text-white leading-tight max-w-sm mx-auto drop-shadow-md" />
         </div>
         <div className="px-6 md:px-10 -mt-16 relative z-10">
            {renderImage("h-48 md:h-64 rounded-xl shadow-xl border-4 border-white bg-slate-200")}
         </div>
         <div className="p-8 md:p-10 text-center">
            {heroBadge && <div className="inline-block px-4 py-1.5 mb-6 text-[10px] font-black uppercase tracking-widest rounded bg-white shadow-sm" style={{ color: themeColor }}><Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} /></div>}
            <div className="text-slate-600 text-[16px] leading-relaxed space-y-4 text-left">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} />)}
            </div>
            {renderTestimonials("p-4 bg-white rounded-lg shadow-sm text-left border-l-4", "font-bold text-[15px] text-slate-900 mb-1", "text-[14px] text-slate-600 italic")}
            {hasOffer && <div className="p-4 bg-slate-200 rounded-lg font-bold text-lg my-6 text-slate-900">{offerRaw}</div>}
            {cta && <button className="w-full py-4 rounded-xl font-bold text-sm text-white mt-4 shadow-lg hover:scale-105 transition-transform" style={{ backgroundColor: themeColor }}><Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} /></button>}
            {footerInfo && <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="mt-8 text-xs text-slate-400" />}
         </div>
      </div>
    );
  } else {
    // centered
    content = (
      <div id="email-export-node" className="rounded-xl shadow-2xl overflow-hidden font-sans" style={{ backgroundColor: themeColor }}>
        <div className="w-full text-center py-8 pb-6">
          <Editable as="h1" value={brandName} onChange={(v) => onChange({ brandName: v })} className="text-white font-extrabold italic text-2xl tracking-wide drop-shadow-sm" />
        </div>
        <div className="relative px-8 pb-10 text-center">
            {heroBadge && (
              <div className="inline-block px-4 py-1 rounded-full mb-5 text-[10px] font-black uppercase tracking-widest bg-white/15 text-white backdrop-blur-sm">
                <Editable as="span" value={heroBadge} onChange={(v) => onChange({ heroBadge: v })} />
              </div>
            )}
            <Editable as="h2" value={title} onChange={(v) => onChange({ subtitle: v })} className="text-white font-black text-3xl md:text-4xl leading-tight mb-8 drop-shadow-md" />
            {cta && (
              <button className="px-8 py-3.5 rounded-full font-bold text-sm transition-transform hover:scale-105 shadow-xl bg-[#86efac]" style={{ color: themeColor }}>
                 <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
              </button>
            )}
            {renderImage("mt-10 h-48 md:h-64 rounded-xl border-2 border-white/20 shadow-2xl")}
        </div>
        <div className="bg-[#fffbf5] rounded-t-[32px] px-8 py-12 text-center shadow-[0_-10px_20px_rgba(0,0,0,0.1)] relative z-10">
            <div className="text-slate-800 text-[16px] leading-relaxed space-y-4">
               {paragraphs.map((p, i) => <Editable key={i} as="p" multiline value={p} onChange={(v) => { const n = [...paragraphs]; n[i] = v; onChange({ body: n.join('\n') }); }} className={i === 0 ? "font-bold text-xl text-slate-900 mb-6" : ""} />)}
            </div>
            {renderTestimonials("p-5 border-2 rounded-xl bg-white shadow-sm text-left", "font-bold text-[15px] text-slate-900 mb-1", "text-[14px] text-slate-600 italic")}
            {hasOffer && <div className="mt-8 rounded-xl p-4 font-bold text-lg shadow-sm bg-[#86efac]" style={{ color: themeColor }}>{offerRaw}</div>}
            {cta && (
              <div className="mt-8">
                <button className="px-8 py-3.5 rounded-full font-bold text-sm transition-transform hover:scale-105 shadow-lg bg-[#86efac]" style={{ color: themeColor }}>
                  <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} />
                </button>
              </div>
            )}
            {footerInfo && (
              <div className="mt-8">
                <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className="text-[11px] text-slate-500 underline cursor-pointer" />
              </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col space-y-4" data-testid="email-preview">
      {content}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          Peça: <span className="px-2 py-1 rounded bg-brand/10 text-brand">E-MAIL ({layoutStyle.toUpperCase()})</span>
        </div>
        <div className="flex gap-2">
          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleFileChange} />
          <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Foto
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs font-bold" onClick={handleRegenerate}>
            <RefreshCw className="mr-1.5 size-3.5" /> Gerar IA
          </Button>
        </div>
      </div>
    </div>
  );
}