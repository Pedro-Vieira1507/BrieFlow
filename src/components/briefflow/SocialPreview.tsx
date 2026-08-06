// src/components/briefflow/SocialPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Loader2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, AlertCircle, Upload, RefreshCw } from "lucide-react";
import { useBriefflowStore } from "@/store/briefflow";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function SocialPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { builder } = useBriefflowStore();

  const prompt = state.imagePrompt || "";
  const isProductImage = !!state.productImageUrl;
  const themeColor = state.themeColor || "#2563EB";

  const offerStr = builder.discoveryPlan?.offer;
  const hasOffer = Boolean(offerStr && offerStr !== "null" && offerStr.trim() !== "" && offerStr.toLowerCase() !== "nenhum");

  const images = Array.from(new Set([
    ...(state.productImageUrl ? [state.productImageUrl] : []),
    ...(state.productImages || [])
  ]));

  const url = useMemo(() => {
    return prompt ? useFallback ? buildFallbackUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed }) : buildPollinationsUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed }) : null;
  }, [prompt, state.imageSeed, useFallback]);

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
      }, 5000);
      return () => clearTimeout(timer);
    } 
  }, [url, useFallback, isProductImage]);

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
    <div className="mx-auto flex w-full max-w-[420px] flex-col space-y-4">
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
        <div className="relative aspect-[4/5] w-full bg-[#050508] border-y border-slate-100 dark:border-slate-900 overflow-hidden flex items-center justify-center">
          
          {hasOffer && (
            <div className="absolute top-4 right-4 z-50 rotate-12 bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-xl border-2 border-white dark:border-slate-900">
              <Editable as="span" value="OFERTA ESPECIAL" onChange={() => {}} />
            </div>
          )}

          {url ? (
            <>
              {imageStatus === "loading" && <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#050508]/40"><Loader2 className="size-8 animate-spin text-white/50" /></div>}
              
              {imageStatus === "error" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-0 border-y border-dashed border-slate-500/30">
                  <AlertCircle className="size-8 text-slate-500 mb-2" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center">Recurso Visual<br/>Indisponível</span>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 opacity-20 blur-3xl z-0" style={{ backgroundColor: themeColor }} />
                  <img src={url} alt="Post" onLoad={handleImageLoad} onError={handleImageError} 
                    className={`absolute inset-0 z-0 h-full w-full object-cover ${imageStatus === 'loading' ? 'opacity-0' : 'opacity-100 transition-opacity duration-700'}`} />
                </>
              )}
            </>
          ) : null}

          {/* IMAGENS ARRASTÁVEIS NO POST */}
          {images.map((src, i) => (
              <DraggableImage key={i} src={src} />
          ))}

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

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
          Peça: <span style={{ color: themeColor }} className="mr-3">POST SOCIAL</span>
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