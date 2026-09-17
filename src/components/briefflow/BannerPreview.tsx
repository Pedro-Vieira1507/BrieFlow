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

import { Editable } from "./Editable";
import { PremiumProductImage } from "./PremiumProductImage";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
  exportWrapperClass?: string;
  exportWrapperStyle?: CSSProperties;
}

type BannerFontSizeKey = keyof BannerFontSizes;
type ProductDisplayMode = "hero" | "gallery";
type PremiumBannerState = BuilderState & {
  productDisplayMode?: ProductDisplayMode;
};
type PremiumBannerPatch = Partial<BuilderState> & {
  productDisplayMode?: ProductDisplayMode;
};

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

function normalizeIntent(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferProductDisplayMode(
  state: PremiumBannerState,
  productCount: number,
): ProductDisplayMode {
  if (state.productDisplayMode) return state.productDisplayMode;
  if (productCount < 2) return "hero";

  const context = normalizeIntent(
    [
      state.title,
      state.subtitle,
      state.body,
      state.footerInfo,
      ...(state.keyBenefits ?? []),
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" "),
  );

  return /\b(?:linha|colecao|portfolio|vitrine|comparacao|compare|kit|selecao|varios produtos|multiplos produtos|tres produtos|3 produtos|modelos)\b/.test(
    context,
  )
    ? "gallery"
    : "hero";
}

function rankProductImages(
  candidates: string[],
  preferred?: string | null,
): string[] {
  const unique = Array.from(
    new Set(
      candidates.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      ),
    ),
  );

  return unique
    .map((url, index) => {
      let score = 500 - index;
      const normalized = url.toLowerCase();
      if (preferred && url === preferred) score += 1000;
      if (/campaign-assets.*products|\/products\//i.test(url)) score += 650;
      if (/original|large|zoom|1200|1400|1500|1600|2000|2048/i.test(url)) {
        score += 90;
      }
      if (/thumb|thumbnail|small|mini|icon|sprite/i.test(normalized)) score -= 300;
      if (url.startsWith("data:") || url.startsWith("blob:")) score += 700;
      return { url, score };
    })
    .sort((left, right) => right.score - left.score)
    .map(({ url }) => url);
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

function PremiumAccent({
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
        className="pointer-events-none absolute inset-7 z-[4] rounded-[26px] border"
        style={{ borderColor: `${themeColor}55` }}
      />
    );
  }

  if (shape === "diagonal" || shape === "geometric") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 z-[3] w-[34%] opacity-[0.16]",
          reverse ? "left-0" : "right-0",
        )}
        style={{
          background: `linear-gradient(145deg, ${themeColor}, ${secondaryColor})`,
          clipPath: reverse
            ? "polygon(0 0, 70% 0, 100% 100%, 0 100%)"
            : "polygon(30% 0, 100% 0, 100% 100%, 0 100%)",
        }}
      />
    );
  }

  return null;
}

