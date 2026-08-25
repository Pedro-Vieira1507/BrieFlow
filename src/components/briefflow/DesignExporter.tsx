// src/components/briefflow/DesignExporter.tsx
import React, { useState, useRef } from "react";
import { Download, Monitor, Smartphone, FileCode, FileText, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toPng, toJpeg } from "html-to-image";
import { toast } from "sonner";
import { cleanText } from "@/lib/sanitize";

import type { BuilderState } from "@/types/builder";
import { BannerPreview } from "./BannerPreview";
import { EmailPreview } from "./EmailPreview";
import { SocialPreview } from "./SocialPreview";

interface DesignExporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state?: BuilderState;
}

export function DesignExporter({ open, onOpenChange, state }: DesignExporterProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState("banner");
  const [isExporting, setIsExporting] = useState(false);

  // Referências para capturar o conteúdo DOM para a foto
  const bannerRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const socialRef = useRef<HTMLDivElement>(null);

  // Extrair os estados individuais para cada peça de marketing da campanha
  const campaignAssets = state?.type === "campaign" ? state.campaignAssets : [];
  const bannerState = campaignAssets?.find(a => a.type === "banner")?.content;
  const emailState = campaignAssets?.find(a => a.type === "email")?.content;
  const socialState = campaignAssets?.find(a => a.type === "social")?.content;

  const getBrandName = (c: any) => cleanText(c?.brandName, "Marca");

  // Exportação em Imagem com Qualidade Retina (Para Banner e Social)
  const handleExportImage = async (format: "png" | "jpg") => {
    setIsExporting(true);
    const toastId = toast.loading(`Renderizando ${activeTab} em ${format.toUpperCase()}...`);

    try {
      const container = activeTab === "banner" ? bannerRef.current : socialRef.current;
      const selector = activeTab === "banner" ? '#banner-export-node' : '#social-export-node';
      const exportNode = container?.querySelector(selector) as HTMLElement;

      if (!exportNode) throw new Error("Arte não encontrada na tela. Verifique se o design foi gerado.");

      // CORREÇÃO: Aguardar a imagem e fontes terminarem de renderizar antes da captura real
      await new Promise(res => setTimeout(res, 300));

      const width = exportNode.offsetWidth;
      const height = exportNode.offsetHeight;
      const currentState = activeTab === "banner" ? bannerState : socialState;
      const brandName = getBrandName(currentState);

      // Travar larguras fixas garante captura total, desativa escalas virtuais de CSS.
      const options = {
        pixelRatio: 2,
        backgroundColor: currentState?.boxColor || (format === "jpg" ? '#ffffff' : null),
        skipFonts: true,
        width: width,
        height: height,
        style: { transform: 'scale(1)', transformOrigin: 'top left', margin: '0' }
      };

      const dataUrl = format === "png"
        ? await toPng(exportNode, options)
        : await toJpeg(exportNode, options);

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${activeTab}_${device}_${brandName.replace(/\s+/g, '_').toLowerCase()}_${width}x${height}.${format}`;
      a.click();

      toast.success("Arte exportada com sucesso!", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao exportar arte", { id: toastId });
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  // Exportação de E-mail (HTML)
  const handleExportHTML = () => {
    if (!emailRef.current || !emailState) return;
    try {
      const exportNode = emailRef.current.querySelector('#email-export-node') as HTMLElement;
      if (!exportNode) throw new Error("E-mail não encontrado na tela.");

      const brandName = getBrandName(emailState);
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-mail Marketing - ${brandName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 40px; background-color: #1a1a24; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
    .editable-hover { outline: none !important; cursor: default !important; }
  </style>
</head>
<body>
  ${exportNode.outerHTML}
</body>
</html>`;

      const blobHtml = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const htmlUrl = URL.createObjectURL(blobHtml);

      const aHtml = document.createElement("a");
      aHtml.href = htmlUrl;
      aHtml.download = `email_template_${brandName.replace(/\s+/g, "_").toLowerCase()}.html`;
      aHtml.click();
      URL.revokeObjectURL(htmlUrl);
      toast.success("HTML estruturado exportado!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar o HTML");
    }
  };

  // Exportação de TXT para Redes Sociais
  const handleExportSocialTXT = () => {
    if (!socialState) return;
    try {
      const c = socialState as any;
      const brandName = getBrandName(c);
      const caption = cleanText(c.caption, "");
      const captionParts = caption.split(/(#\w+)/g);
      const textContent = `${brandName}\n\n${caption}\n\n${captionParts.filter((p: string) => p.startsWith("#")).join(" ")}`;

      const textBlob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const textUrl = URL.createObjectURL(textBlob);

      const aText = document.createElement("a");
      aText.href = textUrl;
      aText.download = `social_${brandName.replace(/\s+/g, "_").toLowerCase()}_legenda.txt`;
      aText.click();
      URL.revokeObjectURL(textUrl);

      toast.success("Legenda (TXT) baixada com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao gerar o arquivo TXT");
    }
  };

  // CORREÇÃO: O segredo para não cortar e esticar!
  // No mobile, a altura (height) agora é "auto" (min-height e h-auto), o que faz o bloco crescer o quanto precisar
  // ao invés de travar e "espremer" os itens no celular. No desktop é largura de tela larga fixa.
  const getDeviceStyle = () => {
    return device === "desktop"
      ? { width: '1200px', height: '600px', borderRadius: '0px', overflow: 'hidden' }
      // Deixe o height auto no mobile para as flex-columns empilharem sem cortar
      : { width: '540px', minHeight: '960px', height: 'max-content', borderRadius: '0px', overflow: 'hidden' };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] w-[95vw] h-[90vh] bg-surface-1 border-border-strong text-fg-primary shadow-2xl flex flex-col p-0 overflow-hidden gap-0 rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border-subtle bg-surface-2 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              Exportar Design
            </DialogTitle>
            <DialogDescription className="text-sm text-fg-tertiary mt-1">
              Baixe seus criativos em alta qualidade (Render real do componente).
            </DialogDescription>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center p-1 bg-surface-3 rounded-lg border border-border-subtle">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDevice("desktop")}
                className={cn(
                  "h-8 px-3 rounded-md transition-all",
                  device === "desktop" ? "bg-surface-1 text-brand shadow-sm" : "text-fg-muted hover:text-fg-primary"
                )}
              >
                <Monitor className="size-4 mr-2" />
                Desktop
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDevice("mobile")}
                className={cn(
                  "h-8 px-3 rounded-md transition-all",
                  device === "mobile" ? "bg-surface-1 text-brand shadow-sm" : "text-fg-muted hover:text-fg-primary"
                )}
              >
                <Smartphone className="size-4 mr-2" />
                Mobile
              </Button>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-fg-muted hover:bg-surface-3">
                <X className="size-5" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Body: Tabs & Preview */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="px-6 pt-4 border-b border-border-subtle bg-surface-1 shrink-0">
              <TabsList className="bg-surface-2 p-1">
                <TabsTrigger value="banner" className="data-[state=active]:bg-surface-1 data-[state=active]:text-brand">
                  Banner
                </TabsTrigger>
                <TabsTrigger value="email" className="data-[state=active]:bg-surface-1 data-[state=active]:text-brand">
                  E-mail
                </TabsTrigger>
                <TabsTrigger value="social" className="data-[state=active]:bg-surface-1 data-[state=active]:text-brand">
                  Post Social
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-start relative w-full h-full custom-scrollbar" style={{ backgroundImage: 'radial-gradient(circle at center, var(--surface-2) 2px, var(--surface-0) 2px)', backgroundSize: '24px 24px' }}>

              {/* BANNER TAB */}
              <TabsContent value="banner" className="w-full h-full m-0 flex flex-col items-center data-[state=inactive]:hidden">
                <div className="flex-1 w-full flex items-center justify-center py-4 overflow-y-auto" ref={bannerRef}>

                  {/* CORREÇÃO DO SCALE: Escalas ajustadas para não transbordar o Modal visualmente */}
                  <div className={cn("origin-top transition-transform duration-500 mx-auto", device === "desktop" ? "scale-[0.45] md:scale-[0.55] lg:scale-[0.65]" : "scale-[0.50] md:scale-[0.60]")}>
                    {bannerState ? (
                      <BannerPreview
                        state={bannerState}
                        onChange={() => { }}
                        // Adicionado !flex-col-reverse para empilhar o texto em cima e a foto embaixo
                        exportWrapperClass={device === "mobile" ? "export-mode force-mobile !flex-col-reverse" : "export-mode"}
                        exportWrapperStyle={getDeviceStyle()}
                      />
                    ) : (
                      <div className="w-[800px] h-[400px] flex items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-surface-1">
                        <p className="text-fg-muted font-medium">Nenhum Banner gerado no momento.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-4 flex gap-3 w-full justify-center shrink-0">
                  <Button onClick={() => handleExportImage("png")} disabled={!bannerState || isExporting} className="bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)]">
                    {isExporting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
                    Baixar Alta Qualidade (PNG)
                  </Button>
                  <Button onClick={() => handleExportImage("jpg")} disabled={!bannerState || isExporting} variant="outline" className="border-border-strong bg-surface-1 text-fg-primary">
                    Baixar Leve (JPG)
                  </Button>
                </div>
              </TabsContent>

              {/* EMAIL TAB */}
              <TabsContent value="email" className="w-full h-full m-0 flex flex-col items-center data-[state=inactive]:hidden">
                <div className="flex-1 w-full flex items-center justify-center py-4" ref={emailRef}>
                  <div className={cn("origin-top transition-transform duration-500", device === "desktop" ? "scale-[0.55]" : "scale-[0.65]")}>
                    {emailState ? (
                      <EmailPreview
                        state={emailState}
                        onChange={() => { }}
                        exportWrapperClass={device === "mobile" ? "export-mode force-mobile" : "export-mode"}
                        exportWrapperStyle={device === "desktop" ? { width: '800px', height: 'auto', minHeight: '600px', borderRadius: '0px' } : { width: '540px', height: 'auto', minHeight: '960px', borderRadius: '0px' }}
                      />
                    ) : (
                      <div className="w-[600px] h-[600px] flex items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-surface-1">
                        <p className="text-fg-muted font-medium">Nenhum E-mail gerado no momento.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-auto pt-4 flex gap-3 w-full justify-center shrink-0">
                  <Button onClick={handleExportHTML} disabled={!emailState} className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20">
                    <FileCode className="size-4 mr-2" />
                    Baixar Template HTML
                  </Button>
                </div>
              </TabsContent>

              {/* SOCIAL TAB */}
              <TabsContent value="social" className="w-full h-full m-0 flex flex-col items-center data-[state=inactive]:hidden">
                <div className="flex-1 w-full flex items-center justify-center gap-12" ref={socialRef}>

                  {/* Arte Visual - Escalada via CSS nativo */}
                  <div className={cn("origin-top transition-transform duration-500", device === "desktop" ? "scale-[0.60]" : "scale-[0.70]")}>
                    {socialState ? (
                      <SocialPreview
                        state={socialState}
                        onChange={() => { }}
                        exportWrapperClass="export-mode"
                        exportWrapperStyle={{ width: '1080px', height: '1080px', borderRadius: '0px' }}
                      />
                    ) : (
                      <div className="w-[600px] h-[600px] flex items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-surface-1">
                        <p className="text-fg-muted font-medium">Nenhum Post gerado.</p>
                      </div>
                    )}
                  </div>

                  {/* Mostra a Legenda Paralelamente */}
                  {socialState && (
                    <div className="w-[320px] h-[450px] bg-surface-1 rounded-xl shadow-2xl border border-border-subtle p-6 flex flex-col self-center">
                      <h4 className="text-sm font-bold text-fg-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FileText className="size-4" /> Legenda
                      </h4>
                      <div className="flex-1 bg-surface-2 rounded-lg p-4 text-sm text-fg-primary overflow-y-auto border border-border-subtle whitespace-pre-wrap">
                        {(socialState as any).caption || ""}
                        <br /><br />
                        {((socialState as any).hashtags || []).map((h: string) => `#${h}`).join(" ")}
                      </div>
                    </div>
                  )}

                </div>
                <div className="mt-auto pt-4 flex gap-3 w-full justify-center shrink-0">
                  <Button onClick={() => handleExportImage("png")} disabled={!socialState || isExporting} className="bg-pink-600 text-white hover:bg-pink-700 shadow-lg shadow-pink-900/20">
                    {isExporting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
                    Baixar Imagem 1:1
                  </Button>
                  <Button onClick={handleExportSocialTXT} disabled={!socialState} variant="outline" className="border-border-strong bg-surface-1">
                    <FileText className="size-4 mr-2" />
                    Salvar Legenda (TXT)
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