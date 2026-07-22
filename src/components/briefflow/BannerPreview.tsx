import { useEffect, useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { RefreshCw, Loader2, AlertCircle, ArrowUpRight, Sparkles } from "lucide-react";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function BannerPreview({ state, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  
  const prompt = state.imagePrompt || "";
  const isProductImage = !!state.productImageUrl;

  const themeColor = state.themeColor || "#2563EB"; 
  const secondaryColor = state.secondaryColor || "#0B1B3D";
  const layoutStyle = state.layoutStyle || "split"; 

  const url = useMemo(() => {
      if (state.productImageUrl) return state.productImageUrl;
      return prompt ? useFallback
          ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed })
          : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed })
        : null;
    }, [state.productImageUrl, prompt, state.imageSeed, useFallback]
  );

  useEffect(() => { if (url) { setLoading(true); setError(false); } }, [url]);

  const handleImageError = () => {
    setLoading(false);
    if (!useFallback && !isProductImage) setUseFallback(true);
    else setError(true);
  };

  // ==========================================
  // RENDERIZAÇÃO DINÂMICA DE LAYOUTS
  // ==========================================
  
  const renderLayout = () => {
    switch (layoutStyle) {

      // LAYOUT: MINIMALIST (Clean, Apple-like)
      case "minimalist":
        return (
          <div className="relative flex aspect-[21/9] md:aspect-[2.5/1] min-h-[360px] w-full shrink-0 overflow-hidden rounded-[24px] bg-white shadow-xl ring-1 ring-black/5">
            <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-slate-100 to-transparent z-0" />
            <img src={url!} alt="Banner" onLoad={() => setLoading(false)} onError={handleImageError}
              className={`absolute right-10 inset-y-0 h-full w-[45%] z-10 ${isProductImage ? "object-contain mix-blend-multiply" : "object-cover rounded-2xl my-6"}`} />
            <div className="relative z-20 flex h-full w-full md:w-[55%] flex-col justify-center px-10 md:px-14">
              <Editable as="h2" value={state.title ?? "Título"} onChange={(v) => onChange({ title: v })} className="text-slate-900 text-[30px] md:text-[42px] font-bold tracking-tight mb-4 leading-tight" />
              {state.subtitle && <Editable as="p" value={state.subtitle} onChange={(v) => onChange({ subtitle: v })} className="text-slate-500 text-[15px] max-w-md mb-8" />}
              {state.cta && (
                <div className="w-fit px-8 py-3.5 rounded-full text-white font-semibold shadow-lg transition-transform hover:-translate-y-1" style={{ backgroundColor: themeColor }}>
                  <Editable as="span" value={state.cta} onChange={(v) => onChange({ cta: v })} />
                </div>
              )}
            </div>
          </div>
        );

      // LAYOUT: CENTERED (Cinematic - Refinado para ser elegante)
      case "centered":
        return (
          <div className="relative flex aspect-[21/9] md:aspect-[2.5/1] min-h-[360px] w-full shrink-0 overflow-hidden rounded-[24px] bg-[#050508] shadow-2xl flex-col items-center justify-center text-center">
            <img src={url!} alt="Banner" onLoad={() => setLoading(false)} onError={handleImageError}
              className={`absolute inset-0 h-full w-full z-0 ${isProductImage ? "object-contain opacity-40 blur-sm mix-blend-lighten" : "object-cover opacity-60 mix-blend-overlay"}`} />
            
            {/* Gradiente escuro garantindo contraste perfeito */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/80 to-[#050508]/40 z-10" />
            
            <div className="relative z-20 flex flex-col items-center px-8 md:px-16 mt-6">
              <Editable as="h2" value={state.title ?? "Título"} onChange={(v) => onChange({ title: v })} className="text-white text-[28px] md:text-[44px] font-black tracking-tight mb-4 max-w-3xl leading-[1.1] drop-shadow-xl" />
              {state.subtitle && <Editable as="p" value={state.subtitle} onChange={(v) => onChange({ subtitle: v })} className="text-white/90 text-[15px] md:text-[17px] max-w-2xl mb-8 font-medium drop-shadow-md" />}
              {state.cta && (
                <div className="w-fit px-10 py-3.5 rounded-full text-white font-bold uppercase tracking-widest shadow-2xl transition-all hover:scale-105 border border-white/10" style={{ backgroundColor: themeColor }}>
                  <Editable as="span" value={state.cta} onChange={(v) => onChange({ cta: v })} />
                </div>
              )}
            </div>
          </div>
        );

      // LAYOUT: DIAGONAL (Bold, Agressive)
      case "diagonal":
        return (
          <div className="relative flex aspect-[21/9] md:aspect-[2.5/1] min-h-[360px] w-full shrink-0 overflow-hidden rounded-[24px] bg-slate-100 shadow-2xl">
            <img src={url!} alt="Banner" onLoad={() => setLoading(false)} onError={handleImageError}
              className={`absolute right-0 inset-y-0 h-full w-full md:w-[60%] z-0 ${isProductImage ? "object-contain p-8 mix-blend-multiply" : "object-cover"}`} />
            <div className="absolute inset-y-0 left-0 z-10 w-full md:w-[65%]" style={{ backgroundColor: themeColor, clipPath: "polygon(0 0, 100% 0, 85% 100%, 0 100%)" }} />
            <div className="relative z-20 flex h-full w-full md:w-[55%] flex-col justify-center px-10 md:px-14 py-8">
              <Editable as="h2" value={state.title ?? "Título"} onChange={(v) => onChange({ title: v })} className="text-white text-[30px] md:text-[40px] font-black leading-[1.05] tracking-tight mb-4" />
              {state.subtitle && <Editable as="p" value={state.subtitle} onChange={(v) => onChange({ subtitle: v })} className="text-white/90 text-[14px] md:text-[15px] font-medium leading-relaxed mb-6" />}
              {state.cta && (
                <div className="w-fit px-6 py-3 rounded-lg text-white font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-transform hover:scale-105" style={{ backgroundColor: secondaryColor }}>
                  <Editable as="span" value={state.cta} onChange={(v) => onChange({ cta: v })} />
                  <ArrowUpRight className="size-5" strokeWidth={3} />
                </div>
              )}
            </div>
          </div>
        );

      // LAYOUT: SPLIT (50/50 Classic Premium)
      case "split":
      default:
        return (
          <div className="relative flex aspect-[21/9] md:aspect-[2.5/1] min-h-[360px] w-full shrink-0 overflow-hidden rounded-[24px] bg-[#f0f4f9] shadow-2xl flex-row">
            <div className="relative z-20 flex h-full w-[50%] flex-col justify-center px-10 md:px-14 py-8" style={{ backgroundColor: themeColor }}>
              <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-md">
                <Sparkles className="size-3 text-white" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Destaque</span>
              </div>
              <Editable as="h2" value={state.title ?? "Título"} onChange={(v) => onChange({ title: v })} className="text-white text-[28px] md:text-[38px] font-black leading-tight tracking-tight mb-4" />
              {state.subtitle && <Editable as="p" value={state.subtitle} onChange={(v) => onChange({ subtitle: v })} className="text-white/80 text-[14px] leading-relaxed mb-8" />}
              {state.cta && (
                <div className="w-fit px-8 py-3.5 bg-white rounded-md font-bold uppercase tracking-widest shadow-lg transition-transform hover:-translate-y-1" style={{ color: themeColor }}>
                  <Editable as="span" value={state.cta} onChange={(v) => onChange({ cta: v })} />
                </div>
              )}
            </div>
            <div className="relative z-10 w-[50%] h-full bg-[#f0f4f9]">
              <img src={url!} alt="Banner" onLoad={() => setLoading(false)} onError={handleImageError}
                className={`h-full w-full ${isProductImage ? "object-contain mix-blend-multiply p-6" : "object-cover"}`} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col space-y-4">
      {/* Exibe o layout que a IA escolheu */}
      {url && !error ? (
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-[24px]">
              <Loader2 className="size-10 animate-spin text-white" />
            </div>
          )}
          {renderLayout()}
        </div>
      ) : error ? (
        <div className="flex aspect-[2.5/1] min-h-[360px] w-full flex-col items-center justify-center gap-3 text-slate-500 bg-slate-100 rounded-[24px]">
          <AlertCircle className="size-10 text-slate-400" />
          <span className="text-sm font-semibold">Falha ao carregar recurso visual.</span>
        </div>
      ) : (
        <div className="flex aspect-[2.5/1] min-h-[360px] w-full items-center justify-center text-sm font-bold uppercase tracking-widest text-slate-400 bg-slate-100 rounded-[24px]">
          Aguardando AI Art Director...
        </div>
      )}

      {/* BARRA DE DIREÇÃO DE ARTE */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
          Estilo: <span style={{ color: themeColor }} className="mr-3">{layoutStyle}</span>
          Prompt: <span className="text-foreground lowercase normal-case font-medium opacity-80">{state.imagePrompt}</span>
        </div>
        {!isProductImage && (
          <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0 font-bold" onClick={() => { setLoading(true); setError(false); setUseFallback(false); onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) }); }}>
            <RefreshCw className="mr-2 size-3.5" /> Nova Variante
          </Button>
        )}
      </div>
    </div>
  );
}