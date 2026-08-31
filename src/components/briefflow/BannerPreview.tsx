// src/components/briefflow/BannerPreview.tsx
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BannerFontSizes, BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import { Upload, ImagePlus, RefreshCw, ArrowUpRight, Trash2, Sparkles, Palette, LayoutTemplate, Type, Layers, Move, Minus, Plus, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { cleanText, isEmptyLike } from "@/lib/sanitize";
import { analyzeImageWithVisionFn } from "@/lib/vision-api";
import { toast } from "sonner";
import { useBriefflowStore } from "@/store/briefflow";
import { uploadCampaignAsset } from "@/lib/supabase";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  exportWrapperClass?: string;
  exportWrapperStyle?: React.CSSProperties;
}

const blockCache = new Map<string, { x: number; y: number }>();

type BannerFontSizeKey = keyof BannerFontSizes;

interface FontSizeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

function FontSizeControl({ label, value, min, max, step = 1, onChange }: FontSizeControlProps) {
  const update = (nextValue: number) => onChange(Math.min(max, Math.max(min, nextValue)));

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5">
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-fg-secondary">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md"
          disabled={value <= min}
          aria-label={`Diminuir ${label.toLowerCase()}`}
          title={`Diminuir ${label.toLowerCase()}`}
          onClick={() => update(value - step)}
        >
          <Minus className="size-3.5" />
        </Button>
        <span className="w-12 text-center text-[11px] font-bold tabular-nums text-fg-primary">{value}px</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md"
          disabled={value >= max}
          aria-label={`Aumentar ${label.toLowerCase()}`}
          title={`Aumentar ${label.toLowerCase()}`}
          onClick={() => update(value + step)}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DraggableBlock({ id, children, className, isExport, resetPosition = false }: { id: string, children: React.ReactNode, className?: string, isExport?: boolean, resetPosition?: boolean }) {
  const cached = useMemo(() => resetPosition ? { x: 0, y: 0 } : blockCache.get(id) || { x: 0, y: 0 }, [id, resetPosition]);
  const [pos, setPos] = useState(cached);
  const [isDragging, setIsDragging] = useState(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resetPosition) setPos({ x: 0, y: 0 });
  }, [resetPosition]);

  useEffect(() => {
    if (isExport) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
      const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

      const parent = containerRef.current?.closest('#banner-export-node, #email-export-node');
      const parentRect = parent?.getBoundingClientRect();
      const pWidth = parentRect?.width || window.innerWidth;
      const pHeight = parentRect?.height || window.innerHeight;

      const deltaX = ((clientX - startMousePos.current.x) / pWidth) * 100;
      const deltaY = ((clientY - startMousePos.current.y) / pHeight) * 100;

      setPos({
        x: startPos.current.x + deltaX,
        y: startPos.current.y + deltaY,
      });
    };

    const handleUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("touchend", handleUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isDragging, isExport]);

  useEffect(() => {
    if (!isExport && !resetPosition) blockCache.set(id, pos);
  }, [pos, id, isExport, resetPosition]);

  useLayoutEffect(() => {
    if (isDragging) return;

    const frame = window.requestAnimationFrame(() => {
      const element = containerRef.current;
      const parent = element?.closest<HTMLElement>('#banner-export-node, #email-export-node');
      if (!element || !parent) return;

      const elementRect = element.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      let correctionX = 0;
      let correctionY = 0;

      if (elementRect.left < parentRect.left) {
        correctionX = parentRect.left - elementRect.left;
      } else if (elementRect.right > parentRect.right) {
        correctionX = parentRect.right - elementRect.right;
      }

      if (elementRect.top < parentRect.top) {
        correctionY = parentRect.top - elementRect.top;
      } else if (elementRect.bottom > parentRect.bottom) {
        correctionY = parentRect.bottom - elementRect.bottom;
      }

      if (Math.abs(correctionX) > 0.5 || Math.abs(correctionY) > 0.5) {
        setPos((current) => ({
          x: current.x + (correctionX / parentRect.width) * 100,
          y: current.y + (correctionY / parentRect.height) * 100,
        }));
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isDragging]);

  const onPointerDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    if (isExport) return;

    const target = e.target as HTMLElement;
    if (["p", "h1", "h2", "h3", "span"].includes(target.tagName.toLowerCase())) return;

    setIsDragging(true);
    let clientX = 0, clientY = 0;
    if ("clientX" in e) { clientX = e.clientX; clientY = e.clientY; }
    else if ("touches" in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }

    startMousePos.current = { x: clientX, y: clientY };
    startPos.current = { ...pos };
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative transition-all duration-300",
        !isExport && "cursor-move group/drag",
        isDragging && !isExport ? "z-50 shadow-2xl scale-[1.02]" : (!isExport && "hover:scale-[1.01]"),
        className)}
      style={{ position: 'relative', left: `${pos.x}%`, top: `${pos.y}%` }}
      onPointerDown={onPointerDown}
    >
      {!isExport && (
        <div className="absolute -top-3 -right-3 opacity-0 group-hover/drag:opacity-100 transition-opacity bg-black/50 text-white p-2 rounded-full z-10 pointer-events-none shadow-lg">
          <Move className="size-3" />
        </div>
      )}
      {children}
    </div>
  );
}

