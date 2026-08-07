// src/components/briefflow/SocialPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import {
  Loader2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal,
  AlertCircle, Upload, RefreshCw, Hexagon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { cleanText } from "@/lib/sanitize";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function SocialPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { builder } = useBriefflowStore();

  const prompt = state.imagePrompt || "";
  const isProductImage = !!state.productImageUrl;
  const themeColor = state.themeColor || "#2563EB";
  const secondaryColor = state.secondaryColor || "#F472B6";
  const brandName = cleanText(state.brandName, "Sua Marca");

  const offerStr = builder.discoveryPlan?.offer;
  const hasOffer = Boolean(
    offerStr && offerStr !== "null" && offerStr.trim() !== "" && offerStr.toLowerCase() !== "nenhum",
  );

  const images = Array.from(
    new Set([
      ...(state.productImageUrl ? [state.productImageUrl] : []),
      ...(state.productImages || []),
    ]),
  );

  const url = useMemo(() => {
    if (!prompt) return null;
    return useFallback
      ? buildFallbackUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed })
      : buildPollinationsUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed });
  }, [prompt, state.imageSeed, useFallback]);

  useEffect(() => {
    if (!url) return;
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
    e.target.value = "";
  };

  const handleRegenerate = () => {
    setImageStatus("loading");
    setUseFallback(false);
    onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
  };

  const caption = state.caption ?? "Legenda do post...";
  const captionParts = caption.split(/(#\w+)/g);

  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col space-y-3" data-testid="social-preview">
      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#09090b]">
        {/* HEADER DO POST */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className="relative size-10 shrink-0 rounded-full p-[2px] shadow-sm"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${secondaryColor})` }}
            >
              <div className="flex size-full items-center justify-center rounded-full bg-white dark:bg-[#09090b]">
                <Hexagon className="size-4" style={{ color: themeColor }} />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                {brandName}
              </span>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="text-[11px] font-medium text-slate-500">Patrocinado</span>
                <span className="text-slate-400">•</span>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: themeColor }}>
                  Seguir
                </span>
              </div>
            </div>
          </div>
          <MoreHorizontal className="size-5 text-slate-400 dark:text-slate-500" />
        </div>

        {/* ÁREA DA ARTE VISUAL */}
        <div className="relative aspect-[4/5] w-full overflow-hidden border-y border-slate-100 dark:border-slate-900 flex items-center justify-center bg-[#060609]">
          {hasOffer && (
            <div
              className="absolute right-3 top-3 z-50 rotate-[8deg] rounded-full border-2 border-white px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-xl dark:border-slate-900"
              style={{ background: "linear-gradient(135deg, #e11d48, #fb7185)" }}
            >
              <Editable as="span" value="OFERTA ESPECIAL" onChange={() => {}} className="pointer-events-none" />
            </div>
          )}

          {url ? (
            <>
              {imageStatus === "loading" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#060609]/60 backdrop-blur-sm">
                  <Loader2 className="size-8 animate-spin text-white/40" />
                </div>
              )}
              {imageStatus === "error" ? (
                <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-slate-900">
                  <AlertCircle className="mb-2 size-8 text-slate-500" />
                  <span className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Recurso Visual<br />Indisponível
                  </span>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 z-0 blur-3xl" style={{ backgroundColor: `${themeColor}30` }} />
                  <img
                    src={url}
                    alt="Post visual"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    className={cn(
                      "absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-700",
                      imageStatus === "loading" ? "opacity-0" : "opacity-100",
                    )}
                  />
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 px-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-white/10" style={{ backgroundColor: `${themeColor}20` }}>
                <Hexagon className="size-6" style={{ color: `${themeColor}80` }} />
              </div>
              <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Arte gerada aqui</p>
            </div>
          )}
          
          {images.map((src, i) => (
            <DraggableImage key={`${src}-${i}`} src={src} />
          ))}

          {imageStatus === "loaded" && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-16 bg-gradient-to-t from-black/20 to-transparent" />
          )}
        </div>

        {/* BARRA DE AÇÕES */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setLiked((v) => !v)} className="transition-transform active:scale-90">
              <Heart className={cn("size-6 transition-colors", liked ? "fill-rose-500 text-rose-500" : "text-slate-900 dark:text-white")} />
            </button>
            <button type="button"><MessageCircle className="size-6 text-slate-900 dark:text-white" /></button>
            <button type="button"><Send className="size-6 -rotate-12 text-slate-900 dark:text-white" /></button>
          </div>
          <button type="button" onClick={() => setSaved((v) => !v)} className="transition-transform active:scale-90">
            <Bookmark className={cn("size-6 transition-colors", saved ? "fill-slate-900 text-slate-900 dark:fill-white dark:text-white" : "text-slate-900 dark:text-white")} />
          </button>
        </div>

        {/* LEGENDA E HASHTAGS */}
        <div className="px-4 pb-5">
          <p className="mb-2 text-[13px] font-bold text-slate-900 dark:text-white">
            {liked ? "1.246" : "1.245"} curtidas
          </p>
          <div className="text-[14px] leading-[1.65] text-slate-800 dark:text-slate-200">
            <span className="mr-1.5 font-bold">{brandName}</span>
            <Editable as="span" multiline value={caption} onChange={(v) => onChange({ caption: v })} className="inline whitespace-pre-wrap break-words font-normal" />
          </div>
          {captionParts.some((p) => p.startsWith("#")) && (
            <div className="mt-2 flex flex-wrap gap-x-1 gap-y-0.5">
              {captionParts.filter((p) => p.startsWith("#")).map((tag, i) => (
                <span key={i} className="text-[13px] font-medium opacity-75" style={{ color: themeColor }}>{tag}</span>
              ))}
            </div>
          )}
          <button type="button" className="mt-2 text-[13px] font-medium text-slate-400 dark:text-slate-600">Ver todos os 38 comentários</button>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-slate-300 dark:text-slate-700">Há 2 horas</p>
        </div>
      </div>

      {/* BARRA DE CONTROLE LIMPA - SEM BOTÃO DE EXPORTAR AQUI */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3 opacity-80 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Peça: <span style={{ color: themeColor }} className="mr-3">POST SOCIAL</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleFileChange} />
          <Button size="sm" variant="outline" className="h-8 shrink-0 border-border-strong bg-surface-2 text-xs font-bold" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Upload
          </Button>
          <Button size="sm" variant="ghost" className="h-8 shrink-0 text-xs font-bold" onClick={handleRegenerate}>
            <RefreshCw className="mr-1.5 size-3.5" /> Gerar IA
          </Button>
        </div>
      </div>
    </div>
  );
}