// src/components/briefflow/BannerPreview.tsx
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ImagePlus,
  Layers,
  LayoutTemplate,
  Palette,
  RefreshCw,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { cleanText, isEmptyLike } from "@/lib/sanitize";
import { uploadCampaignAsset } from "@/lib/supabase";
import { analyzeImageWithVisionFn } from "@/lib/vision-api";
import { renderCampaignImage } from "@/lib/imageRender";
import type { BannerFontSizes, BuilderState } from "@/types/builder";

import { DraggableImage } from "./DraggableImage";
import { Editable } from "./Editable";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  exportWrapperClass?: string;
  exportWrapperStyle?: CSSProperties;
}

type BannerFontSizeKey = keyof BannerFontSizes;

type ProductPlacement = {
  x: number;
  y: number;
  scale: number;
  width: number;
};

function normalizeHex(value: string | undefined, fallback: string): string {
  const raw = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

function contrastText(hex: string): string {
  const value = normalizeHex(hex, "#111827").slice(1);
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

function FontSizeControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5">
      <span className="text-[11px] font-medium text-fg-secondary">{label}</span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onChange(Math.max(min, value - 2))}
        >
          −
        </Button>
        <span className="w-11 text-center text-[11px] font-bold tabular-nums text-fg-primary">
          {value}px
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onChange(Math.min(max, value + 2))}
        >
          +
        </Button>
      </div>
    </div>
  );
}

function VisualAccent({
  shape,
  themeColor,
  secondaryColor,
  reverse,
}: {
  shape: BuilderState["backgroundShape"];
  themeColor: string;
  secondaryColor: string;
  reverse: boolean;
}) {
  if (!shape || shape === "minimalist" || shape === "split") return null;

  if (shape === "frame") {
    return (
      <div
        className="pointer-events-none absolute inset-7 z-[3] rounded-[26px] border"
        style={{ borderColor: `${themeColor}55` }}
      />
    );
  }

  if (shape === "diagonal" || shape === "geometric") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 z-[2] w-[38%] opacity-20",
          reverse ? "left-0" : "right-0",
        )}
        style={{
          background: `linear-gradient(145deg, ${themeColor}, ${secondaryColor})`,
          clipPath: reverse
            ? "polygon(0 0, 72% 0, 100% 100%, 0 100%)"
            : "polygon(28% 0, 100% 0, 100% 100%, 0 100%)",
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-[2] h-[520px] w-[520px] rounded-full blur-[2px]",
        reverse ? "-left-40 -bottom-72" : "-right-40 -bottom-72",
      )}
      style={{
        background: `radial-gradient(circle at 40% 35%, ${themeColor}66 0%, ${secondaryColor}18 54%, transparent 72%)`,
      }}
    />
  );
}

