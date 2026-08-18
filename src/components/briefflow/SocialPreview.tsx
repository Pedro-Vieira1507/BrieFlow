// src/components/briefflow/SocialPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, 
  AlertCircle, Upload, RefreshCw, Hexagon, Trash2, ImagePlus, Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { cleanText } from "@/lib/sanitize";
import { analyzeImageWithVisionFn } from "@/lib/vision-api";
import { toast } from "sonner";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function SocialPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const [analyzingColors, setAnalyzingColors] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { builder } = useBriefflowStore();

  const prompt = state.imagePrompt || "";
  
  const hasImportedImage = !!state.productImageUrl;
  const isProductImage = hasImportedImage;
  const themeColor = state.themeColor || "#2563EB";
  const secondaryColor = state.secondaryColor || "#F472B6";
  const brandName = cleanText(state.brandName, "Sua Marca");

  const offerStr = builder.discoveryPlan?.offer;
  const hasOffer = Boolean(
    offerStr && offerStr !== "null" && offerStr.trim() !== "" && offerStr.toLowerCase() !== "nenhum",
  );

  const draggableImages = Array.from(new Set(state.productImages || []));

  const url = useMemo(() => {
    if (!prompt) return null;
    return useFallback
      ? buildFallbackUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed })
      : buildPollinationsUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed });
  }, [prompt, state.imageSeed, useFallback]);

  const activeHeroUrl = hasImportedImage ? state.productImageUrl : url;

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
          toast.success("Paleta do post harmonizada!", { id: toastId });
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

  const caption = state.caption ?? "Legenda do post...";

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col space-y-4" data-testid="social-preview">
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-[#000000] dark:shadow-none">
        
        {/* HEADER DO POST */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#000000]">
          <div className="flex items-center gap-3">
            <div 
              className="relative size-10 shrink-0 rounded-full p-[2px] shadow-sm transition-colors duration-500"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${secondaryColor})` }}
            >
              <div className="flex size-full items-center justify-center rounded-full bg-white dark:bg-[#000000]">
                <Hexagon className="size-4" style={{ color: themeColor }} />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100">
                  {brandName}
                </span>
                <div className="size-1 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                <span className="text-[12px] font-bold text-blue-600 dark:text-blue-500 cursor-pointer hover:text-blue-700">
                  Seguir
                </span>
              </div>
              <span className="text-[12px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">Patrocinado</span>
            </div>
          </div>
          <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors">
            <MoreHorizontal className="size-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* ÁREA DA ARTE VISUAL */}
        <div className="relative aspect-[4/5] w-full overflow-hidden border-y border-slate-100 dark:border-slate-900 flex items-center justify-center bg-[#060609] group/hero-img">
          {hasOffer && (
            <div 
              className="absolute right-4 top-4 z-50 rotate-[6deg] rounded-lg border-2 border-white/20 px-4 py-2 text-[12px] font-black uppercase tracking-widest text-white shadow-2xl backdrop-blur-md"
              style={{ background: `linear-gradient(135deg, ${themeColor}ee, ${secondaryColor}dd)` }}
            >
              <Editable as="span" value="OFERTA ESPECIAL" onChange={() => {}} className="pointer-events-none drop-shadow-md" />
            </div>
          )}

          {!activeHeroUrl && imageStatus !== "loading" && draggableImages.length === 0 ? (
            <div 
              className="absolute inset-0 z-[1] bg-slate-100/10 dark:bg-slate-900/50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100/20 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-10 text-slate-500 mb-3" />
              <p className="text-sm font-bold text-slate-400">Adicionar Imagem</p>
            </div>
          ) : (
            <>
              {!hasImportedImage && imageStatus === "loading" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#060609]/60 backdrop-blur-md">
                  <Loader2 className="size-8 animate-spin text-white/60" />
                </div>
              )}
              {!hasImportedImage && imageStatus === "error" ? (
                <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-slate-900">
                  <AlertCircle className="mb-3 size-8 text-slate-500" />
                  <span className="text-center text-[12px] font-bold uppercase tracking-widest text-slate-500">
                    Recurso Visual<br />Indisponível
                  </span>
                </div>
              ) : null}
              
              {!hasImportedImage && imageStatus !== "error" && url && (
                <>
                  <div className="absolute inset-0 z-0 blur-3xl transition-colors duration-500" style={{ backgroundColor: `${themeColor}40` }} />
                  <img
                    src={url}
                    alt="Post visual gerado"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    className={cn(
                      "absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-1000 ease-in-out",
                      imageStatus === "loading" ? "opacity-0 scale-105" : "opacity-100 scale-100",
                    )}
                  />
                </>
              )}

              {hasImportedImage && (
                <div className="absolute inset-0 z-[1] bg-black flex items-center justify-center">
                  <img
                    src={state.productImageUrl!}
                    alt="Post Importado"
                    className="w-full h-full object-cover"
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
            </>
          )}
          
          {!hasImportedImage && draggableImages.map((src, i) => (
            <DraggableImage key={`${src}-${i}`} src={src} />
          ))}

          {(imageStatus === "loaded" || hasImportedImage) && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-24 bg-gradient-to-t from-black/40 to-transparent" />
          )}
        </div>

        {/* BARRA DE AÇÕES (Social Footer) */}
        <div className="bg-white dark:bg-[#000000] pt-1">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setLiked((v) => !v)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-all active:scale-75">
                <Heart className={cn("size-6 transition-colors", liked ? "fill-rose-500 text-rose-500" : "text-slate-900 dark:text-slate-100")} strokeWidth={liked ? 1 : 2} />
              </button>
              <button type="button" className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-all active:scale-95">
                <MessageCircle className="size-6 text-slate-900 dark:text-slate-100" />
              </button>
              <button type="button" className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-all active:scale-95">
                <Send className="size-6 -rotate-12 text-slate-900 dark:text-slate-100 -mt-1 ml-0.5" />
              </button>
            </div>
            <button type="button" onClick={() => setSaved((v) => !v)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-all active:scale-75">
              <Bookmark className={cn("size-6 transition-colors", saved ? "fill-slate-900 text-slate-900 dark:fill-white dark:text-white" : "text-slate-900 dark:text-slate-100")} />
            </button>
          </div>

          <div className="px-5 pb-5 pt-1">
            <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
              Curtido por milhares de pessoas
            </p>
            <div className="text-[14px] leading-relaxed text-slate-800 dark:text-slate-200 break-words">
              <span className="font-semibold text-slate-900 dark:text-slate-100 mr-2">{brandName}</span>
              <Editable 
                as="span" 
                multiline 
                value={caption} 
                onChange={(v) => onChange({ caption: v })} 
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3 opacity-80 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100 mt-4">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          Peça: <span className="px-2 py-1 rounded bg-brand/10 text-brand">SOCIAL</span>
          {analyzingColors && <span className="text-xs text-brand animate-pulse flex items-center gap-1"><Sparkles className="size-3" /> Extraindo Cores...</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileRef}
            onChange={handleFileChange}
          />
          <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Foto
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs font-bold rounded-lg bg-surface-2 hover:bg-surface-3" onClick={handleRegenerate}>
            <RefreshCw className="mr-1.5 size-3.5" /> IA
          </Button>
        </div>
      </div>
    </div>
  );
}