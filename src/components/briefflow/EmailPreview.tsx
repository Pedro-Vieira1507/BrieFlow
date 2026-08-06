// src/components/briefflow/EmailPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ChevronRight, ShieldCheck, CheckCircle2, TicketPercent, Hexagon, Upload, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function EmailPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { builder } = useBriefflowStore();

  const rawCta = state.cta || "Comprar Agora";
  const cleanCta = rawCta.replace(/\[|\]|\*/g, '').replace(/nenhum/i, '').trim();

  const paragraphs = (state.body ?? "")
    .split('\n')
    .map(p => {
      let clean = p;
      clean = clean.replace(/\*\*/g, '');
      clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      clean = clean.replace(/\[|\]/g, ''); 
      clean = clean.replace(/<[^>]+>/g, '');
      return clean.trim();
    })
    .filter(p => p !== "")
    .filter(p => {
      const lowerP = p.toLowerCase();
      const lowerCta = cleanCta.toLowerCase();
      if (lowerP === lowerCta) return false;
      if (lowerP.replace(/nenhum/g, '').trim() === lowerCta) return false;
      if (lowerCta && lowerP.includes(lowerCta) && lowerP.length <= lowerCta.length + 10) return false;
      return true;
    });

  const prompt = state.emailHeroImagePrompt || "";
  const isProductImage = !!state.productImageUrl;
  const themeColor = state.themeColor || "#2563EB";

  const offerStr = builder.discoveryPlan?.offer;
  const hasOffer = Boolean(offerStr && offerStr !== "null" && offerStr.trim() !== "" && offerStr.toLowerCase() !== "nenhum");
  const couponCode = hasOffer ? offerStr!.toUpperCase() : null;

  const images = Array.from(new Set([
    ...(state.productImageUrl ? [state.productImageUrl] : []),
    ...(state.productImages || [])
  ]));

  const heroUrl = useMemo(
    () => {
      return prompt ? useFallback 
           ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed }) 
           : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed }) 
         : null;
    }, [prompt, state.imageSeed, useFallback]
  );

  useEffect(() => { 
    if (heroUrl) { 
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
    } 
  }, [heroUrl, useFallback, isProductImage]);

  const handleImageError = () => {
    if (!useFallback && !isProductImage) setUseFallback(true);
    else setImageStatus("error");
  };

  const handleImageLoad = () => setImageStatus("loaded");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({ productImageUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRegenerate = () => {
    setImageStatus("loading");
    setUseFallback(false);
    onChange({ 
      imageSeed: Math.floor(Math.random() * 1_000_000),
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col space-y-4">
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#09090b]">
        
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
          <div className="flex gap-2">
            <div className="size-3 rounded-full bg-red-400" />
            <div className="size-3 rounded-full bg-amber-400" />
            <div className="size-3 rounded-full bg-emerald-400" />
          </div>
          <p className="ml-4 text-[13px] text-slate-500 font-medium truncate flex-1 text-center">
            Assunto: <span className="text-slate-900 dark:text-slate-200 font-bold">{state.title}</span>
          </p>
        </div>

        <div className="p-4 md:p-8 bg-slate-50 dark:bg-[#030304]">
          <div className="bg-white dark:bg-[#0c0c0e] rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 overflow-hidden">
            
            <div className="flex items-center justify-center px-8 py-5 bg-white dark:bg-[#0c0c0e] border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Hexagon className="size-6" style={{ color: themeColor }} />
                <span className="text-lg font-black tracking-[0.1em] text-slate-900 dark:text-white uppercase">{state.brandName || "SUA MARCA"}</span>
              </div>
            </div>

            {heroUrl ? (
              <div className="relative aspect-[2.2/1] w-full bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                {imageStatus === "loading" && <div className="absolute inset-0 flex items-center justify-center z-10"><Loader2 className="size-8 animate-spin text-slate-400" /></div>}
                
                {imageStatus === "error" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/50 dark:bg-slate-800/50 border-y border-dashed border-slate-500/30 z-0">
                    <AlertCircle className="size-8 text-slate-400 mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Falha ao carregar capa</span>
                  </div>
                ) : (
                  <img src={heroUrl} alt="Hero" onLoad={handleImageLoad} onError={handleImageError} 
                    className={`absolute inset-0 z-0 h-full w-full object-cover ${imageStatus === 'loading' ? 'opacity-0' : 'opacity-100 transition-opacity duration-700'}`} />
                )}

                {/* IMAGENS ARRASTÁVEIS NO EMAIL */}
                {images.map((src, i) => (
                   <DraggableImage key={i} src={src} />
                ))}
              </div>
            ) : null}

            <div className="px-6 py-10 md:px-12">
              <Editable as="h1" value={state.title ?? "Título do E-mail"} onChange={(v) => onChange({ title: v })} className="text-balance font-display text-2xl font-black leading-tight tracking-tight text-slate-900 dark:text-white mb-8 text-center" />
              
              <div className="space-y-4">
                {paragraphs.map((p, i) => {
                  const isBullet = /^[- *]\s/.test(p.trim());
                  if (isBullet) {
                    return (
                      <div key={i} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                        <Editable as="p" multiline value={p.replace(/^[- *]\s/, '')} 
                          onChange={(v) => { const next = [...paragraphs]; next[i] = `- ${v}`; onChange({ body: next.join("\n") }); }} 
                          className="text-[15px] leading-relaxed font-medium text-slate-700 dark:text-slate-300" />
                      </div>
                    );
                  }
                  return (
                    <Editable key={i} as="p" multiline value={p} 
                      onChange={(v) => { const next = [...paragraphs]; next[i] = v; onChange({ body: next.join("\n") }); }} 
                      className="text-[16px] leading-[1.8] font-light text-slate-600 dark:text-slate-400 text-center" />
                  );
                })}
              </div>

              {couponCode && (
                <div className="mt-10 mb-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 relative">
                  <div className="absolute -top-3 bg-white dark:bg-[#0c0c0e] px-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <TicketPercent className="size-3.5" /> Desconto Exclusivo
                  </div>
                  <Editable as="span" value={couponCode} onChange={() => {}} className="text-xl font-black tracking-widest text-slate-900 dark:text-white mt-2" />
                </div>
              )}

              <div className="flex flex-col items-center gap-4 mt-8">
                <button className="group flex w-full max-w-sm items-center justify-center gap-3 rounded-xl px-8 py-4 text-[14px] font-bold uppercase tracking-widest text-white shadow-xl transition-all hover:scale-105" style={{ backgroundColor: themeColor }}>
                  <Editable as="span" value={cleanCta} onChange={(v) => onChange({ cta: v })} />
                  <ChevronRight className="size-4" strokeWidth={3} />
                </button>
                <div className="flex items-center gap-2 text-slate-400 mt-2">
                  <ShieldCheck className="size-4" />
                  <span className="text-[11px] font-medium uppercase tracking-widest">Ambiente Seguro</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
          Peça: <span style={{ color: themeColor }} className="mr-3">E-MAIL MARKETING</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleFileChange} />
          <Button size="sm" variant="outline" className="h-8 text-xs shrink-0 font-bold border-border-strong bg-surface-2" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 size-3.5" /> Upload Foto
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0 font-bold" onClick={handleRegenerate}>
            <RefreshCw className="mr-2 size-3.5" /> Gerar IA
          </Button>
        </div>
      </div>
    </div>
  );
}