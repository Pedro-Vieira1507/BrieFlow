import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileCode,
  FileText,
  Loader2,
  Monitor,
  Smartphone,
  X,
} from "lucide-react";
import { toJpeg, toPng } from "html-to-image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildSocialExportText,
  downloadBlob,
  escapeHtml,
  finishExport,
  sanitizeFilenamePart,
  serializeElementWithInlineStyles,
  triggerDownload,
  waitForExportAssets,
} from "@/lib/export-utils";
import { cn } from "@/lib/utils";

import type { BuilderState, CampaignAsset } from "@/types/builder";
import { BannerPreview } from "./BannerPreview";
import { EmailPreview } from "./EmailPreview";
import { SocialPreview } from "./SocialPreview";

type ExportTab = CampaignAsset["type"];
type ExportFormat = "png" | "jpg";

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
    return state.campaignAssets?.find((asset) =>
      ["banner", "email", "social"].includes(asset.type),
    )?.type ?? "banner";
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
      const pixelRatio = activeTab === "social" ? 1 : format === "png" ? 2 : 1;
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
      const outputWidth = width * pixelRatio;
      const outputHeight = height * pixelRatio;
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
      ? { width: 1200, height: 600, borderRadius: 0, overflow: "hidden" }
      : {
          width: 540,
          minHeight: 960,
          height: "auto",
          borderRadius: 0,
          overflow: "hidden",
        };
  const emailStyle: React.CSSProperties =
    device === "desktop"
      ? { width: 800, minHeight: 600, height: "auto", borderRadius: 0 }
      : { width: 540, minHeight: 960, height: "auto", borderRadius: 0 };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isExporting || nextOpen) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-[1100px] w-[95vw] h-[90vh] bg-surface-1 border-border-strong text-fg-primary shadow-2xl flex flex-col p-0 overflow-hidden gap-0 rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b border-border-subtle bg-surface-2 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-xl font-display">
              Exportar Design
            </DialogTitle>
            <DialogDescription className="text-sm text-fg-tertiary mt-1">
              A prévia abaixo corresponde exatamente ao arquivo final.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-4">
            {activeTab !== "social" && (
              <div className="flex items-center p-1 bg-surface-3 rounded-lg border border-border-subtle">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isExporting}
                  onClick={() => setDevice("desktop")}
                  className={cn(
                    "h-8 px-3 rounded-md transition-all",
                    device === "desktop"
                      ? "bg-surface-1 text-brand shadow-sm"
                      : "text-fg-muted hover:text-fg-primary",
                  )}
                >
                  <Monitor className="size-4 mr-2" /> Desktop
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isExporting}
                  onClick={() => setDevice("mobile")}
                  className={cn(
                    "h-8 px-3 rounded-md transition-all",
                    device === "mobile"
                      ? "bg-surface-1 text-brand shadow-sm"
                      : "text-fg-muted hover:text-fg-primary",
                  )}
                >
                  <Smartphone className="size-4 mr-2" /> Mobile
                </Button>
              </div>
            )}
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isExporting}
                className="rounded-full text-fg-muted hover:bg-surface-3"
              >
                <X className="size-5" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 bg-surface-0">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ExportTab)}
            className="flex flex-col h-full"
          >
            <div className="px-6 pt-4 border-b border-border-subtle bg-surface-1 shrink-0">
              <TabsList className="bg-surface-2 p-1">
                <TabsTrigger value="banner" disabled={isExporting}>
                  Banner
                </TabsTrigger>
                <TabsTrigger value="email" disabled={isExporting}>
                  E-mail
                </TabsTrigger>
                <TabsTrigger value="social" disabled={isExporting}>
                  Post Social
                </TabsTrigger>
              </TabsList>
            </div>

            <div
              className="flex-1 overflow-auto p-6 flex flex-col items-center justify-start relative w-full h-full custom-scrollbar"
              style={{
                backgroundImage:
                  "radial-gradient(circle at center, var(--surface-2) 2px, var(--surface-0) 2px)",
                backgroundSize: "24px 24px",
              }}
            >
              <TabsContent
                value="banner"
                className="w-full h-full m-0 flex flex-col items-center data-[state=inactive]:hidden"
              >
                <div
                  className="flex-1 w-full flex items-start justify-center py-4 overflow-auto"
                  ref={bannerRef}
                >
                  <div
                    className={cn(
                      "origin-top mx-auto",
                      device === "desktop" ? "scale-[0.65]" : "scale-[0.55]",
                    )}
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
                  </div>
                </div>
                <div className="mt-auto pt-4 flex flex-wrap gap-3 w-full justify-center shrink-0">
                  <Button
                    onClick={() => handleExportImage("png")}
                    disabled={!bannerState || isExporting}
                    className="bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)]"
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
                    className="border-border-strong bg-surface-1 text-fg-primary"
                  >
                    Baixar compacto (JPG)
                  </Button>
                </div>
              </TabsContent>

              <TabsContent
                value="email"
                className="w-full h-full m-0 flex flex-col items-center data-[state=inactive]:hidden"
              >
                <div
                  className="flex-1 w-full flex items-start justify-center py-4 overflow-auto"
                  ref={emailRef}
                >
                  <div
                    className={cn(
                      "origin-top",
                      device === "desktop" ? "scale-[0.6]" : "scale-[0.65]",
                    )}
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
                  </div>
                </div>
                <div className="mt-auto pt-4 flex gap-3 w-full justify-center shrink-0">
                  <Button
                    onClick={handleExportHtml}
                    disabled={!emailState || isExporting}
                    className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20"
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
                className="w-full h-full m-0 flex flex-col items-center data-[state=inactive]:hidden"
              >
                <div
                  className="flex-1 w-full flex items-start justify-center gap-10 overflow-auto"
                  ref={socialRef}
                >
                  <div className="origin-top scale-[0.4]">
                    {socialState ? (
                      <SocialPreview
                        state={socialState}
                        onChange={() => undefined}
                        exportWrapperClass="export-mode"
                        exportWrapperStyle={{ width: 1080 }}
                      />
                    ) : (
                      <div className="w-[600px] h-[600px] flex items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-surface-1">
                        <p className="text-fg-muted font-medium">
                          Nenhum post gerado.
                        </p>
                      </div>
                    )}
                  </div>

                  {socialState && (
                    <div className="w-[320px] h-[450px] bg-surface-1 rounded-xl shadow-2xl border border-border-subtle p-6 flex flex-col self-center shrink-0">
                      <h4 className="text-sm font-bold text-fg-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FileText className="size-4" /> Legenda
                      </h4>
                      <div className="flex-1 bg-surface-2 rounded-lg p-4 text-sm text-fg-primary overflow-y-auto border border-border-subtle whitespace-pre-wrap">
                        {buildSocialExportText(socialState)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-auto pt-4 flex flex-wrap gap-3 w-full justify-center shrink-0">
                  <Button
                    onClick={() => handleExportImage("png")}
                    disabled={!socialState || isExporting}
                    className="bg-pink-600 text-white hover:bg-pink-700 shadow-lg shadow-pink-900/20"
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
                    className="border-border-strong bg-surface-1"
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