export function BannerPreview({ state: propState, onChange, exportWrapperClass, exportWrapperStyle }: Props) {
  const { builder } = useBriefflowStore();
  const isExportClone = !!exportWrapperClass;
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(1200);
  const state = propState;

  useLayoutEffect(() => {
    if (isExportClone) return;
    const frame = previewFrameRef.current;
    if (!frame) return;

    const updateWidth = () => setPreviewWidth(Math.max(1, frame.clientWidth));
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(frame);
    updateWidth();
    return () => resizeObserver.disconnect();
  }, [isExportClone]);

  const isMobileLayout =
    exportWrapperClass?.includes("force-mobile") ||
    (!isExportClone && previewWidth < 640);
  const canvasWidth = isMobileLayout ? 540 : 1200;
  const canvasHeight = isMobileLayout ? 960 : 600;
  const previewScale = isExportClone
    ? 1
    : Math.min(1, previewWidth / canvasWidth);

  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [useFallback, setUseFallback] = useState(false);
  const [analyzingColors, setAnalyzingColors] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const themeColor = state.themeColor || "#6366f1";
  const textColor = state.textColor || "#ffffff";
  const boxColor = state.boxColor || "#06060a";
  const fontClass = state.fontFamily === "serif" ? "font-serif" : state.fontFamily === "mono" ? "font-mono" : "font-sans";

  const baseFontFamily = state.fontFamily === 'serif'
    ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
    : state.fontFamily === 'mono'
      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  const title = cleanText(state.title, "Equipamentos que impulsionam a performance");
  const subtitle = cleanText(state.subtitle);
  const bodyText = cleanText(state.body);
  const footerInfo = cleanText(state.footerInfo);
  const benefits = state.keyBenefits || [];
  const prompt = cleanText(state.imagePrompt || "");

  const badgePrimary = cleanText(state.badgePrimary);
  const badgeSecondary = cleanText(state.badgeSecondary);

  const backgroundShape = state.backgroundShape || "curve";
  const layoutStyle = state.layoutStyle || "split";
  const hasSubtitle = !isEmptyLike(subtitle);

  const draggableImages = Array.from(new Set(state.productImages || [])).filter(
    (src): src is string => typeof src === "string" && src.trim().length > 0,
  );

  const heroUrl = useMemo(() => {
    if (!prompt) return null;
    return useFallback
      ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed })
      : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed });
  }, [prompt, state.imageSeed, useFallback]);

  const activeBgUrl = state.productImageUrl || heroUrl;

  const [safeBgUrl, setSafeBgUrl] = useState<string | null>(() => {
    return activeBgUrl?.startsWith("blob:") ? null : (activeBgUrl || null);
  });

  useEffect(() => {
    let isMounted = true;
    if (activeBgUrl?.startsWith("blob:")) {
      fetch(activeBgUrl)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (isMounted) setSafeBgUrl(reader.result as string);
          };
          reader.readAsDataURL(blob);
        }).catch(() => {
          if (isMounted) setSafeBgUrl(activeBgUrl);
        });
    } else {
      if (isMounted) setSafeBgUrl(activeBgUrl || null);
    }
    return () => { isMounted = false; };
  }, [activeBgUrl]);

  const isLocalBg = safeBgUrl?.startsWith("data:") || safeBgUrl?.startsWith("blob:");

  useEffect(() => {
    if (!heroUrl) return;
    setImageStatus("loading");
    const timer = setTimeout(() => {
      setImageStatus((prev) => {
        if (prev === "loading") {
          if (!useFallback && !state.productImageUrl) {
            setUseFallback(true);
            return "loading";
          }
          return "error";
        }
        return prev;
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [heroUrl, useFallback, state.productImageUrl]);

  const handleImageError = () => {
    if (!useFallback && !state.productImageUrl) setUseFallback(true);
    else setImageStatus("error");
  };

  const handleProductChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const toastId = toast.loading(`Fazendo upload de ${files.length} produto(s)...`);
    const newImages: string[] = [];

    try {
      for (const file of files) {
        const publicUrl = await uploadCampaignAsset(file, 'products');
        newImages.push(publicUrl);
      }
      onChange({ productImages: [...(state.productImages || []), ...newImages] });
      toast.success("Upload de produtos concluído!", { id: toastId });
    } catch (err) {
      console.error("Falha no upload múltiplo:", err);
      toast.error("Erro no upload de um ou mais produtos.", { id: toastId });
    }

    e.target.value = "";
  };

  const handleBackgroundChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading("Enviando fundo para a nuvem...");
    try {
      const publicUrl = await uploadCampaignAsset(file, 'backgrounds');
      onChange({ productImageUrl: publicUrl });

      setAnalyzingColors(true);
      toast.loading("Extraindo paleta de cores...", { id: toastId });

      const visionResult = await analyzeImageWithVisionFn({ data: { imageUrl: publicUrl } });

      if (visionResult.primaryBrandColor) {
        onChange({
          productImageUrl: publicUrl,
          themeColor: visionResult.primaryBrandColor,
          secondaryColor: visionResult.secondaryBrandColor || "#1e1b4b"
        });
        toast.success("Paleta harmonizada com a foto!", { id: toastId });
      } else {
        toast.success("Fundo aplicado com sucesso!", { id: toastId });
      }
    } catch (err) {
      console.error("Falha no upload/análise:", err);
      toast.error("Erro ao fazer upload da imagem de fundo", { id: toastId });
    } finally {
      setAnalyzingColors(false);
    }

    e.target.value = "";
  };

  const handleRegenerate = () => {
    setImageStatus("loading");
    setUseFallback(false);
    onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
  };

  const isCurve = backgroundShape === "curve";
  const isDiagonal = backgroundShape === "diagonal";
  const isBlob = backgroundShape === "blob";
  const isGeometric = backgroundShape === "geometric";
  const isFrame = backgroundShape === "frame";
  const isArch = backgroundShape === "arch";
  const isWave = backgroundShape === "wave";
  const isPill = backgroundShape === "pill";
  const isOffset = backgroundShape === "offset";

  const isReverse = layoutStyle === "reverse";
  const isCentered = layoutStyle === "centered" || layoutStyle === "minimalist";
  const isComplexShape = isFrame || isBlob || isGeometric || isArch || isPill || isOffset;

  const defaultFontSizes: Required<BannerFontSizes> = {
    title: isCentered ? 56 : 64,
    subtitle: 28,
    body: 20,
    benefits: 14,
    footer: isCentered ? 16 : 14,
    badgePrimary: 48,
    badgeSecondary: 18,
  };
  const fontSizes: Required<BannerFontSizes> = {
    ...defaultFontSizes,
    ...state.bannerFontSizes,
  };
  const mobileDefaultFontSizes: Required<BannerFontSizes> = {
    title: 40,
    subtitle: 22,
    body: 16,
    benefits: 12,
    footer: isCentered ? 12 : 14,
    badgePrimary: 36,
    badgeSecondary: 16,
  };
  const mobileFontSize = (key: BannerFontSizeKey) =>
    Math.max(8, Math.round(fontSizes[key] * (mobileDefaultFontSizes[key] / defaultFontSizes[key])));
  const bannerFontVariables = {
    "--banner-title-size": `${fontSizes.title}px`,
    "--banner-subtitle-size": `${fontSizes.subtitle}px`,
    "--banner-body-size": `${fontSizes.body}px`,
    "--banner-benefits-size": `${fontSizes.benefits}px`,
    "--banner-footer-size": `${fontSizes.footer}px`,
    "--banner-badge-primary-size": `${fontSizes.badgePrimary}px`,
    "--banner-badge-secondary-size": `${fontSizes.badgeSecondary}px`,
    "--banner-title-mobile-size": `${mobileFontSize("title")}px`,
    "--banner-subtitle-mobile-size": `${mobileFontSize("subtitle")}px`,
    "--banner-body-mobile-size": `${mobileFontSize("body")}px`,
    "--banner-benefits-mobile-size": `${mobileFontSize("benefits")}px`,
    "--banner-footer-mobile-size": `${mobileFontSize("footer")}px`,
    "--banner-badge-primary-mobile-size": `${mobileFontSize("badgePrimary")}px`,
    "--banner-badge-secondary-mobile-size": `${mobileFontSize("badgeSecondary")}px`,
  } as React.CSSProperties;
  const updateFontSize = (key: BannerFontSizeKey, value: number) => {
    onChange({
      bannerFontSizes: {
        ...state.bannerFontSizes,
        [key]: value,
      },
    });
  };

  let shapeClass = "";
  if (isCurve) {
    shapeClass = isReverse
      ? cn("[clip-path:ellipse(80%_150%_at_100%_50%)] [.force-mobile_&]:![clip-path:ellipse(150%_100%_at_50%_100%)]", !isExportClone && "max-md:![clip-path:ellipse(150%_100%_at_50%_100%)]")
      : cn("[clip-path:ellipse(80%_150%_at_0%_50%)] [.force-mobile_&]:![clip-path:ellipse(150%_100%_at_50%_100%)]", !isExportClone && "max-md:![clip-path:ellipse(150%_100%_at_50%_100%)]");
  } else if (isDiagonal) {
    shapeClass = isReverse
      ? cn("[clip-path:polygon(20%_0,100%_0,100%_100%,0%_100%)] [.force-mobile_&]:![clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]", !isExportClone && "max-md:![clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]")
      : cn("[clip-path:polygon(0_0,100%_0,80%_100%,0%_100%)] [.force-mobile_&]:![clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]", !isExportClone && "max-md:![clip-path:polygon(0_15%,100%_0,100%_100%,0_100%)]");
  } else if (isWave) {
    shapeClass = isReverse
      ? cn("[clip-path:polygon(100%_0,0_0,0_100%,40%_85%,100%_100%)] [.force-mobile_&]:![clip-path:polygon(100%_0,0_0,0_100%,40%_85%,100%_100%)]", !isExportClone && "max-md:![clip-path:polygon(100%_0,0_0,0_100%,40%_85%,100%_100%)]")
      : cn("[clip-path:polygon(0_0,100%_0,100%_100%,60%_85%,0_100%)] [.force-mobile_&]:![clip-path:polygon(0_0,100%_0,100%_100%,60%_85%,0_100%)]", !isExportClone && "max-md:![clip-path:polygon(0_0,100%_0,100%_100%,60%_85%,0_100%)]");
  } else if (layoutStyle === "split") {
    shapeClass = isReverse
      ? cn("[clip-path:polygon(0_0,55%_0,55%_100%,0_100%)] [.force-mobile_&]:![clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]", !isExportClone && "max-md:![clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]")
      : cn("[clip-path:polygon(45%_0,100%_0,100%_100%,45%_100%)] [.force-mobile_&]:![clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]", !isExportClone && "max-md:![clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]");
  }

  const lineClass = isCurve
    ? isReverse
      ? cn("[clip-path:ellipse(83%_155%_at_100%_50%)] [.force-mobile_&]:![clip-path:ellipse(155%_103%_at_50%_100%)]", !isExportClone && "max-md:![clip-path:ellipse(155%_103%_at_50%_100%)]")
      : cn("[clip-path:ellipse(83%_155%_at_0%_50%)] [.force-mobile_&]:![clip-path:ellipse(155%_103%_at_50%_100%)]", !isExportClone && "max-md:![clip-path:ellipse(155%_103%_at_50%_100%)]")
    : "";

  return (
    <div className="mx-auto flex w-full flex-col space-y-4" data-testid="banner-preview">
      <div
        ref={previewFrameRef}
        className="relative flex w-full justify-center overflow-hidden"
        style={{ height: canvasHeight * previewScale }}
      >
        <div
          className="relative shrink-0"
          style={{
            height: canvasHeight * previewScale,
            width: canvasWidth * previewScale,
          }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              height: canvasHeight,
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
              width: canvasWidth,
            }}
          >
      <div
        id="banner-export-node"
        data-export-node="banner"
        className={cn(
          "relative overflow-hidden shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] flex transition-colors duration-500 bg-black",
          exportWrapperClass,
          isMobileLayout && "force-mobile",
          !isExportClone && "rounded-[24px]",
          isCentered ? "flex-col" : cn("[.force-mobile_&]:!flex-col-reverse", !isExportClone && "max-md:!flex-col-reverse"),
          fontClass
        )}
        style={{
          backgroundColor: boxColor,
          borderColor: `${textColor}1A`,
          borderWidth: '1px',
          fontFamily: baseFontFamily,
          ...exportWrapperStyle,
          ...bannerFontVariables,
          height: canvasHeight,
          width: canvasWidth,
        }}
      >

        <div className="absolute inset-0 z-0 bg-black">
          {safeBgUrl && (
            <img
              src={safeBgUrl}
              crossOrigin={isLocalBg ? undefined : "anonymous"}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-1000",
                (!state.productImageUrl && imageStatus === "loading") ? "opacity-0 scale-105" : "opacity-90 scale-100"
              )}
              onLoad={() => !state.productImageUrl && setImageStatus("loaded")}
              onError={handleImageError}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>

        <div className="banner-product-layer absolute inset-0 z-30 pointer-events-none [&>*]:pointer-events-auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 }}>
          {draggableImages.length > 0 && draggableImages.map((src, i) => (
            <DraggableImage key={`banner-img-${i}`} src={src} type="banner" isExport={isExportClone} />
          ))}
        </div>

        <div className={cn(
          "banner-layout relative z-10 w-full h-full flex flex-1 overflow-hidden z-10 flex-row",
          "[.force-mobile_&]:!flex-col-reverse [.force-mobile_&]:!overflow-visible",
          !isExportClone && "max-md:!flex-col-reverse max-md:!overflow-visible"
        )}>
          {isCentered ? (
            <div className={cn("banner-centered-pane relative w-full h-full flex flex-col items-center justify-center p-12 text-center [.force-mobile_&]:!p-8 z-10 pointer-events-none", !isExportClone && "max-md:!p-8")}>

              <div className={cn(
                "absolute inset-0 z-0 transition-all duration-500 pointer-events-none",
                isFrame ? "m-8 rounded-[40px] border-[1px] border-white/20 shadow-2xl overflow-hidden" : "",
                isBlob ? "m-6 rounded-[30%_70%_70%_30%/30%_30%_70%_70%] overflow-hidden shadow-xl" : "",
                isArch ? "m-6 rounded-t-[1000px] rounded-b-3xl border border-white/10 shadow-2xl overflow-hidden" : "",
                isPill ? "m-8 rounded-full border border-white/10 shadow-xl overflow-hidden" : "",
                isOffset ? "m-12 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden scale-95 border border-white/10" : ""
              )} style={{ backgroundColor: isComplexShape ? `${themeColor}CC` : 'transparent' }}>

                {!safeBgUrl && draggableImages.length === 0 && !isExportClone && (
                  <div className="w-full h-full flex items-center justify-center pointer-events-auto cursor-pointer" onClick={() => bgRef.current?.click()}>
                    <div className="flex flex-col items-center gap-3 p-8 rounded-3xl border border-white/20 bg-white/10 shadow-lg transition-colors hover:bg-white/20">
                      <ImagePlus className="size-10" style={{ color: textColor, opacity: 0.8 }} />
                      <p className="text-sm font-semibold tracking-wide" style={{ color: textColor }}>Adicionar Fundo Imersivo</p>
                    </div>
                  </div>
                )}
              </div>

              {!isComplexShape && <div className="absolute inset-0 z-10 opacity-70 pointer-events-none transition-colors duration-500" style={{ backgroundColor: themeColor }} />}

              <div className="relative z-40 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                <DraggableBlock id="banner-title-center" isExport={isExportClone} resetPosition={isMobileLayout} className="banner-mobile-reset pointer-events-auto w-full max-w-[700px] flex flex-col items-center">
                  <div
                    className={cn(
                      "p-10 rounded-[32px] shadow-2xl relative mb-6 w-full [.force-mobile_&]:!p-8 [.force-mobile_&]:!max-w-[95%] transition-all",
                      !isExportClone && "max-md:!p-8 max-md:!max-w-[95%]",
                      isComplexShape ? "bg-transparent border-0 shadow-none p-0" : "border border-white/10 shadow-2xl",
                      isOffset && "!bg-white/90 !p-10 !shadow-2xl !border-l-8 !border-b-8 !rounded-2xl"
                    )}
                    style={{ backgroundColor: isComplexShape ? 'transparent' : `${boxColor}E6`, color: textColor }}
                  >
                    <Editable as="h2" value={title} onChange={(v) => onChange({ title: v })} className={cn("banner-title-text font-extrabold text-[56px] [.force-mobile_&]:!text-[46px] leading-[1.1] tracking-tighter break-words text-balance", !isExportClone && "max-md:!text-[36px]")} style={{ color: textColor, fontSize: fontSizes.title }} />

                    {hasSubtitle && <Editable as="p" multiline value={subtitle} onChange={(v) => onChange({ subtitle: v })} className={cn("banner-subtitle-text font-medium opacity-90 text-[28px] [.force-mobile_&]:!text-[22px] leading-relaxed max-w-[90%] mx-auto mt-4 break-words pointer-events-auto", !isComplexShape && "drop-shadow-sm", !isExportClone && "max-md:!text-[18px]")} style={{ color: textColor, fontSize: fontSizes.subtitle }} />}

                    {bodyText && <Editable as="p" multiline value={bodyText} onChange={(v) => onChange({ body: v })} className={cn("banner-body-text font-normal opacity-80 text-[20px] [.force-mobile_&]:!text-[16px] leading-relaxed max-w-[90%] mx-auto mt-3 break-words pointer-events-auto block", !isComplexShape && "drop-shadow-sm", !isExportClone && "max-md:!text-[14px]")} style={{ color: textColor, fontSize: fontSizes.body }} />}

                    {benefits.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2 mt-6">
                        {benefits.map((ben, i) => (
                          <span key={i} className={cn("banner-benefit-text border border-white/10 text-[14px] [.force-mobile_&]:!text-[12px] uppercase tracking-widest font-bold px-4 py-2 rounded-xl shadow-inner", !isExportClone && "max-md:!text-[11px]")} style={{ color: textColor, backgroundColor: `${boxColor}40`, fontSize: fontSizes.benefits }}>{ben}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </DraggableBlock>

                {footerInfo && (
                  <div className="mt-auto pt-6 pointer-events-auto">
                    <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className={cn("banner-footer-text font-medium opacity-60 text-[16px] [.force-mobile_&]:!text-[12px] uppercase tracking-widest break-words", !isExportClone && "max-md:!text-[12px]")} style={{ color: textColor, fontSize: fontSizes.footer }} />
                  </div>
                )}

                {(badgePrimary || badgeSecondary) && (
                  <DraggableBlock id="banner-badge-center" isExport={isExportClone} resetPosition={isMobileLayout} className={cn("absolute z-50 bottom-8 right-8 flex flex-col items-end gap-3 pointer-events-auto [.force-mobile_&]:!bottom-4 [.force-mobile_&]:!right-4", !isExportClone && "max-md:!bottom-4 max-md:!right-4")}>
                    {badgePrimary && (
                      <div className={cn("rounded-full size-[180px] [.force-mobile_&]:!size-[140px] flex items-center justify-center text-center p-3 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] border border-white/20", !isExportClone && "max-md:!size-[120px]")} style={{ backgroundColor: `${boxColor}F2`, color: textColor }}>
                        <Editable as="span" value={badgePrimary} onChange={(v) => onChange({ badgePrimary: v })} className={cn("banner-badge-primary-text font-black text-[48px] [.force-mobile_&]:!text-[36px] leading-[1.0] tracking-tighter", !isExportClone && "max-md:!text-[36px]")} style={{ color: textColor, fontSize: fontSizes.badgePrimary }} />
                      </div>
                    )}
                    {badgeSecondary && (
                      <div className="rounded-full px-5 py-2.5 text-center shadow-lg border border-white/20 relative z-10" style={{ backgroundColor: themeColor, color: textColor }}>
                        <Editable as="span" value={badgeSecondary} onChange={(v) => onChange({ badgeSecondary: v })} className={cn("banner-badge-secondary-text font-bold text-[18px] [.force-mobile_&]:!text-[16px] tracking-wide leading-tight", !isExportClone && "max-md:!text-[14px]")} style={{ color: textColor, fontSize: fontSizes.badgeSecondary }} />
                      </div>
                    )}
                  </DraggableBlock>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Bloco da Imagem - Mobile vira a parte de baixo (h-auto livre!) */}
              <div className={cn(
                "banner-visual-pane absolute inset-y-0 z-0 flex items-center justify-center w-[60%] transition-all duration-500 pointer-events-none",
                "[.force-mobile_&]:!relative [.force-mobile_&]:!h-auto [.force-mobile_&]:!aspect-square max-md:!relative max-md:!aspect-square",
                isReverse ? "left-0" : "right-0",
                isFrame ? "m-6 rounded-t-[60px] rounded-b-3xl border border-white/20 shadow-2xl overflow-hidden" :
                  isBlob ? "m-4 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] overflow-hidden shadow-2xl" :
                    isGeometric ? "m-6 rounded-3xl border border-white/10 shadow-[12px_12px_0px_rgba(0,0,0,0.2)] overflow-hidden" :
                      isArch ? "m-6 rounded-t-[1000px] rounded-b-3xl border border-white/20 shadow-2xl overflow-hidden" :
                        isPill ? "m-6 rounded-full border border-white/20 shadow-2xl overflow-hidden" :
                          isOffset ? cn("m-8 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden scale-95 border border-white/10 [.force-mobile_&]:!m-0", !isExportClone && "max-md:!m-0") :
                            "overflow-hidden",
                cn("[.force-mobile_&]:!inset-auto [.force-mobile_&]:!w-full", !isExportClone && "max-md:!inset-auto max-md:!w-full")
              )} style={{ backgroundColor: isComplexShape ? `${themeColor}CC` : 'transparent' }}>

                {!safeBgUrl && draggableImages.length === 0 && !isExportClone && (
                  <div className={cn("relative z-10 flex h-full items-center justify-center w-full pointer-events-auto", isReverse ? "justify-start pl-[10%]" : "justify-end pr-[10%]")}>
                    <div className="flex flex-col items-center gap-3 p-8 rounded-3xl border border-white/20 bg-white/10 shadow-lg transition-colors hover:bg-white/20 cursor-pointer" onClick={() => bgRef.current?.click()}>
                      <ImagePlus className="size-10" style={{ color: textColor, opacity: 0.8 }} />
                      <p className="text-sm font-semibold tracking-wide" style={{ color: textColor }}>Adicionar Fundo</p>
                    </div>
                  </div>
                )}
              </div>

              {!isComplexShape && (
                <>
                  <div className={cn(
                    "banner-shape-panel absolute inset-y-0 w-[65%] z-10 shadow-[-20px_0_60px_rgba(0,0,0,0.5)] pointer-events-none transition-all duration-700 border-white/10 [.force-mobile_&]:!absolute max-md:!absolute",
                    isReverse ? "right-0 border-l" : "left-0 border-r",
                    shapeClass,
                    cn("[.force-mobile_&]:!inset-auto [.force-mobile_&]:!top-0 [.force-mobile_&]:!left-0 [.force-mobile_&]:!w-full [.force-mobile_&]:!h-full [.force-mobile_&]:!border-none", !isExportClone && "max-md:!inset-auto max-md:!top-0 max-md:!left-0 max-md:!w-full max-md:!h-full max-md:!border-none")
                  )} style={{ backgroundColor: `${themeColor}D9` }} />

                  {isCurve && (
                    <div className={cn(
                      "absolute inset-y-0 w-[65%] z-10 border border-white/30 pointer-events-none opacity-50",
                      isReverse ? "right-0" : "left-0",
                      lineClass
                    )} />
                  )}
                </>
              )}

              {/* Bloco de Texto - Mobile vira a parte de cima (h-auto livre!) */}
              <div className={cn(
                "banner-text-pane relative z-40 w-[50%] h-full flex flex-col justify-center py-8 pointer-events-none",
                isReverse ? cn("pr-14 pl-4 items-end text-right [.force-mobile_&]:!pr-8", !isExportClone && "max-md:!pr-8") : cn("pl-14 pr-4 items-start text-left [.force-mobile_&]:!pl-8", !isExportClone && "max-md:!pl-8"),
                isComplexShape ? (isReverse ? cn("pr-16 [.force-mobile_&]:!pr-10", !isExportClone && "max-md:!pr-10") : cn("pl-16 [.force-mobile_&]:!pl-10", !isExportClone && "max-md:!pl-10")) : "",
                isOffset ? (isReverse ? "-mr-16 z-40" : "-ml-16 z-40") : "",
                cn("[.force-mobile_&]:!w-full [.force-mobile_&]:!h-auto [.force-mobile_&]:!py-12 [.force-mobile_&]:!mt-0 [.force-mobile_&]:!justify-center [.force-mobile_&]:!items-center [.force-mobile_&]:!text-center [.force-mobile_&]:!px-6 [.force-mobile_&]:!m-0", !isExportClone && "max-md:!w-full max-md:!h-auto max-md:!py-12 max-md:!mt-0 max-md:!justify-center max-md:!items-center max-md:!text-center max-md:!px-6 max-md:!m-0")
              )}>

                <DraggableBlock id="banner-text-split" isExport={isExportClone} resetPosition={isMobileLayout} className={cn(
                  "banner-mobile-reset pointer-events-auto flex flex-col w-full max-w-[560px]",
                  isReverse ? "items-end" : "items-start",
                  cn("[.force-mobile_&]:!items-center", !isExportClone && "max-md:!items-center")
                )}>
                  <div
                    className={cn(
                      "p-10 rounded-[32px] relative mb-6 w-full [.force-mobile_&]:!p-6 [.force-mobile_&]:!max-w-[95%] transition-all",
                      !isExportClone && "max-md:!p-6 max-md:!max-w-[95%]",
                      isComplexShape ? "bg-transparent border-0 shadow-none p-0" : "border border-white/10 shadow-2xl",
                      isOffset && "!bg-white/90 !p-10 !shadow-2xl !border-l-8 !border-b-8 !rounded-2xl"
                    )}
                    style={{
                      backgroundColor: isComplexShape ? 'transparent' : (isOffset ? boxColor : `${boxColor}E6`),
                      borderColor: isComplexShape ? 'transparent' : (isOffset ? themeColor : 'rgba(255,255,255,0.1)'),
                      color: textColor
                    }}
                  >
                    <Editable as="h2" value={title} onChange={(v) => onChange({ title: v })} className={cn("banner-title-text font-extrabold text-[64px] [.force-mobile_&]:!text-[46px] leading-[1.05] tracking-tighter break-words text-balance", !isOffset && "drop-shadow-lg", !isExportClone && "max-md:!text-[36px]")} style={{ color: textColor, fontSize: fontSizes.title }} />

                    {!isComplexShape && !isExportClone && (
                      <div className={cn("absolute top-6 opacity-30", isReverse ? "left-6" : "right-6", "[.force-mobile_&]:!hidden", !isExportClone && "max-md:!hidden")}>
                        <ArrowUpRight className="size-10" style={{ color: textColor }} strokeWidth={2} />
                      </div>
                    )}
                  </div>

                  {hasSubtitle && <Editable as="p" multiline value={subtitle} onChange={(v) => onChange({ subtitle: v })} className={cn("banner-subtitle-text font-semibold opacity-95 text-[28px] [.force-mobile_&]:!text-[22px] leading-relaxed max-w-[95%] break-words mb-3", (!isComplexShape || isOffset) && "drop-shadow-md", !isExportClone && "max-md:!text-[18px]")} style={{ color: textColor, fontSize: fontSizes.subtitle }} />}

                  {bodyText && <Editable as="p" multiline value={bodyText} onChange={(v) => onChange({ body: v })} className={cn("banner-body-text font-normal opacity-80 text-[20px] [.force-mobile_&]:!text-[16px] leading-relaxed max-w-[95%] break-words mb-5 block", (!isComplexShape || isOffset) && "drop-shadow-md", !isExportClone && "max-md:!text-[14px]")} style={{ color: textColor, fontSize: fontSizes.body }} />}

                  {benefits.length > 0 && (
                    <div className={cn("flex flex-wrap gap-2 mt-4", isReverse ? "justify-end" : "justify-start", "[.force-mobile_&]:!justify-center", !isExportClone && "max-md:!justify-center")}>
                      {benefits.map((ben, i) => (
                        <span key={i} className={cn("banner-benefit-text border border-white/10 text-[14px] [.force-mobile_&]:!text-[12px] uppercase tracking-widest font-bold px-4 py-2 rounded-xl shadow-inner", !isExportClone && "max-md:!text-[10px]")} style={{ color: isComplexShape ? boxColor : textColor, backgroundColor: isComplexShape ? themeColor : `${boxColor}40`, fontSize: fontSizes.benefits }}>{ben}</span>
                      ))}
                    </div>
                  )}
                </DraggableBlock>

                {footerInfo && (
                  <div className={cn("mt-auto pt-8 pointer-events-auto block [.force-mobile_&]:!pt-4", !isExportClone && "max-md:!pt-4")}>
                    <Editable as="p" value={footerInfo} onChange={(v) => onChange({ footerInfo: v })} className={cn("banner-footer-text font-medium opacity-60 text-[14px] uppercase tracking-widest break-words drop-shadow-sm")} style={{ color: textColor, fontSize: fontSizes.footer }} />
                  </div>
                )}
              </div>

              {(badgePrimary || badgeSecondary) && (
                <DraggableBlock id="banner-badge-split" isExport={isExportClone} resetPosition={isMobileLayout} className={cn(
                  "banner-mobile-badge banner-mobile-reset absolute z-50 flex flex-col items-center gap-3 pointer-events-auto top-1/2 -translate-y-1/2",
                  isReverse ? "right-[55%] translate-x-1/2" : "left-[55%] -translate-x-1/2",
                  cn("[.force-mobile_&]:!right-auto [.force-mobile_&]:!left-1/2 [.force-mobile_&]:!bottom-[42%] [.force-mobile_&]:!top-auto [.force-mobile_&]:!-translate-x-1/2 [.force-mobile_&]:!translate-y-0", !isExportClone && "max-md:!right-auto max-md:!left-1/2 max-md:!bottom-[42%] max-md:!top-auto max-md:!-translate-x-1/2 max-md:!translate-y-0")
                )}>
                  {badgePrimary && (
                    <div className={cn("rounded-full size-[180px] [.force-mobile_&]:!size-[140px] flex items-center justify-center text-center p-3 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] border border-white/20", !isExportClone && "max-md:!size-[110px]")} style={{ backgroundColor: `${boxColor}F2`, color: textColor }}>
                      <Editable as="span" value={badgePrimary} onChange={(v) => onChange({ badgePrimary: v })} className={cn("banner-badge-primary-text font-black text-[48px] [.force-mobile_&]:!text-[36px] leading-[1.0] tracking-tighter", !isExportClone && "max-md:!text-[28px]")} style={{ color: textColor, fontSize: fontSizes.badgePrimary }} />
                    </div>
                  )}
                  {badgeSecondary && (
                    <div className="rounded-full px-5 py-2.5 text-center shadow-lg border border-white/20 relative z-10" style={{ backgroundColor: themeColor, color: textColor }}>
                      <Editable as="span" value={badgeSecondary} onChange={(v) => onChange({ badgeSecondary: v })} className={cn("banner-badge-secondary-text font-bold text-[18px] [.force-mobile_&]:!text-[16px] tracking-wide leading-tight", !isExportClone && "max-md:!text-[13px]")} style={{ color: textColor, fontSize: fontSizes.badgeSecondary }} />
                    </div>
                  )}
                </DraggableBlock>
              )}

            </>
          )}
        </div>
      </div>
          </div>
        </div>
      </div>

      {!isExportClone && (
        <div className="editor-toolbar mt-3 rounded-2xl border border-border-subtle bg-surface-1/85 p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          <div className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted flex items-center gap-2">
            Peça: <span className="px-2 py-1 rounded bg-brand/10 text-brand">BANNER</span>
            {analyzingColors && <span className="text-xs text-brand animate-pulse flex items-center gap-1"><Sparkles className="size-3" /> Extraindo Cores...</span>}
          </div>

          <div className="editor-toolbar-actions shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3">
                  <Palette className="mr-1.5 size-3.5" /> Design
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="mb-2 max-h-[calc(100vh-96px)] w-[min(380px,calc(100vw-24px))] overflow-y-auto rounded-2xl border-border-strong bg-surface-1 p-4 shadow-[var(--shadow-elevated)] z-50">
                <div className="space-y-4">

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                      <LayoutTemplate className="mr-1.5 size-3" /> Estrutura
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant={layoutStyle === 'split' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'split' })} className="h-7 text-[11px]">Esquerda</Button>
                      <Button size="sm" variant={layoutStyle === 'reverse' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'reverse' })} className="h-7 text-[11px]">Direita</Button>
                      <Button size="sm" variant={layoutStyle === 'centered' ? 'default' : 'outline'} onClick={() => onChange({ layoutStyle: 'centered' })} className="h-7 text-[11px]">Centro</Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                      <Layers className="mr-1.5 size-3" /> Forma Visual (Overlay)
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant={backgroundShape === 'minimalist' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'minimalist' })} className="h-7 text-[11px]">Clean</Button>
                      <Button size="sm" variant={backgroundShape === 'split' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'split' })} className="h-7 text-[11px]">Reto</Button>
                      <Button size="sm" variant={backgroundShape === 'curve' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'curve' })} className="h-7 text-[11px]">Curva</Button>
                      <Button size="sm" variant={backgroundShape === 'diagonal' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'diagonal' })} className="h-7 text-[11px]">Diagonal</Button>
                      <Button size="sm" variant={backgroundShape === 'wave' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'wave' })} className="h-7 text-[11px]">Onda</Button>
                      <Button size="sm" variant={backgroundShape === 'arch' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'arch', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Arco</Button>
                      <Button size="sm" variant={backgroundShape === 'pill' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'pill', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Pílula</Button>
                      <Button size="sm" variant={backgroundShape === 'blob' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'blob', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Orgânico</Button>
                      <Button size="sm" variant={backgroundShape === 'geometric' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'geometric', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Grid</Button>
                      <Button size="sm" variant={backgroundShape === 'frame' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'frame', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Moldura</Button>
                      <Button size="sm" variant={backgroundShape === 'offset' ? 'default' : 'outline'} onClick={() => onChange({ backgroundShape: 'offset', layoutStyle: layoutStyle === 'centered' ? 'split' : layoutStyle })} className="h-7 text-[11px]">Editorial</Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                      <Palette className="mr-1.5 size-3" /> Cores
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-fg-secondary">Filtro / Geometria</label>
                        <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                          <input type="color" value={themeColor} onChange={(e) => onChange({ themeColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                          <span className="text-[10px] uppercase text-fg-primary">{themeColor}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-fg-secondary">Caixa de Texto</label>
                        <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                          <input type="color" value={boxColor} onChange={(e) => onChange({ boxColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                          <span className="text-[10px] uppercase text-fg-primary">{boxColor}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <label className="text-[10px] text-fg-secondary">Cor do Texto Principal</label>
                        <div className="flex items-center gap-2 border border-border-subtle rounded-md p-1 bg-surface-2">
                          <input type="color" value={textColor} onChange={(e) => onChange({ textColor: e.target.value })} className="size-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                          <span className="text-[10px] uppercase text-fg-primary">{textColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-fg-muted flex items-center">
                      <Type className="mr-1.5 size-3" /> Tipografia Premium
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant={(!state.fontFamily || state.fontFamily === 'sans') ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'sans' })} className="h-7 text-[11px] font-sans">Modern (Sans)</Button>
                      <Button size="sm" variant={state.fontFamily === 'serif' ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'serif' })} className="h-7 text-[11px] font-serif">Classic (Serif)</Button>
                      <Button size="sm" variant={state.fontFamily === 'mono' ? 'default' : 'outline'} onClick={() => onChange({ fontFamily: 'mono' })} className="h-7 text-[11px] font-mono">Tech (Mono)</Button>
                    </div>

                    <div className="mt-3 border-t border-border-subtle pt-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-fg-muted">Tamanho por linha</p>
                          <p className="mt-0.5 text-[10px] text-fg-muted">O mobile acompanha a proporção automaticamente.</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-[10px] text-fg-secondary"
                          disabled={!state.bannerFontSizes}
                          onClick={() => onChange({ bannerFontSizes: undefined })}
                        >
                          <RotateCcw className="mr-1 size-3" /> Restaurar
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <FontSizeControl label="Título" value={fontSizes.title} min={24} max={96} step={2} onChange={(value) => updateFontSize("title", value)} />
                        <FontSizeControl label="Subtítulo" value={fontSizes.subtitle} min={12} max={48} step={2} onChange={(value) => updateFontSize("subtitle", value)} />
                        <FontSizeControl label="Descrição" value={fontSizes.body} min={10} max={36} onChange={(value) => updateFontSize("body", value)} />
                        <FontSizeControl label="Benefícios" value={fontSizes.benefits} min={8} max={24} onChange={(value) => updateFontSize("benefits", value)} />
                        <FontSizeControl label="Rodapé" value={fontSizes.footer} min={8} max={24} onChange={(value) => updateFontSize("footer", value)} />
                        <FontSizeControl label="Selo principal" value={fontSizes.badgePrimary} min={16} max={72} step={2} onChange={(value) => updateFontSize("badgePrimary", value)} />
                        <FontSizeControl label="Selo auxiliar" value={fontSizes.badgeSecondary} min={8} max={28} onChange={(value) => updateFontSize("badgeSecondary", value)} />
                      </div>
                    </div>
                  </div>

                </div>
              </PopoverContent>
            </Popover>

            <input type="file" multiple accept="image/*" className="hidden" ref={fileRef} onChange={handleProductChange} />
            <input type="file" accept="image/*" className="hidden" ref={bgRef} onChange={handleBackgroundChange} />

            <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="mr-1.5 size-3.5" /> Produtos
            </Button>

            <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg border-border-strong text-fg-primary hover:bg-surface-3" onClick={() => bgRef.current?.click()}>
              <Upload className="mr-1.5 size-3.5" /> Fundo
            </Button>

            {state.productImageUrl && (
              <Button size="sm" variant="ghost" onClick={() => onChange({ productImageUrl: null })} title="Remover Fundo" className="text-rose-400 hover:text-rose-500 hover:bg-rose-500/10">
                <Trash2 className="size-4" />
              </Button>
            )}

            {(state.productImages?.length || 0) > 0 && (
               <Button size="sm" variant="ghost" onClick={() => onChange({ productImages: [] })} title="Limpar Produtos" className="text-orange-400 hover:text-orange-500 hover:bg-orange-500/10">
                 <Trash2 className="size-4" />
               </Button>
            )}

            <Button size="sm" variant="ghost" className="h-8 rounded-lg bg-surface-3 text-xs font-bold text-fg-primary hover:bg-surface-2 sm:ml-2" onClick={handleRegenerate}>
              <RefreshCw className="mr-1.5 size-3.5" /> IA
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
