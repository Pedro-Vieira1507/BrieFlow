import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Download,
  FileCode,
  FileText,
  Loader2,
  Monitor,
  Smartphone,
} from "lucide-react";
import { toJpeg, toPng } from "html-to-image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildSocialExportText,
  calculatePreviewScale,
  downloadBlob,
  escapeHtml,
  finishExport,
  sanitizeFilenamePart,
  serializeElementWithInlineStyles,
  triggerDownload,
  waitForExportAssets,
} from "@/lib/export-utils";
import { cn } from "@/lib/utils";

import type { BuilderState } from "@/types/builder";
import type { CoreMaterialType } from "@/types/brief";
import { BannerPreview } from "./BannerPreview";
import { EmailPreview } from "./EmailPreview";
import { SocialPreview } from "./SocialPreview";

type ExportTab = CoreMaterialType;
type ExportFormat = "png" | "jpg";
type ExportSize = { width: number; height: number };

const DEFAULT_SOURCE_SIZES: Record<ExportTab, ExportSize> = {
  banner: { width: 1200, height: 600 },
  email: { width: 600, height: 800 },
  social: { width: 420, height: 525 },
};

interface ExportPreviewFrameProps extends ExportSize {
  children: ReactNode;
  fit?: "contain" | "width";
}

function ExportPreviewFrame({
  children,
  fit = "contain",
  height,
  width,
}: ExportPreviewFrameProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentSize, setContentSize] = useState<ExportSize>({ width, height });
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const updateLayout = () => {
      const exportNode =
        content.querySelector<HTMLElement>("[data-export-node]");
      const nextSize = {
        width: Math.max(
          width,
          exportNode?.offsetWidth ?? 0,
          exportNode?.scrollWidth ?? 0,
        ),
        height: Math.max(
          height,
          exportNode?.offsetHeight ?? 0,
          exportNode?.scrollHeight ?? 0,
        ),
      };
      const availableWidth = Math.max(1, viewport.clientWidth - 32);
      const availableHeight = Math.max(1, viewport.clientHeight - 32);
      const nextScale = calculatePreviewScale({
        availableHeight,
        availableWidth,
        contentHeight: nextSize.height,
        contentWidth: nextSize.width,
        fitHeight: fit === "contain",
      });

      setContentSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize,
      );
      setScale((current) =>
        Math.abs(current - nextScale) < 0.001 ? current : nextScale,
      );
    };

    const resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(viewport);
    const exportNode = content.querySelector<HTMLElement>("[data-export-node]");
    if (exportNode) resizeObserver.observe(exportNode);
    const frame = window.requestAnimationFrame(updateLayout);
    window.addEventListener("resize", updateLayout);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateLayout);
    };
  }, [fit, height, width]);

  return (
    <div
      ref={viewportRef}
      className={cn(
        "flex min-h-0 w-full flex-1 items-start justify-center p-2 sm:p-4",
        fit === "contain" ? "overflow-hidden" : "overflow-auto",
      )}
    >
      <div
        className="relative shrink-0"
        style={{
          height: contentSize.height * scale,
          width: contentSize.width * scale,
        }}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 origin-top-left"
          style={{
            minHeight: contentSize.height,
            pointerEvents: "none",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: contentSize.width,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

interface DesignExporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state?: BuilderState;
  initialTab?: ExportTab;
  onExportingChange?: (isExporting: boolean) => void;
}

function getAssetState(
  state: BuilderState | undefined,
  type: ExportTab,
): BuilderState | undefined {
  if (!state) return undefined;
  if (state.type === "campaign") {
    return state.campaignAssets?.find((asset) => asset.type === type)?.content;
  }
  return state.type === type ? state : undefined;
}

function getInitialTab(
  state: BuilderState | undefined,
  requested?: ExportTab,
): ExportTab {
  if (requested && getAssetState(state, requested)) return requested;
  if (
    state?.type === "banner" ||
    state?.type === "email" ||
    state?.type === "social"
  ) {
    return state.type;
  }
  if (state?.type === "campaign") {
    const asset = state.campaignAssets?.find((candidate) =>
      ["banner", "email", "social"].includes(candidate.type),
    );
    return asset ? (asset.type as ExportTab) : "banner";
  }
  return "banner";
}

export function DesignExporter({
  open,
  onOpenChange,
  state,
  initialTab,
  onExportingChange,
}: DesignExporterProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<ExportTab>(() =>
    getInitialTab(state, initialTab),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [sourceSizes, setSourceSizes] = useState(DEFAULT_SOURCE_SIZES);

  const bannerRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const socialRef = useRef<HTMLDivElement>(null);
  const isExportingRef = useRef(false);

  const bannerState = getAssetState(state, "banner");
  const emailState = getAssetState(state, "email");
  const socialState = getAssetState(state, "social");

  useEffect(() => {
    if (open) setActiveTab(getInitialTab(state, initialTab));
  }, [initialTab, open, state]);

  useLayoutEffect(() => {
    if (!open) return;

    const measureSourceCanvases = () => {
      const exportContainers = [
        bannerRef.current,
        emailRef.current,
        socialRef.current,
      ];
      const nextSizes = { ...DEFAULT_SOURCE_SIZES };

      (["banner", "email", "social"] as ExportTab[]).forEach((tab) => {
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>(`[data-export-node="${tab}"]`),
        );
        const sourceNode = candidates.find(
          (candidate) =>
            candidate.offsetParent !== null &&
            !exportContainers.some((container) =>
              container?.contains(candidate),
            ),
        );
        if (!sourceNode) return;

        const rect = sourceNode.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          nextSizes[tab] = {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }
      });

      setSourceSizes(nextSizes);
    };

    const frame = window.requestAnimationFrame(measureSourceCanvases);
    return () => window.cancelAnimationFrame(frame);
  }, [open, state]);

  const setExporting = (next: boolean) => {
    isExportingRef.current = next;
    setIsExporting(next);
    onExportingChange?.(next);
  };

  const beginExport = () => {
    if (isExportingRef.current) return false;
    setExporting(true);
    return true;
  };

  const getExportNode = (tab: ExportTab): HTMLElement | null => {
    const container =
      tab === "banner"
        ? bannerRef.current
        : tab === "email"
          ? emailRef.current
          : socialRef.current;
    return container?.querySelector<HTMLElement>(`#${tab}-export-node`) ?? null;
  };

  const handleExportImage = async (format: ExportFormat) => {
    if (!beginExport()) return;

    const toastId = toast.loading(
      `Renderizando ${activeTab === "banner" ? "o banner" : "a arte social"} em ${format.toUpperCase()}...`,
    );
    let exportNode: HTMLElement | null = null;

    try {
      if (activeTab === "email") {
        throw new Error("A exportação de e-mail está disponível em HTML.");
      }

      exportNode = getExportNode(activeTab);
      if (!exportNode) {
        throw new Error(
          "Arte não encontrada. Verifique se o design foi gerado.",
        );
      }

      await waitForExportAssets(exportNode);

      const width = Math.ceil(
        Math.max(exportNode.offsetWidth, exportNode.scrollWidth),
      );
      const height = Math.ceil(
        Math.max(exportNode.offsetHeight, exportNode.scrollHeight),
      );
      const currentState = activeTab === "banner" ? bannerState : socialState;
      const brandSlug = sanitizeFilenamePart(currentState?.brandName);
      const targetWidth =
        activeTab === "social"
          ? 1080
          : device === "mobile"
            ? format === "png"
              ? 1080
              : 540
            : format === "png"
              ? 2400
              : 1200;
      const pixelRatio = targetWidth / width;
      const backgroundColor =
        currentState?.boxColor || (format === "jpg" ? "#ffffff" : undefined);

      const options: NonNullable<Parameters<typeof toPng>[1]> = {
        width,
        height,
        pixelRatio,
        backgroundColor,
        cacheBust: true,
        includeQueryParams: true,
        quality: format === "jpg" ? 0.88 : undefined,
        filter: (node) => node.dataset?.exportExclude !== "true",
        style: {
          height: `${height}px`,
          margin: "0",
          maxHeight: "none",
          maxWidth: "none",
          transform: "none",
          transformOrigin: "top left",
          width: `${width}px`,
        },
      };

      const dataUrl =
        format === "png"
          ? await toPng(exportNode, options)
          : await toJpeg(exportNode, options);
      const outputWidth = Math.round(width * pixelRatio);
      const outputHeight = Math.round(height * pixelRatio);
      const filename = `${activeTab}_${activeTab === "banner" ? device : "4x5"}_${brandSlug}_${outputWidth}x${outputHeight}.${format}`;

      triggerDownload(dataUrl, filename);
      toast.success("Arte exportada com sucesso!", { id: toastId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao exportar arte.";
      toast.error(message, { id: toastId });
      console.error("Falha na exportação de imagem:", error);
    } finally {
      if (exportNode) finishExport(exportNode);
      setExporting(false);
    }
  };

  const handleExportHtml = async () => {
    if (!emailState || !beginExport()) return;

    const toastId = toast.loading("Preparando o HTML do e-mail...");
    let exportNode: HTMLElement | null = null;

    try {
      exportNode = getExportNode("email");
      if (!exportNode) throw new Error("E-mail não encontrado na prévia.");

      await waitForExportAssets(exportNode);

      const brandName =
        String(emailState.brandName ?? "Marca").trim() || "Marca";
      const renderedEmail = serializeElementWithInlineStyles(exportNode);
      const htmlContent = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="BrieFlow">
  <title>E-mail Marketing - ${escapeHtml(brandName)}</title>
</head>
<body style="margin:0;padding:24px;background:#f3f4f6;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;box-sizing:border-box">
  ${renderedEmail}
</body>
</html>`;

      downloadBlob(
        new Blob([htmlContent], { type: "text/html;charset=utf-8" }),
        `email_${device}_${sanitizeFilenamePart(brandName)}.html`,
      );
      toast.success("HTML autônomo exportado com sucesso!", { id: toastId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao gerar o HTML.";
      toast.error(message, { id: toastId });
      console.error("Falha na exportação de HTML:", error);
    } finally {
      if (exportNode) finishExport(exportNode);
      setExporting(false);
    }
  };

  const handleExportSocialText = () => {
    if (!socialState || !beginExport()) return;

    try {
      const brandName =
        String(socialState.brandName ?? "Marca").trim() || "Marca";
      const textContent = buildSocialExportText(socialState);
      downloadBlob(
        new Blob([textContent], { type: "text/plain;charset=utf-8" }),
        `social_${sanitizeFilenamePart(brandName)}_legenda.txt`,
      );
      toast.success("Legenda exportada com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar o arquivo de legenda.");
      console.error("Falha na exportação de legenda:", error);
    } finally {
      setExporting(false);
    }
  };

  const bannerStyle: React.CSSProperties =
    device === "desktop"
      ? {
          width: 1200,
          height: 600,
          borderRadius: 0,
          overflow: "hidden",
        }
      : {
          width: 540,
          height: 960,
          borderRadius: 0,
          overflow: "hidden",
        };
  const emailStyle: React.CSSProperties =
    device === "desktop"
      ? {
          width: sourceSizes.email.width,
          minHeight: sourceSizes.email.height,
          height: "auto",
          borderRadius: 0,
        }
      : { width: 540, minHeight: 960, height: "auto", borderRadius: 0 };

  const bannerPreviewSize =
    device === "desktop"
      ? { width: 1200, height: 600 }
      : { width: 540, height: 960 };
  const emailPreviewSize =
    device === "desktop" ? sourceSizes.email : { width: 540, height: 960 };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isExporting || nextOpen) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-border-strong bg-surface-1 p-0 text-fg-primary shadow-[var(--shadow-elevated)] sm:h-[92vh] sm:w-[96vw] sm:max-w-[1120px] sm:rounded-[24px]">
        <DialogHeader className="flex shrink-0 flex-col gap-3 border-b border-border-subtle bg-surface-1/95 px-4 py-4 pr-14 text-left backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 sm:pr-14">
          <div>
            <DialogTitle className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              Central de exportação
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-5 text-fg-tertiary sm:text-sm">
              Confira a peça no formato final antes de baixar.
            </DialogDescription>
          </div>

          <div className="flex items-center">
            {activeTab !== "social" && (
              <div className="grid w-full grid-cols-2 rounded-xl border border-border-subtle bg-surface-2 p-1 sm:w-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isExporting}
                  onClick={() => setDevice("desktop")}
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs transition-all",
                    device === "desktop"
                      ? "bg-surface-1 text-brand shadow-sm"
                      : "text-fg-muted hover:text-fg-primary",
                  )}
                >
                  <Monitor className="mr-2 size-3.5" /> Desktop
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isExporting}
                  onClick={() => setDevice("mobile")}
                  className={cn(
                    "h-8 rounded-lg px-3 text-xs transition-all",
                    device === "mobile"
                      ? "bg-surface-1 text-brand shadow-sm"
                      : "text-fg-muted hover:text-fg-primary",
                  )}
                >
                  <Smartphone className="mr-2 size-3.5" /> Mobile
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 bg-surface-0">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ExportTab)}
            className="flex h-full min-h-0 flex-col"
          >
            <div className="shrink-0 border-b border-border-subtle bg-surface-1 px-3 pt-3 sm:px-6 sm:pt-4">
              <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-surface-2 p-1 sm:w-[360px]">
                <TabsTrigger
                  value="banner"
                  disabled={isExporting || !bannerState}
                  className="rounded-lg text-xs"
                >
                  Banner
                </TabsTrigger>
                <TabsTrigger
                  value="email"
                  disabled={isExporting || !emailState}
                  className="rounded-lg text-xs"
                >
                  E-mail
                </TabsTrigger>
                <TabsTrigger
                  value="social"
                  disabled={isExporting || !socialState}
                  className="rounded-lg text-xs"
                >
                  Social
                </TabsTrigger>
              </TabsList>
            </div>

            <div
              className="custom-scrollbar relative flex min-h-0 w-full flex-1 flex-col items-center justify-start overflow-hidden p-2 sm:p-5"
              style={{
                backgroundImage:
                  "radial-gradient(circle at center, var(--surface-2) 2px, var(--surface-0) 2px)",
                backgroundSize: "24px 24px",
              }}
            >
              <TabsContent
                value="banner"
                className="w-full h-full min-h-0 m-0 flex flex-col items-center data-[state=inactive]:hidden"
              >
                <div className="flex min-h-0 w-full flex-1" ref={bannerRef}>
                  <ExportPreviewFrame
                    width={bannerPreviewSize.width}
                    height={bannerPreviewSize.height}
                  >
                    {bannerState ? (
                      <BannerPreview
                        state={bannerState}
                        onChange={() => undefined}
                        exportWrapperClass={
                          device === "mobile"
                            ? "export-mode force-mobile"
                            : "export-mode"
                        }
                        exportWrapperStyle={bannerStyle}
                      />
                    ) : (
                      <div className="w-[800px] h-[400px] flex items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-surface-1">
                        <p className="text-fg-muted font-medium">
                          Nenhum banner gerado.
                        </p>
                      </div>
                    )}
                  </ExportPreviewFrame>
                </div>
                <div className="mt-auto flex w-full shrink-0 flex-col justify-center gap-2 border-t border-border-subtle bg-surface-0/90 pt-3 backdrop-blur sm:flex-row sm:flex-wrap sm:gap-3 sm:pt-4">
                  <Button
                    onClick={() => handleExportImage("png")}
                    disabled={!bannerState || isExporting}
                    className="w-full rounded-xl bg-brand text-brand-fg shadow-[var(--shadow-brand)] hover:brightness-110 sm:w-auto"
                  >
                    {isExporting ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="size-4 mr-2" />
                    )}
                    Baixar alta qualidade (PNG)
                  </Button>
                  <Button
                    onClick={() => handleExportImage("jpg")}
                    disabled={!bannerState || isExporting}
                    variant="outline"
                    className="w-full rounded-xl border-border-strong bg-surface-1 text-fg-primary sm:w-auto"
                  >
                    Baixar compacto (JPG)
                  </Button>
                </div>
              </TabsContent>

              <TabsContent
                value="email"
                className="w-full h-full min-h-0 m-0 flex flex-col items-center data-[state=inactive]:hidden"
              >
                <div className="flex min-h-0 w-full flex-1" ref={emailRef}>
                  <ExportPreviewFrame
                    width={emailPreviewSize.width}
                    height={emailPreviewSize.height}
                    fit="width"
                  >
                    {emailState ? (
                      <EmailPreview
                        state={emailState}
                        onChange={() => undefined}
                        exportWrapperClass={
                          device === "mobile"
                            ? "export-mode force-mobile"
                            : "export-mode"
                        }
                        exportWrapperStyle={emailStyle}
                      />
                    ) : (
                      <div className="w-[600px] h-[600px] flex items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-surface-1">
                        <p className="text-fg-muted font-medium">
                          Nenhum e-mail gerado.
                        </p>
                      </div>
                    )}
                  </ExportPreviewFrame>
                </div>
                <div className="mt-auto flex w-full shrink-0 justify-center border-t border-border-subtle bg-surface-0/90 pt-3 backdrop-blur sm:pt-4">
                  <Button
                    onClick={handleExportHtml}
                    disabled={!emailState || isExporting}
                    className="w-full rounded-xl bg-brand text-white shadow-[var(--shadow-brand)] hover:brightness-110 sm:w-auto"
                  >
                    {isExporting ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <FileCode className="size-4 mr-2" />
                    )}
                    Baixar HTML autônomo
                  </Button>
                </div>
              </TabsContent>

              <TabsContent
                value="social"
                className="w-full h-full min-h-0 m-0 flex flex-col items-center data-[state=inactive]:hidden"
              >
                <div
                  className="flex min-h-0 w-full flex-1 items-stretch justify-center gap-6 overflow-hidden"
                  ref={socialRef}
                >
                  <div className="flex min-h-0 min-w-0 flex-1">
                    <ExportPreviewFrame
                      width={sourceSizes.social.width}
                      height={sourceSizes.social.height}
                    >
                      {socialState ? (
                        <SocialPreview
                          state={socialState}
                          onChange={() => undefined}
                          exportWrapperClass="export-mode"
                          exportWrapperStyle={{
                            width: sourceSizes.social.width,
                          }}
                        />
                      ) : (
                        <div className="w-[600px] h-[600px] flex items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-surface-1">
                          <p className="text-fg-muted font-medium">
                            Nenhum post gerado.
                          </p>
                        </div>
                      )}
                    </ExportPreviewFrame>
                  </div>

                  {socialState && (
                    <div className="hidden h-full max-h-[450px] w-[300px] shrink-0 flex-col self-center rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-[var(--shadow-elevated)] lg:flex">
                      <h4 className="text-sm font-bold text-fg-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FileText className="size-4" /> Legenda
                      </h4>
                      <div className="flex-1 bg-surface-2 rounded-lg p-4 text-sm text-fg-primary overflow-y-auto border border-border-subtle whitespace-pre-wrap">
                        {buildSocialExportText(socialState)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-auto flex w-full shrink-0 flex-col justify-center gap-2 border-t border-border-subtle bg-surface-0/90 pt-3 backdrop-blur sm:flex-row sm:flex-wrap sm:gap-3 sm:pt-4">
                  <Button
                    onClick={() => handleExportImage("png")}
                    disabled={!socialState || isExporting}
                    className="w-full rounded-xl bg-brand text-white shadow-[var(--shadow-brand)] hover:brightness-110 sm:w-auto"
                  >
                    {isExporting ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="size-4 mr-2" />
                    )}
                    Baixar arte 4:5 (PNG)
                  </Button>
                  <Button
                    onClick={handleExportSocialText}
                    disabled={!socialState || isExporting}
                    variant="outline"
                    className="w-full rounded-xl border-border-strong bg-surface-1 sm:w-auto"
                  >
                    <FileText className="size-4 mr-2" /> Salvar legenda (TXT)
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
