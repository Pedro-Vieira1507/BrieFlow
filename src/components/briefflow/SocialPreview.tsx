// src/components/briefflow/SocialPreview.tsx
import { useEffect, useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Loader2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, AlertCircle } from "lucide-react";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function SocialPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);

  const prompt = state.imagePrompt || "";
  const isProductImage = !!state.productImageUrl;
  const themeColor = state.themeColor || "#2563EB";

  const url = useMemo(() => {
      if (state.productImageUrl) return state.productImageUrl;
      return prompt ? useFallback ? buildFallbackUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed }) : buildPollinationsUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed }) : null;
    }, [state.productImageUrl, prompt, state.imageSeed, useFallback]
  );

  useEffect(() => { 
    if (url) { 
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
  }, [url, useFallback, isProductImage]);

  const handleImageError = () => {
    if (!useFallback && !isProductImage) setUseFallback(true);
    else setImageStatus("error");
  };

  const handleImageLoad = () => setImageStatus("loaded");

  return (
    <div className="mx-auto max-w-[420px]">
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-black">
        
        {/* HEADER POST */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3.5">
            <div className="size-9 rounded-full flex items-center justify-center p-[2px]" style={{ background: `linear-gradient(to right, ${themeColor}, #f472b6)` }}>
              <div className="size-full rounded-full bg-white dark:bg-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-slate-900 dark:text-white tracking-tight">{state.brandName || "Sua Marca"}</span>
              <span className="text-[11px] font-medium text-slate-500">Patrocinado</span>
            </div>
          </div>
          <MoreHorizontal className="size-5 text-slate-500" />
        </div>

        {/* IMAGEM AREA */}
        <div className="relative aspect-[4/5] w-full bg-[#050508] border-y border-slate-100 dark:border-slate-900 overflow-hidden">
          {/* BADGE DE OFERTA FLUTUANTE */}
          <div className="absolute top-4 right-4 z-30 rotate-12 bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-xl border-2 border-white dark:border-slate-900">
            <Editable as="span" value="OFERTA ESPECIAL" onChange={() => {}} />
          </div>

          {url ? (
            <>
              {imageStatus === "loading" && <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#050508]/40"><Loader2 className="size-8 animate-spin text-white/50" /></div>}
              
              {imageStatus === "error" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 border-y border-dashed border-slate-500/30">
                  <AlertCircle className="size-8 text-slate-500 mb-2" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center">Recurso Visual<br/>Indisponível</span>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 opacity-20 blur-3xl z-0" style={{ backgroundColor: themeColor }} />
                  <img src={url} alt="Post" onLoad={handleImageLoad} onError={handleImageError}
                    className={`h-full w-full z-10 relative ${isProductImage ? "object-contain p-10 bg-white mix-blend-multiply" : "object-cover"} ${imageStatus === 'loading' ? 'opacity-0' : 'opacity-100 transition-opacity duration-700'}`} />
                </>
              )}
            </>
          ) : null}
        </div>

        {/* AÇÕES E LEGENDA */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-4.5">
            <Heart className="size-7 text-slate-900 dark:text-white" />
            <MessageCircle className="size-7 text-slate-900 dark:text-white" />
            <Send className="size-7 text-slate-900 dark:text-white" />
          </div>
          <Bookmark className="size-7 text-slate-900 dark:text-white" />
        </div>

        <div className="px-5 pb-6">
          <p className="text-[13px] font-bold mb-2 text-slate-900 dark:text-white">1.245 curtidas</p>
          <div className="text-[14px] text-slate-800 dark:text-slate-200">
            <span className="font-bold mr-2">{state.brandName || "Sua Marca"}</span>
            <Editable as="p" multiline value={state.caption ?? "Legenda..."} onChange={(v) => onChange({ caption: v })} className="inline leading-[1.6] whitespace-pre-wrap break-words font-light" />
          </div>
        </div>

      </div>
    </div>
  );
}