export function BannerPreview({
  state,
  onChange,
  exportWrapperClass,
  exportWrapperStyle,
}: Props) {
  const isExportClone = Boolean(exportWrapperClass);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [previewWidth, setPreviewWidth] = useState(1200);
  const [isRenderingVisual, setIsRenderingVisual] = useState(false);
  const [analyzingColors, setAnalyzingColors] = useState(false);

  useLayoutEffect(() => {
    if (isExportClone) return;
    const frame = previewFrameRef.current;
    if (!frame) return;
    const update = () => setPreviewWidth(Math.max(1, frame.clientWidth));
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    update();
    return () => observer.disconnect();
  }, [isExportClone]);

  const isMobileLayout =
    exportWrapperClass?.includes("force-mobile") ||
    (!isExportClone && previewWidth < 640);
  const canvasWidth = isMobileLayout ? 540 : 1200;
  const canvasHeight = isMobileLayout ? 960 : 600;
  const previewScale = isExportClone
    ? 1
    : Math.min(1, previewWidth / canvasWidth);

  const themeColor = normalizeHex(state.themeColor, "#1f4f46");
  const secondaryColor = normalizeHex(state.secondaryColor, "#0f172a");
  const textColor = normalizeHex(state.textColor, "#ffffff");
  const title = cleanText(state.title, "Uma ideia que merece atenção");
  const subtitle = cleanText(state.subtitle);
  const bodyText = cleanText(state.body);
  const cta = cleanText(state.cta);
  const footerInfo = cleanText(state.footerInfo);
  const brandName = cleanText(state.brandName);
  const badgePrimary = cleanText(state.badgePrimary);
  const badgeSecondary = cleanText(state.badgeSecondary);
  const benefits = (state.keyBenefits ?? []).filter(
    (benefit): benefit is string =>
      typeof benefit === "string" && !isEmptyLike(benefit),
  );
  const imagePrompt = cleanText(state.imagePrompt);

  const requestedLayout = state.layoutStyle ?? "split";
  const layoutStyle = ["split", "reverse", "centered", "minimalist", "diagonal"].includes(
    requestedLayout,
  )
    ? requestedLayout
    : "split";
  const isReverse = layoutStyle === "reverse";
  const isCentered = layoutStyle === "centered" || layoutStyle === "minimalist";
  const backgroundShape = state.backgroundShape ?? "minimalist";

  const legacyBackground =
    !state.backgroundImageUrl &&
    !(state.productImages?.length) &&
    !state.productSku &&
    state.productImageUrl
      ? state.productImageUrl
      : null;
  const backgroundImageUrl = state.backgroundImageUrl || legacyBackground || null;

  const productImages = useMemo(() => {
    const candidates = [
      ...(state.productImages ?? []),
      ...(!legacyBackground && state.productImageUrl
        ? [state.productImageUrl]
        : []),
    ];
    return Array.from(
      new Set(
        candidates.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        ),
      ),
    ).slice(0, 3);
  }, [legacyBackground, state.productImageUrl, state.productImages]);

  const hasProduct = productImages.length > 0;
  const effectiveCentered = isCentered && !hasProduct;
  const effectiveReverse = hasProduct && isCentered ? false : isReverse;

  const fontClass =
    state.fontFamily === "serif"
      ? "font-serif"
      : state.fontFamily === "mono"
        ? "font-mono"
        : "font-sans";
  const baseFontFamily =
    state.fontFamily === "serif"
      ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
      : state.fontFamily === "mono"
        ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  const defaultFontSizes: Required<BannerFontSizes> = {
    title: effectiveCentered ? 60 : 58,
    subtitle: 27,
    body: 19,
    benefits: 13,
    footer: 13,
    badgePrimary: 38,
    badgeSecondary: 16,
  };
  const fontSizes: Required<BannerFontSizes> = {
    ...defaultFontSizes,
    ...state.bannerFontSizes,
  };
  const mobileFactor = 0.72;
  const variables = {
    "--banner-title-size": `${fontSizes.title}px`,
    "--banner-subtitle-size": `${fontSizes.subtitle}px`,
    "--banner-body-size": `${fontSizes.body}px`,
    "--banner-benefits-size": `${fontSizes.benefits}px`,
    "--banner-footer-size": `${fontSizes.footer}px`,
    "--banner-badge-primary-size": `${fontSizes.badgePrimary}px`,
    "--banner-badge-secondary-size": `${fontSizes.badgeSecondary}px`,
    "--banner-title-mobile-size": `${Math.round(fontSizes.title * mobileFactor)}px`,
    "--banner-subtitle-mobile-size": `${Math.round(fontSizes.subtitle * 0.82)}px`,
    "--banner-body-mobile-size": `${Math.round(fontSizes.body * 0.84)}px`,
    "--banner-benefits-mobile-size": `${Math.round(fontSizes.benefits * 0.9)}px`,
    "--banner-footer-mobile-size": `${Math.round(fontSizes.footer * 0.92)}px`,
    "--banner-badge-primary-mobile-size": `${Math.round(fontSizes.badgePrimary * 0.78)}px`,
    "--banner-badge-secondary-mobile-size": `${Math.round(fontSizes.badgeSecondary * 0.88)}px`,
  } as CSSProperties;

  const updateFontSize = (key: BannerFontSizeKey, value: number) => {
    onChange({
      bannerFontSizes: {
        ...state.bannerFontSizes,
        [key]: value,
      },
    });
  };

  const productPlacement = (index: number): ProductPlacement => {
    if (isMobileLayout) {
      const placements = [
        { x: 20, y: 59, scale: 1, width: 60 },
        { x: 5, y: 67, scale: 0.9, width: 42 },
        { x: 53, y: 68, scale: 0.9, width: 42 },
      ];
      return placements[index] ?? placements[0];
    }

    if (productImages.length === 1) {
      return effectiveReverse
        ? { x: 7, y: 14, scale: 1, width: 39 }
        : { x: 57, y: 14, scale: 1, width: 39 };
    }

    const normal = [
      { x: 53, y: 19, scale: 1, width: 30 },
      { x: 73, y: 25, scale: 0.92, width: 27 },
      { x: 61, y: 4, scale: 0.78, width: 23 },
    ];
    const reverse = [
      { x: 7, y: 19, scale: 1, width: 30 },
      { x: 24, y: 25, scale: 0.92, width: 27 },
      { x: 16, y: 4, scale: 0.78, width: 23 },
    ];
    return (effectiveReverse ? reverse : normal)[index] ?? normal[0];
  };

  const handleProductChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const toastId = toast.loading(`Enviando ${files.length} imagem(ns) de produto...`);
    try {
      const urls: string[] = [];
      for (const file of files) {
        urls.push(await uploadCampaignAsset(file, "products"));
      }
      onChange({ productImages: [...(state.productImages ?? []), ...urls] });
      toast.success("Produto adicionado ao banner.", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível enviar a imagem do produto.", { id: toastId });
    }
    event.target.value = "";
  };

  const handleBackgroundChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading("Enviando o fundo do banner...");
    try {
      const url = await uploadCampaignAsset(file, "backgrounds");
      onChange({ backgroundImageUrl: url });
      setAnalyzingColors(true);
      const vision = await analyzeImageWithVisionFn({ data: { imageUrl: url } });
      if (vision.primaryBrandColor) {
        onChange({
          backgroundImageUrl: url,
          themeColor: vision.primaryBrandColor,
          secondaryColor: vision.secondaryBrandColor || secondaryColor,
        });
      }
      toast.success("Fundo aplicado.", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível enviar o fundo.", { id: toastId });
    } finally {
      setAnalyzingColors(false);
      event.target.value = "";
    }
  };

  const handleRegenerateVisual = async () => {
    if (!imagePrompt) {
      toast.error("Este banner ainda não possui direção visual para regenerar.");
      return;
    }
    setIsRenderingVisual(true);
    const toastId = toast.loading("Criando um novo key visual...");
    try {
      const rendered = await renderCampaignImage({
        prompt: imagePrompt,
        aspectRatio: "16:9",
        imageSize: "1K",
      });
      onChange({
        backgroundImageUrl: rendered.url,
        imageSeed: Math.floor(Math.random() * 1_000_000),
      });
      toast.success("Novo visual aplicado ao banner.", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível gerar um novo visual agora.", { id: toastId });
    } finally {
      setIsRenderingVisual(false);
    }
  };

  const fallbackBackground = `linear-gradient(118deg, ${secondaryColor} 0%, ${themeColor} 58%, ${secondaryColor} 118%)`;
  const textOverlay = effectiveCentered
    ? "linear-gradient(90deg, rgba(3,7,18,.68) 0%, rgba(3,7,18,.46) 48%, rgba(3,7,18,.58) 100%)"
    : effectiveReverse
      ? "linear-gradient(270deg, rgba(3,7,18,.9) 0%, rgba(3,7,18,.78) 38%, rgba(3,7,18,.18) 68%, rgba(3,7,18,0) 100%)"
      : "linear-gradient(90deg, rgba(3,7,18,.9) 0%, rgba(3,7,18,.78) 38%, rgba(3,7,18,.18) 68%, rgba(3,7,18,0) 100%)";

  const ctaBackground = themeColor;
  const ctaTextColor = contrastText(ctaBackground);

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
              width: canvasWidth,
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
            }}
          >
            <div
              id="banner-export-node"
              data-export-node="banner"
              className={cn(
                "relative isolate overflow-hidden bg-slate-950",
                !isExportClone && "rounded-[22px] shadow-[0_24px_50px_-18px_rgba(0,0,0,0.55)]",
                fontClass,
                exportWrapperClass,
                isMobileLayout && "force-mobile",
              )}
              style={{
                height: canvasHeight,
                width: canvasWidth,
                fontFamily: baseFontFamily,
                background: fallbackBackground,
                ...variables,
                ...exportWrapperStyle,
              }}
            >
              {backgroundImageUrl && (
                <img
                  src={backgroundImageUrl}
                  alt=""
                  crossOrigin="anonymous"
                  className="absolute inset-0 z-0 h-full w-full object-cover"
                  style={{
                    objectPosition: effectiveCentered
                      ? "center"
                      : effectiveReverse
                        ? "left center"
                        : "right center",
                  }}
                />
              )}

              {!backgroundImageUrl && (
                <>
                  <div
                    className="pointer-events-none absolute -right-[8%] top-[-35%] z-[1] h-[125%] w-[62%] rounded-full opacity-35 blur-3xl"
                    style={{ backgroundColor: themeColor }}
                  />
                  <div
                    className="pointer-events-none absolute bottom-[-55%] left-[16%] z-[1] h-[95%] w-[55%] rounded-full opacity-20 blur-3xl"
                    style={{ backgroundColor: "#ffffff" }}
                  />
                </>
              )}

              <div
                className="pointer-events-none absolute inset-0 z-[2]"
                style={{ background: textOverlay }}
              />

              <VisualAccent
                shape={backgroundShape}
                themeColor={themeColor}
                secondaryColor={secondaryColor}
                reverse={effectiveReverse}
              />

              {hasProduct && (
                <div
                  className={cn(
                    "pointer-events-none absolute z-[18] rounded-full blur-3xl",
                    isMobileLayout
                      ? "bottom-[8%] left-[12%] h-[33%] w-[76%]"
                      : effectiveReverse
                        ? "left-[2%] top-[15%] h-[68%] w-[45%]"
                        : "right-[2%] top-[15%] h-[68%] w-[45%]",
                  )}
                  style={{
                    background: `radial-gradient(circle, ${themeColor}55 0%, transparent 70%)`,
                  }}
                />
              )}

              <div className="banner-product-layer absolute inset-0 z-30 pointer-events-none [&>*]:pointer-events-auto">
                {productImages.map((src, index) => {
                  const placement = productPlacement(index);
                  return (
                    <DraggableImage
                      key={`${src}-${index}`}
                      src={src}
                      type="banner"
                      isExport={isExportClone}
                      defaultPosition={{
                        x: placement.x,
                        y: placement.y,
                        scale: placement.scale,
                      }}
                      baseWidth={placement.width}
                    />
                  );
                })}
              </div>

              <div
                className={cn(
                  "absolute z-40 flex flex-col",
                  effectiveCentered
                    ? "inset-0 items-center justify-center px-20 text-center"
                    : isMobileLayout
                      ? "left-0 right-0 top-0 min-h-[55%] items-center justify-center px-10 py-12 text-center"
                      : effectiveReverse
                        ? "right-0 top-0 h-full w-[48%] items-end justify-center px-16 py-12 text-right"
                        : "left-0 top-0 h-full w-[48%] items-start justify-center px-16 py-12 text-left",
                )}
              >
                <div
                  className={cn(
                    "flex w-full flex-col",
                    effectiveCentered
                      ? "max-w-[800px] items-center"
                      : effectiveReverse
                        ? "max-w-[520px] items-end"
                        : "max-w-[520px] items-start",
                    isMobileLayout && "max-w-[470px] items-center",
                  )}
                >
                  {brandName && (
                    <div
                      className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-[0.16em]"
                      style={{
                        borderColor: `${textColor}30`,
                        backgroundColor: `${secondaryColor}55`,
                        color: textColor,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: themeColor }}
                      />
                      <span className="truncate">{brandName}</span>
                    </div>
                  )}

                  <Editable
                    as="h2"
                    value={title}
                    onChange={(value) => onChange({ title: value })}
                    className="banner-title-text max-w-full text-balance font-extrabold leading-[0.98] tracking-[-0.045em]"
                    style={{
                      color: textColor,
                      fontSize: fontSizes.title,
                      textShadow: "0 3px 24px rgba(0,0,0,.3)",
                    }}
                  />

                  {!isEmptyLike(subtitle) && (
                    <Editable
                      as="p"
                      multiline
                      value={subtitle}
                      onChange={(value) => onChange({ subtitle: value })}
                      className="banner-subtitle-text mt-5 max-w-[94%] font-semibold leading-[1.25]"
                      style={{
                        color: textColor,
                        fontSize: fontSizes.subtitle,
                        opacity: 0.96,
                      }}
                    />
                  )}

                  {!isEmptyLike(bodyText) && (
                    <Editable
                      as="p"
                      multiline
                      value={bodyText}
                      onChange={(value) => onChange({ body: value })}
                      className="banner-body-text mt-3 max-w-[92%] leading-[1.45]"
                      style={{
                        color: textColor,
                        fontSize: fontSizes.body,
                        opacity: 0.82,
                      }}
                    />
                  )}

                  {benefits.length > 0 && (
                    <div
                      className={cn(
                        "mt-5 flex flex-wrap gap-2",
                        effectiveCentered || isMobileLayout
                          ? "justify-center"
                          : effectiveReverse
                            ? "justify-end"
                            : "justify-start",
                      )}
                    >
                      {benefits.map((benefit) => (
                        <span
                          key={benefit}
                          className="banner-benefit-text rounded-full border px-3.5 py-2 font-semibold"
                          style={{
                            borderColor: `${textColor}2E`,
                            backgroundColor: `${secondaryColor}66`,
                            color: textColor,
                            fontSize: fontSizes.benefits,
                          }}
                        >
                          {benefit}
                        </span>
                      ))}
                    </div>
                  )}

                  {!isEmptyLike(cta) && (
                    <div
                      className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3.5 text-[17px] font-extrabold shadow-[0_12px_30px_-12px_rgba(0,0,0,.55)]"
                      style={{
                        backgroundColor: ctaBackground,
                        color: ctaTextColor,
                      }}
                    >
                      <Editable
                        as="span"
                        value={cta}
                        onChange={(value) => onChange({ cta: value })}
                        style={{ color: ctaTextColor }}
                      />
                    </div>
                  )}

                  {!isEmptyLike(footerInfo) && (
                    <Editable
                      as="p"
                      value={footerInfo}
                      onChange={(value) => onChange({ footerInfo: value })}
                      className="banner-footer-text mt-5 max-w-[95%] leading-snug"
                      style={{
                        color: textColor,
                        fontSize: fontSizes.footer,
                        opacity: 0.62,
                      }}
                    />
                  )}
                </div>
              </div>

              {(badgePrimary || badgeSecondary) && (
                <div
                  className={cn(
                    "absolute z-50 flex flex-col gap-2",
                    isMobileLayout
                      ? "bottom-8 right-7 items-end"
                      : effectiveReverse
                        ? "bottom-10 left-10 items-start"
                        : "bottom-10 right-10 items-end",
                  )}
                >
                  {badgePrimary && (
                    <div
                      className="flex min-h-[104px] min-w-[104px] max-w-[150px] items-center justify-center rounded-full border-4 px-4 text-center shadow-[0_18px_38px_-14px_rgba(0,0,0,.6)]"
                      style={{
                        backgroundColor: themeColor,
                        borderColor: `${textColor}E6`,
                        color: contrastText(themeColor),
                      }}
                    >
                      <Editable
                        as="span"
                        value={badgePrimary}
                        onChange={(value) => onChange({ badgePrimary: value })}
                        className="banner-badge-primary-text font-black leading-[0.95] tracking-[-0.04em]"
                        style={{
                          color: contrastText(themeColor),
                          fontSize: fontSizes.badgePrimary,
                        }}
                      />
                    </div>
                  )}
                  {badgeSecondary && (
                    <div
                      className="rounded-lg border px-3.5 py-2 text-center font-bold"
                      style={{
                        backgroundColor: `${secondaryColor}DD`,
                        borderColor: `${textColor}33`,
                        color: textColor,
                      }}
                    >
                      <Editable
                        as="span"
                        value={badgeSecondary}
                        onChange={(value) => onChange({ badgeSecondary: value })}
                        className="banner-badge-secondary-text"
                        style={{
                          color: textColor,
                          fontSize: fontSizes.badgeSecondary,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isExportClone && (
        <div className="editor-toolbar mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-1/85 p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
            <span className="rounded bg-brand/10 px-2 py-1 text-brand">BANNER</span>
            {isRenderingVisual && <span className="animate-pulse">Gerando visual…</span>}
            {analyzingColors && <span className="animate-pulse">Lendo paleta…</span>}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => productInputRef.current?.click()}
            >
              <Upload className="mr-1.5 size-3.5" /> Produto
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => backgroundInputRef.current?.click()}
            >
              <ImagePlus className="mr-1.5 size-3.5" /> Fundo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={isRenderingVisual || !imagePrompt}
              onClick={handleRegenerateVisual}
            >
              <RefreshCw
                className={cn("mr-1.5 size-3.5", isRenderingVisual && "animate-spin")}
              />
              Gerar visual
            </Button>

            {backgroundImageUrl && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                title="Remover fundo"
                onClick={() => onChange({ backgroundImageUrl: null })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  <Palette className="mr-1.5 size-3.5" /> Design
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="mb-2 max-h-[calc(100vh-96px)] w-[min(390px,calc(100vw-24px))] overflow-y-auto rounded-2xl border-border-strong bg-surface-1 p-4 shadow-[var(--shadow-elevated)]"
              >
                <div className="space-y-5">
                  <div className="space-y-2">
                    <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                      <LayoutTemplate className="mr-1.5 size-3" /> Composição
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["split", "Esquerda"],
                        ["reverse", "Direita"],
                        ["centered", "Centro"],
                      ] as const).map(([value, label]) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={layoutStyle === value ? "default" : "outline"}
                          className="h-7 text-[11px]"
                          onClick={() => onChange({ layoutStyle: value })}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                      <Layers className="mr-1.5 size-3" /> Tratamento
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        ["minimalist", "Clean"],
                        ["diagonal", "Diagonal"],
                        ["frame", "Moldura"],
                        ["curve", "Curva"],
                      ] as const).map(([value, label]) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={backgroundShape === value ? "default" : "outline"}
                          className="h-7 px-2 text-[10px]"
                          onClick={() => onChange({ backgroundShape: value })}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                      <Palette className="mr-1.5 size-3" /> Paleta
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        ["themeColor", "Marca", themeColor],
                        ["secondaryColor", "Base", secondaryColor],
                        ["textColor", "Texto", textColor],
                      ] as const).map(([key, label, value]) => (
                        <label key={key} className="space-y-1 text-[10px] text-fg-muted">
                          <span>{label}</span>
                          <input
                            type="color"
                            value={value}
                            className="h-9 w-full cursor-pointer rounded-lg border border-border-subtle bg-transparent p-1"
                            onChange={(event) => onChange({ [key]: event.target.value })}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                      <Type className="mr-1.5 size-3" /> Tipografia
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["sans", "Sans"],
                        ["serif", "Serif"],
                        ["mono", "Mono"],
                      ] as const).map(([value, label]) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={(state.fontFamily ?? "sans") === value ? "default" : "outline"}
                          className="h-7 text-[11px]"
                          onClick={() => onChange({ fontFamily: value })}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <FontSizeControl
                        label="Título"
                        value={fontSizes.title}
                        min={34}
                        max={82}
                        onChange={(value) => updateFontSize("title", value)}
                      />
                      <FontSizeControl
                        label="Apoio"
                        value={fontSizes.subtitle}
                        min={16}
                        max={38}
                        onChange={(value) => updateFontSize("subtitle", value)}
                      />
                      <FontSizeControl
                        label="Corpo"
                        value={fontSizes.body}
                        min={13}
                        max={28}
                        onChange={(value) => updateFontSize("body", value)}
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <input
            ref={productInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleProductChange}
          />
          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBackgroundChange}
          />
        </div>
      )}
    </div>
  );
}
