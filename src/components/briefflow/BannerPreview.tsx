// src/components/briefflow/BannerPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { RefreshCw, Loader2, AlertCircle, ArrowUpRight, Sparkles, Hexagon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function BannerPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const prompt = state.imagePrompt || "";
  const isProductImage = !!state.productImageUrl;
  const themeColor = state.themeColor || "#2563EB"; 
  const secondaryColor = state.secondaryColor || "#FF5722"; 
  const layoutStyle = state.layoutStyle || "split"; 

  const rawCta = state.cta || "Saiba Mais";
  const cleanCta = rawCta.replace(/\[|\]|\*/g, '').replace(/nenhum/i, '').trim();

  const url = useMemo(() => {
      if (state.productImageUrl) return state.productImageUrl;
      return prompt ? useFallback 
          ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed }) 
          : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed }) 
        : null;
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
      productImageUrl: null 
    });
  };

  const ImageLayer = ({ className }: { className: string }) => {
    if (imageStatus === "error") {
      return (
        <div className={cn("flex flex-col items-center justify-center bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-sm border border-dashed border-slate-500/30", className)}>
          <AlertCircle className="size-8 text-slate-400 mb-2" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
            Recurso Visual<br/>Indisponível
          </span>
        </div>
      );
    }
    return (
      <img
        src={url!}
        alt="Banner Visual"
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={cn(className, imageStatus === "loading" ? "opacity-0" : "opacity-100 transition-opacity duration-700")}
      />
    );
  };

  const BrandHeader = ({ dark = false }: { dark?: boolean }) => (
    <div className={cn("absolute top-6 left-6 md:top-8 md:left-10 z-30 flex items-center gap-2", dark ? "text-slate-900" : "text-white")}>
      <div className={cn("size-8 rounded-lg flex items-center justify-center shadow-lg", dark ? "bg-slate-900 text-white" : "bg-white text-slate-900")}>
        <Hexagon className="size-5 fill-current" />
      </div>
      <span className="font-black tracking-widest uppercase text-sm drop-shadow-md">{state.brandName || "MARCA"}</span>
    </div>
  );

  const renderLayout = () => {
    switch (layoutStyle) {
      case "minimalist":
        return (
          <div className="relative flex aspect-[21/9] md:aspect-[2.5/1] min-h-[360px] w-full shrink-0 overflow-hidden rounded-[24px] bg-slate-50 shadow-xl ring-1 ring-black/5">
            <BrandHeader dark />
            <div className="absolute right-0 top-0 bottom-0 w-[55%] bg-gradient-to-l from-slate-200/50 to-transparent z-0" />
            <ImageLayer className={`absolute right-0 inset-y-0 h-full w-[50%] z-10 ${isProductImage ? "object-contain mix-blend-multiply p-8" : "object-cover rounded-l-3xl my-4 shadow-2xl"}`} />
            <div className="relative z-20 flex h-full w-full md:w-[55%] flex-col justify-center px-10 md:px-14 mt-6">
              <Editable as="h2" value={state.title ?? "Título"} onChange={(v) => onChange({ title: v })} className="text-slate-900 text-[32px] md:text-[46px] font-black tracking-tighter mb-3 leading-[1.05]" />
              <Editable as="p" value={state.subtitle ?? "Subtítulo"} onChange={(v) => onChange({ subtitle: v })} className="text-slate-600 text-[15px] md:text-[17px] font-medium max-w-md mb-8" />
              {state.cta && (
                <div className="w-fit px-8 py-4 rounded-xl font-bold uppercase tracking-widest shadow-xl hover:scale-105 transition-transform text-white" style={{ backgroundColor: secondaryColor }}>
                  <Editable as="span" value={cleanCta} onChange={(v) => onChange({ cta: v })} />
                </div>
              )}
            </div>
          </div>
        );
      case "diagonal":
        return (
          <div className="relative flex aspect-[21/9] md:aspect-[2.5/1] min-h-[360px] w-full shrink-0 overflow-hidden rounded-[24px] bg-slate-900 shadow-2xl">
            <BrandHeader />
            <ImageLayer className={`absolute right-0 inset-y-0 h-full w-full md:w-[65%] z-0 ${isProductImage ? "object-contain p-8 mix-blend-lighten opacity-90" : "object-cover opacity-80"}`} />
            <div className="absolute inset-y-0 left-0 z-10 w-full md:w-[65%] shadow-2xl" style={{ backgroundColor: themeColor, clipPath: "polygon(0 0, 100% 0, 80% 100%, 0 100%)" }} />
            <div className="relative z-20 flex h-full w-full md:w-[55%] flex-col justify-center px-10 md:px-14 py-8 mt-6">
              <Editable as="h2" value={state.title ?? "Título"} onChange={(v) => onChange({ title: v })} className="text-white text-[32px] md:text-[44px] font-black leading-[1.05] tracking-tight mb-4 drop-shadow-md" />
              {state.subtitle && <Editable as="p" value={state.subtitle} onChange={(v) => onChange({ subtitle: v })} className="text-white/90 text-[15px] md:text-[16px] font-medium leading-relaxed mb-8 drop-shadow-sm" />}
              {state.cta && (
                <div className="w-fit px-7 py-3.5 rounded-lg text-slate-900 font-black uppercase tracking-widest shadow-2xl flex items-center gap-3 transition-transform hover:scale-105 bg-white">
                  <Editable as="span" value={cleanCta} onChange={(v) => onChange({ cta: v })} />
                  <ArrowUpRight className="size-5" strokeWidth={3} />
                </div>
              )}
            </div>
          </div>
        );
      case "centered":
      case "split":
      default:
        return (
          <div className="relative flex aspect-[21/9] md:aspect-[2.5/1] min-h-[360px] w-full shrink-0 overflow-hidden rounded-[24px] bg-[#f0f4f9] shadow-2xl flex-row">
            <BrandHeader />
            <div className="relative z-20 flex h-full w-[50%] flex-col justify-center px-10 md:px-14 py-8" style={{ backgroundColor: themeColor }}>
              <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-md mt-6">
                <Sparkles className="size-3 text-white" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Lançamento</span>
              </div>
              <Editable as="h2" value={state.title ?? "Título"} onChange={(v) => onChange({ title: v })} className="text-white text-[28px] md:text-[40px] font-black leading-tight tracking-tight mb-4" />
              {state.subtitle && <Editable as="p" value={state.subtitle} onChange={(v) => onChange({ subtitle: v })} className="text-white/80 text-[14px] md:text-[15px] font-medium leading-relaxed mb-8" />}
              {state.cta && (
                <div className="w-fit px-8 py-3.5 bg-white rounded-md font-black uppercase tracking-widest shadow-xl transition-transform hover:scale-105" style={{ color: themeColor }}>
                  <Editable as="span" value={cleanCta} onChange={(v) => onChange({ cta: v })} />
                </div>
              )}
            </div>
            <div className="relative z-10 w-[50%] h-full bg-slate-900">
              <ImageLayer className={`h-full w-full ${isProductImage ? "object-contain mix-blend-screen p-6 opacity-90" : "object-cover opacity-90"}`} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col space-y-4">
      <div className="relative">
        {imageStatus === "loading" && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-[24px]">
            <Loader2 className="size-10 animate-spin text-white" />
          </div>
        )}
        {renderLayout()}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
          Estilo: <span style={{ color: themeColor }} className="mr-3">{layoutStyle}</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleFileChange} />
          <Button size="sm" variant="outline" className="h-8 text-xs shrink-0 font-bold border-border-strong bg-surface-2" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 size-3.5" /> Importar
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0 font-bold" onClick={handleRegenerate}>
            <RefreshCw className="mr-2 size-3.5" /> Gerar IA
          </Button>
        </div>
      </div>
    </div>
  );
}