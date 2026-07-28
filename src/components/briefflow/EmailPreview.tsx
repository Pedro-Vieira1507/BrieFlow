// src/components/briefflow/EmailPreview.tsx
import { useEffect, useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Loader2, AlertCircle, ChevronRight, ShieldCheck } from "lucide-react";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function EmailPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);

  const paragraphs = (state.body ?? "").split(/\n\n+/).filter(Boolean);
  const prompt = state.emailHeroImagePrompt || "";
  const isProductImage = !!state.productImageUrl;
  const themeColor = state.themeColor || "#2563EB";

  const heroUrl = useMemo(
    () => {
      if (state.productImageUrl) return state.productImageUrl;
      return prompt ? useFallback 
          ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed }) 
          : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed }) 
        : null;
    }, [state.productImageUrl, prompt, state.imageSeed, useFallback]
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
      }, 12000);
      return () => clearTimeout(timer);
    } 
  }, [heroUrl, useFallback, isProductImage]);

  const handleImageError = () => {
    if (!useFallback && !isProductImage) setUseFallback(true);
    else setImageStatus("error");
  };

  const handleImageLoad = () => setImageStatus("loaded");

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#09090b]">
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
          
          <div className="flex items-center justify-center px-8 py-6" style={{ backgroundColor: themeColor }}>
            <span className="text-base font-black tracking-[0.2em] text-white uppercase">{state.brandName || "SUA MARCA"}</span>
          </div>

          {heroUrl ? (
            <div className="relative aspect-[2.2/1] w-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
              {imageStatus === "loading" && <div className="absolute inset-0 flex items-center justify-center z-10"><Loader2 className="size-8 animate-spin text-slate-400" /></div>}
              {imageStatus === "error" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200/50 dark:bg-slate-800/50 border-y border-dashed border-slate-500/30">
                  <AlertCircle className="size-8 text-slate-400 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Falha ao carregar capa</span>
                </div>
              ) : (
                <img src={heroUrl} alt="Hero" onLoad={handleImageLoad} onError={handleImageError}
                  className={`h-full w-full ${isProductImage ? 'object-contain mix-blend-multiply bg-white p-8' : 'object-cover'} ${imageStatus === 'loading' ? 'opacity-0' : 'opacity-100 transition-opacity duration-700'}`} />
              )}
            </div>
          ) : null}

          <div className="px-8 py-10 md:px-12">
            <Editable as="h1" value={state.title ?? "Título Principal do E-mail"} onChange={(v) => onChange({ title: v })} className="text-balance font-display text-2xl font-black leading-tight tracking-tight text-slate-900 dark:text-white mb-6 text-center" />
            
            <div className="space-y-6">
              {paragraphs.map((p, i) => (
                <Editable key={i} as="p" multiline value={p} onChange={(v) => { const next = [...paragraphs]; next[i] = v; onChange({ body: next.join("\n\n") }); }} className="text-[15px] md:text-[16px] leading-[1.8] font-light text-slate-600 dark:text-slate-300 text-center" />
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center gap-4">
              <button className="group flex w-full max-w-sm items-center justify-center gap-3 rounded-xl px-8 py-4 text-[14px] font-bold uppercase tracking-widest text-white shadow-xl transition-all hover:scale-105" style={{ backgroundColor: themeColor }}>
                <Editable as="span" value={state.cta ?? "Finalizar Compra"} onChange={(v) => onChange({ cta: v })} />
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
  );
}