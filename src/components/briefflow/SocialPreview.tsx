// src/components/briefflow/SocialPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, 
  AlertCircle, Upload, RefreshCw, Hexagon, Trash2, ImagePlus, Sparkles, Palette, Type
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  
  // Customizações do Design
  const themeColor = state.themeColor || "#2563EB";
  const secondaryColor = state.secondaryColor || "#F472B6";
  const boxColor = state.boxColor || "#060609";
  const textColor = state.textColor || "#ffffff";
  const fontClass = state.fontFamily === "serif" ? "font-serif" : state.fontFamily === "mono" ? "font-mono" : "font-sans";

  const hasImportedImage = !!state.productImageUrl;
  const isProductImage = hasImportedImage;
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
    <div className={cn("mx-auto flex w-full max-w-[420px] flex-col space-y-4", fontClass)} data-testid="social-preview">
      <div className="overflow-hidden rounded-[24px] border shadow-xl flex flex-col" style={{ backgroundColor: boxColor, borderColor: `${textColor}20` }}>
        
        {/* HEADER DO POST */}
        <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: boxColor }}>
          <div className="flex items-center gap-3">
            <div 
              className="relative size-10 shrink-0 rounded-full p-[2px] shadow-sm transition-colors duration-500"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${secondaryColor})` }}
            >
              <div className="flex size-full items-center justify-center rounded-full" style={{ backgroundColor: boxColor }}>
                <Hexagon className="size-4" style={{ color: themeColor }} />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold leading-none tracking-tight" style={{ color: textColor }}>
                  {brandName}
                </span>
                <div className="size-1 rounded-full" style={{ backgroundColor: `${textColor}50` }}></div>
                <span className="text-[12px] font-bold cursor-pointer transition-opacity hover:opacity-80" style={{ color: themeColor }}>
                  Seguir
                </span>
              </div>
              <span className="text-[12px] font-normal mt-0.5" style={{ color: textColor, opacity: 0.5 }}>Patrocinado</span>
            </div>
          </div>
          <button className="p-2 rounded-full transition-colors hover:bg-black/10">
            <MoreHorizontal className="size-5" style={{ color: textColor, opacity: 0.6 }} />
          </button>
        </div>

        {/* ÁREA DA ARTE VISUAL */}
        <div className="relative aspect-[4/5] w-full overflow-hidden border-y flex items-center justify-center group/hero-img" style={{ backgroundColor: boxColor, borderColor: `${textColor}10` }}>
          {hasOffer && (
            <div 
              className="absolute right-4 top-4 z-50 rotate-[6deg] rounded-lg border-2 px-4 py-2 text-[12px] font-black uppercase tracking-widest shadow-2xl backdrop-blur-md"
              style={{ background: `linear-gradient(135deg, ${themeColor}ee, ${secondaryColor}dd)`, color: textColor, borderColor: `${textColor}33` }}
            >
              <Editable as="span" value="OFERTA ESPECIAL" onChange={() => {}} className="pointer-events-none drop-shadow-md" />
            </div>
          )}

          {!activeHeroUrl && imageStatus !== "loading" && draggableImages.length === 0 ? (
            <div 
              className="absolute inset-0 z-[1] flex flex-col items-center justify-center cursor-pointer transition-colors"
              style={{ backgroundColor: `${textColor}0A` }}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-10 mb-3" style={{ color: textColor, opacity: 0.5 }} />
              <p className="text-sm font-bold" style={{ color: textColor, opacity: 0.7 }}>Adicionar Imagem</p>
            </div>
          ) : (
            <>
              {!hasImportedImage && imageStatus === "loading" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-md" style={{ backgroundColor: `${boxColor}99` }}>
                  <Loader2 className="size-8 animate-spin" style={{ color: textColor, opacity: 0.6 }} />
                </div>
              )}
              {!hasImportedImage && imageStatus === "error" ? (
                <div className="absolute inset-0 z-0 flex flex-col items-center justify-center" style={{ backgroundColor: boxColor }}>
                  <AlertCircle className="mb-3 size-8" style={{ color: textColor, opacity: 0.5 }} />
                  <span className="text-center text-[12px] font-bold uppercase tracking-widest" style={{ color: textColor, opacity: 0.5 }}>
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
                <div className="absolute inset-0 z-[1] flex items-center justify-center">
                  <img
                    src={state.productImageUrl!}
                    alt="Post Importado"
                    className="w-full h-full object-contain p-6 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"
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
        <div className="pt-1" style={{ backgroundColor: boxColor }}>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setLiked((v) => !v)} className="p-2 rounded-full transition-all active:scale-75 hover:bg-black/10">
                <Heart className={cn("size-6 transition-colors", liked ? "fill-rose-500 text-rose-500" : "")} style={{ color: !liked ? textColor : undefined }} strokeWidth={liked ? 1 : 2} />
              </button>
              <button type="button" className="p-2 rounded-full transition-all active:scale-95 hover:bg-black/10">
                <MessageCircle className="size-6" style={{ color: textColor }} />
              </button>
              <button type="button" className="p-2 rounded-full transition-all active:scale-95 hover:bg-black/10">
                <Send className="size-6 -rotate-12 -mt-1 ml-0.5" style={{ color: textColor }} />
              </button>
            </div>
            <button type="button" onClick={() => setSaved((v) => !v)} className="p-2 rounded-full transition-all active:scale-75 hover:bg-black/10">
              <Bookmark className={cn("size-6 transition-colors")} style={{ color: textColor, fill: saved ? textColor : "transparent" }} />
            </button>
          </div>

          <div className="px-5 pb-5 pt-1">
            <p className="text-[14px] font-semibold mb-2.5" style={{ color: textColor }}>
              Curtido por milhares de pessoas
            </p>
            <div className="text-[14px] leading-relaxed break-words" style={{ color: textColor, opacity: 0.9 }}>
              <span className="font-semibold mr-2" style={{ color: textColor }}>{brandName}</span>
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
          
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3">
                <Palette className="mr-1.5 size-3.5" /> Design
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-80 bg-surface-1 border-border-strong p-4 shadow-2xl rounded-xl z-50 mb-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <Palette className="mr-1.5 size-3" /> Cores
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Destaque 1</label>
                      <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                        <input type="color" value={themeColor} onChange={(e) => onChange({ themeColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <span className="text-[10px] uppercase text-fg-primary">{themeColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Destaque 2</label>
                      <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                        <input type="color" value={secondaryColor} onChange={(e) => onChange({ secondaryColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <span className="text-[10px] uppercase text-fg-primary">{secondaryColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Fundo Imagem</label>
                      <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                        <input type="color" value={boxColor} onChange={(e) => onChange({ boxColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <span className="text-[10px] uppercase text-fg-primary">{boxColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-fg-secondary">Texto Imagem</label>
                      <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                        <input type="color" value={textColor} onChange={(e) => onChange({ textColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                        <span className="text-[10px] uppercase text-fg-primary">{textColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                    <Type className="mr-1.5 size-3" /> Tipografia
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant={(!state.fontFamily || state.fontFamily === 'sans') ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'sans' })} className="h-7 text-[11px] font-sans">Sans</Button>
                    <Button size="sm" variant={state.fontFamily === 'serif' ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'serif' })} className="h-7 text-[11px] font-serif">Serif</Button>
                    <Button size="sm" variant={state.fontFamily === 'mono' ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'mono' })} className="h-7 text-[11px] font-mono">Mono</Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

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