export function BannerPreview({
  state,
  onChange,
  exportWrapperClass,
  exportWrapperStyle,
}: Props) {
  const premiumState = state as PremiumBannerState;
  const isExportClone = Boolean(exportWrapperClass);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [previewWidth, setPreviewWidth] = useState(1200);
  const [isRenderingVisual, setIsRenderingVisual] = useState(false);
  const [analyzingColors, setAnalyzingColors] = useState(false);

  const patchState = (patch: PremiumBannerPatch) => {
    onChange(patch as Partial<BuilderState>);
  };

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
  const benefits = (state.keyBenefits ?? [])
    .filter(
      (benefit): benefit is string =>
        typeof benefit === "string" && !isEmptyLike(benefit),
    )
    .slice(0, 2);
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
  const backgroundImageUrl = state.backgroundImageUrl || null;

  const productImages = useMemo(() => {
    const candidates = [
      ...(state.productImages ?? []),
      ...(state.productImageUrl ? [state.productImageUrl] : []),
    ];
    return rankProductImages(candidates, state.productImageUrl);
  }, [state.productImageUrl, state.productImages]);

  const productDisplayMode = inferProductDisplayMode(
    premiumState,
    productImages.length,
  );
  const visibleProductImages =
    productDisplayMode === "gallery"
      ? productImages.slice(0, 3)
      : productImages.slice(0, 1);
  const hasProduct = visibleProductImages.length > 0;
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
    badgePrimary: 22,
    badgeSecondary: 14,
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
  } as CSSProperties;

  const updateFontSize = (key: BannerFontSizeKey, value: number) => {
    patchState({
      bannerFontSizes: {
        ...state.bannerFontSizes,
        [key]: value,
      },
    });
  };

  const productPlacement = (index: number): ProductPlacement => {
    if (isMobileLayout) {
      if (productDisplayMode === "hero") {
        return { x: 18, y: 58, scale: 1, width: 64 };
      }
      const gallery = [
        { x: 19, y: 58, scale: 1, width: 45 },
        { x: 4, y: 70, scale: 0.84, width: 34 },
        { x: 58, y: 70, scale: 0.84, width: 34 },
      ];
      return gallery[index] ?? gallery[0];
    }

    if (productDisplayMode === "hero") {
      return effectiveReverse
        ? { x: 5, y: 10, scale: 1, width: 43 }
        : { x: 55, y: 10, scale: 1, width: 43 };
    }

    const normal = [
      { x: 58, y: 12, scale: 1, width: 31 },
      { x: 76, y: 28, scale: 0.84, width: 24 },
      { x: 49, y: 31, scale: 0.78, width: 23 },
    ];
    const reverse = [
      { x: 8, y: 12, scale: 1, width: 31 },
      { x: 1, y: 29, scale: 0.84, width: 24 },
      { x: 28, y: 31, scale: 0.78, width: 23 },
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
      const existing = productImages.filter((url) => !urls.includes(url));
      patchState({
        productImageUrl: urls[0],
        productImages: [...urls, ...existing],
        productDisplayMode: "hero",
      });
      toast.success(
        files.length > 1
          ? "Imagens adicionadas. A primeira foi definida como produto principal."
          : "Produto principal atualizado.",
        { id: toastId },
      );
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
      patchState({ backgroundImageUrl: url });
      toast.success("Fundo aplicado.", { id: toastId });

      setAnalyzingColors(true);
      try {
        const vision = await analyzeImageWithVisionFn({ data: { imageUrl: url } });
        if (vision.primaryBrandColor) {
          patchState({
            themeColor: vision.primaryBrandColor,
            secondaryColor: vision.secondaryBrandColor || secondaryColor,
          });
        }
      } catch (visionError) {
        console.warn("Fundo aplicado sem leitura automática de paleta.", visionError);
      }
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
      const productAwarePrompt = hasProduct
        ? `${imagePrompt}, create one coherent background scene only, reserve the product zone, no collage, no thumbnail grid, do not redraw or duplicate the real product`
        : `${imagePrompt}, create one coherent advertising scene, no collage, no thumbnail grid`;
      const rendered = await renderCampaignImage({
        prompt: productAwarePrompt,
        aspectRatio: "16:9",
        imageSize: "1K",
      });
      patchState({
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

  const fallbackBackground = `linear-gradient(118deg, ${secondaryColor} 0%, ${themeColor} 64%, ${secondaryColor} 118%)`;
  const textOverlay = effectiveCentered
    ? "linear-gradient(90deg, rgba(3,7,18,.64) 0%, rgba(3,7,18,.42) 50%, rgba(3,7,18,.64) 100%)"
    : effectiveReverse
      ? "linear-gradient(270deg, rgba(3,7,18,.92) 0%, rgba(3,7,18,.76) 39%, rgba(3,7,18,.18) 67%, rgba(3,7,18,0) 100%)"
      : "linear-gradient(90deg, rgba(3,7,18,.92) 0%, rgba(3,7,18,.76) 39%, rgba(3,7,18,.18) 67%, rgba(3,7,18,0) 100%)";
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
              data-product-mode={productDisplayMode}
              className={cn(
                "relative isolate overflow-hidden bg-slate-950",
                !isExportClone &&
                  "rounded-[22px] shadow-[0_24px_50px_-18px_rgba(0,0,0,0.55)]",
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
                    className="pointer-events-none absolute -right-[10%] top-[-38%] z-[1] h-[128%] w-[60%] rounded-full opacity-30 blur-3xl"
                    style={{ backgroundColor: themeColor }}
                  />
                  <div
                    className="pointer-events-none absolute bottom-[-60%] left-[15%] z-[1] h-[95%] w-[54%] rounded-full opacity-[0.14] blur-3xl"
                    style={{ backgroundColor: "#ffffff" }}
                  />
                </>
              )}

              <div
                className="pointer-events-none absolute inset-0 z-[2]"
                style={{ background: textOverlay }}
              />
              <div className="pointer-events-none absolute inset-0 z-[3] bg-[radial-gradient(circle_at_50%_110%,rgba(255,255,255,0.10),transparent_42%)]" />

              <PremiumAccent
                shape={backgroundShape}
                themeColor={themeColor}
                secondaryColor={secondaryColor}
                reverse={effectiveReverse}
              />

              {hasProduct && (
                <>
                  <div
                    className={cn(
                      "pointer-events-none absolute z-[18] blur-3xl",
                      isMobileLayout
                        ? "bottom-[5%] left-[10%] h-[35%] w-[80%]"
                        : effectiveReverse
                          ? "left-[1%] top-[10%] h-[76%] w-[48%]"
                          : "right-[1%] top-[10%] h-[76%] w-[48%]",
                    )}
                    style={{
                      background: `radial-gradient(ellipse at center, ${themeColor}4A 0%, transparent 70%)`,
                    }}
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute z-[19] h-[8%] rounded-[50%] blur-xl",
                      isMobileLayout
                        ? "bottom-[8%] left-[21%] w-[58%]"
                        : effectiveReverse
                          ? "bottom-[12%] left-[8%] w-[34%]"
                          : "bottom-[12%] right-[8%] w-[34%]",
                    )}
                    style={{ background: "rgba(2,6,23,.34)" }}
                  />
                </>
              )}

              <div className="banner-product-layer absolute inset-0 z-30 pointer-events-none [&>*]:pointer-events-auto">
                {visibleProductImages.map((src, index) => {
                  const placement = productPlacement(index);
                  return (
                    <PremiumProductImage
                      key={`${src}-${index}`}
                      src={src}
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
                        ? "right-0 top-0 h-full w-[47%] items-end justify-center px-16 py-12 text-right"
                        : "left-0 top-0 h-full w-[47%] items-start justify-center px-16 py-12 text-left",
                )}
              >
                <div
                  className={cn(
                    "flex w-full flex-col",
                    effectiveCentered
                      ? "max-w-[820px] items-center"
                      : effectiveReverse
                        ? "max-w-[510px] items-end"
                        : "max-w-[510px] items-start",
                    isMobileLayout && "max-w-[470px] items-center",
                  )}
                >
                  {brandName && (
                    <div
                      className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold uppercase tracking-[0.16em]"
                      style={{
                        borderColor: `${textColor}2E`,
                        backgroundColor: `${secondaryColor}66`,
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
                    onChange={(value) => patchState({ title: value })}
                    className="banner-title-text max-w-full text-balance font-extrabold leading-[0.98] tracking-[-0.045em]"
                    style={{
                      color: textColor,
                      fontSize: fontSizes.title,
                      textShadow: "0 3px 24px rgba(0,0,0,.28)",
                    }}
                  />

                  {!isEmptyLike(subtitle) && (
                    <Editable
                      as="p"
                      multiline
                      value={subtitle}
                      onChange={(value) => patchState({ subtitle: value })}
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
                      onChange={(value) => patchState({ body: value })}
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
                        onChange={(value) => patchState({ cta: value })}
                        style={{ color: ctaTextColor }}
                      />
                    </div>
                  )}

                  {!isEmptyLike(footerInfo) && (
                    <Editable
                      as="p"
                      value={footerInfo}
                      onChange={(value) => patchState({ footerInfo: value })}
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
                    "absolute z-50 flex max-w-[260px] flex-col gap-2",
                    isMobileLayout
                      ? "bottom-7 right-7 items-end"
                      : effectiveReverse
                        ? "bottom-9 left-9 items-start"
                        : "bottom-9 right-9 items-end",
                  )}
                >
                  {badgePrimary && (
                    <div
                      className="rounded-full border px-4 py-2.5 text-center font-black shadow-[0_12px_28px_-14px_rgba(0,0,0,.55)]"
                      style={{
                        backgroundColor: themeColor,
                        borderColor: `${textColor}42`,
                        color: contrastText(themeColor),
                        fontSize: fontSizes.badgePrimary,
                      }}
                    >
                      <Editable
                        as="span"
                        value={badgePrimary}
                        onChange={(value) => patchState({ badgePrimary: value })}
                        style={{ color: contrastText(themeColor) }}
                      />
                    </div>
                  )}
                  {badgeSecondary && (
                    <div
                      className="rounded-full border px-3.5 py-2 text-center font-bold"
                      style={{
                        backgroundColor: `${secondaryColor}D9`,
                        borderColor: `${textColor}2E`,
                        color: textColor,
                        fontSize: fontSizes.badgeSecondary,
                      }}
                    >
                      <Editable
                        as="span"
                        value={badgeSecondary}
                        onChange={(value) => patchState({ badgeSecondary: value })}
                        style={{ color: textColor }}
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
            {hasProduct && (
              <span>{productDisplayMode === "hero" ? "Produto hero" : "Vitrine"}</span>
            )}
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
                onClick={() => patchState({ backgroundImageUrl: null })}
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
                className="mb-2 max-h-[calc(100vh-96px)] w-[min(410px,calc(100vw-24px))] overflow-y-auto rounded-2xl border-border-strong bg-surface-1 p-4 shadow-[var(--shadow-elevated)]"
              >
                <div className="space-y-5">
                  {productImages.length > 1 && (
                    <div className="space-y-2">
                      <h4 className="flex items-center text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                        <Layers className="mr-1.5 size-3" /> Produtos
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant={productDisplayMode === "hero" ? "default" : "outline"}
                          className="h-7 text-[11px]"
                          onClick={() => patchState({ productDisplayMode: "hero" })}
                        >
                          Hero único
                        </Button>
                        <Button
                          size="sm"
                          variant={productDisplayMode === "gallery" ? "default" : "outline"}
                          className="h-7 text-[11px]"
                          onClick={() => patchState({ productDisplayMode: "gallery" })}
                        >
                          Vitrine
                        </Button>
                      </div>
                      <p className="text-[10px] leading-4 text-fg-muted">
                        Use vitrine apenas quando a campanha realmente precisar mostrar vários produtos ou ângulos.
                      </p>
                    </div>
                  )}

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
                          onClick={() => patchState({ layoutStyle: value })}
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
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["minimalist", "Clean"],
                        ["diagonal", "Diagonal"],
                        ["frame", "Moldura"],
                      ] as const).map(([value, label]) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={backgroundShape === value ? "default" : "outline"}
                          className="h-7 px-2 text-[10px]"
                          onClick={() => patchState({ backgroundShape: value })}
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
                            onChange={(event) =>
                              patchState({ [key]: event.target.value } as PremiumBannerPatch)
                            }
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
                          onClick={() => patchState({ fontFamily: value })}
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
