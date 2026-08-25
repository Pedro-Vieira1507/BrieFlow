// src/components/briefflow/PageBuilder.tsx
import { useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toCanvas } from "html-to-image";
import { useBriefflowStore } from "@/store/briefflow";
import { isSupabaseConfigured, saveAssetToLibrary } from "@/lib/supabase";
import { buildPollinationsUrl } from "@/lib/pollinations";
import { cleanText, isEmptyLike } from "@/lib/sanitize";

import { BuilderHeader } from "./builder/BuilderHeader";
import { GeneratingBanner } from "./builder/GeneratingBanner";
import { BannerPreview } from "./BannerPreview";
import { EmailPreview } from "./EmailPreview";
import { SocialPreview } from "./SocialPreview";
import { DiscoveryPlanView } from "./builder/DiscoveryPlanView";
import { BuilderEmptyState } from "./builder/BuilderEmptyState";

import type { BuilderState, CampaignAsset } from "@/types/builder";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Monitor, Mail, Instagram } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  onRefine: (prompt: string) => void;
  onOpenSettings?: () => void;
}

export function PageBuilder({ onRefine, onOpenSettings }: Props) {
  const {
    user,
    builder,
    loading,
    generatingLabel,
    patchBuilder,
    setBuilder,
  } = useBriefflowStore();

  const [activeTab, setActiveTab] = useState<CampaignAsset["type"]>("banner");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [exportConfig, setExportConfig] = useState<{ width: number; height: number; isMobile: boolean } | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("png");
  const [exportW, setExportW] = useState("1200");
  const [exportH, setExportH] = useState("600");

  const isSavingRef = useRef(false);
  const isExportingRef = useRef(false);

  const hasContent = builder.type !== "none";
  const isSaveable =
    hasContent &&
    builder.type !== "discovery_plan" &&
    (builder.type === "campaign"
      ? Boolean(builder.campaignAssets?.length)
      : true);

  const parsedW = parseInt(exportW, 10);
  const parsedH = parseInt(exportH, 10);
  const isExportValid = !isNaN(parsedW) && parsedW >= 1 && !isNaN(parsedH) && parsedH >= 1;

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      toast.error("Biblioteca não configurada");
      return;
    }
    if (!user) {
      toast.error("Acesso restrito", { description: "Faça login no perfil no topo da tela para salvar sua campanha." });
      return;
    }
    if (isSavingRef.current) return;
    
    isSavingRef.current = true;
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const toastId = toast.loading("Salvando campanha na biblioteca...");
    try {
      await saveAssetToLibrary("Campanha AI", builder);
      toast.success("Salvo na biblioteca com sucesso!", { id: toastId });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar a campanha", { id: toastId });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleExportClick = () => {
    if (activeTab === "banner") {
      setExportW("1200");
      setExportH("600");
      setExportDialogOpen(true);
    } else {
      executeExport();
    }
  };

  const executeExport = async () => {
    if (builder.type !== "campaign" || !builder.campaignAssets || isExportingRef.current) return;
    const asset = builder.campaignAssets.find((a) => a.type === activeTab);
    if (!asset) return;

    isExportingRef.current = true;
    setIsExporting(true);
    
    const c = asset.content as any;
    const brandName = cleanText(c.brandName, "Marca");
    const themeColor = c.themeColor || "#2563EB";
    const images = Array.from(
      new Set([
        ...(c.productImageUrl ? [c.productImageUrl] : []),
        ...(c.productImages || []),
      ]),
    );

    let toastId;

    try {
      if (activeTab === "banner") {
        toastId = toast.loading("Aplicando inteligência de layout...");
        const targetWidth = parseInt(exportW) || 1200;
        const targetHeight = parseInt(exportH) || 600;
        
        const isMobileExport = targetWidth <= targetHeight;
        
        let domWidth = 1200;
        if (isMobileExport) {
           domWidth = 450; 
        } else if (targetWidth / targetHeight <= 1.2) {
           domWidth = 800;
        } else {
           domWidth = 1200;
        }
        
        const domHeight = domWidth / (targetWidth / targetHeight);
        
        setExportConfig({ width: domWidth, height: domHeight, isMobile: isMobileExport });
        await new Promise((resolve) => setTimeout(resolve, 300));
        
        const bannerElement = document.getElementById("banner-export-node");
        
        if (!bannerElement) {
          toast.error("Erro: Banner não encontrado na tela.", { id: toastId });
          isExportingRef.current = false;
          setIsExporting(false);
          setExportDialogOpen(false);
          setExportConfig(null);
          return;
        }

        try {
          const canvas = await toCanvas(bannerElement, {
            pixelRatio: targetWidth / domWidth,
            backgroundColor: exportFormat === 'jpeg' ? '#000000' : null,
            skipFonts: true,
            fontEmbedCSS: '',
          });

          const finalData = canvas.toDataURL(`image/${exportFormat}`, 1.0);
          const a = document.createElement("a");
          a.href = finalData;
          a.download = `banner_${brandName.replace(/\s+/g, '_').toLowerCase()}_${targetWidth}x${targetHeight}.${exportFormat}`;
          a.click();
          
          toast.success("Banner exportado com sucesso!", { id: toastId });
        } finally {
          setExportConfig(null);
        }
      }
      else if (activeTab === "email") {
        toastId = toast.loading("Gerando HTML visual do e-mail...");
        
        const emailElement = document.getElementById("email-export-node");
        
        if (!emailElement) {
          toast.error("Erro: E-mail não encontrado na tela.", { id: toastId });
          isExportingRef.current = false;
          setIsExporting(false);
          setExportDialogOpen(false);
          setExportConfig(null);
          return;
        }

        // Constrói o HTML empacotando o Tailwind CDN e capturando o nó exato da tela
        const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exportação Visual - BrieFlow</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Pequeno reset para garantir fundo neutro fora da área exportada */
    body {
      margin: 0;
      padding: 40px;
      background-color: #1a1a24; /* surface-3 */
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }
    
    /* Limpa bordas ativas ou de edição caso restem do canvas */
    .editable-hover { outline: none !important; }
  </style>
</head>
<body>
  <!-- Clone Exato da Tela -->
  ${emailElement.outerHTML}
</body>
</html>`;

        const blobHtml = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        const htmlUrl = URL.createObjectURL(blobHtml);

        const aHtml = document.createElement("a");
        aHtml.href = htmlUrl;
        aHtml.download = `email_visual_${brandName.replace(/\s+/g, "_").toLowerCase()}.html`;
        document.body.appendChild(aHtml);
        aHtml.click();
        document.body.removeChild(aHtml);
        URL.revokeObjectURL(htmlUrl);
        
        toast.success("Arte do E-mail exportada com sucesso!", { id: toastId });
      }
      else if (activeTab === "social") {
        toastId = toast.loading("Preparando arquivos para download...");

        const caption = cleanText(c.caption, "");
        const captionParts = caption.split(/(#\w+)/g);
        const textContent = `${brandName}\n\n${caption}\n\n${captionParts.filter((p: string) => p.startsWith("#")).join(" ")}`;
        
        const textBlob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
        const textUrl = URL.createObjectURL(textBlob);

        const aText = document.createElement("a");
        aText.href = textUrl;
        aText.download = `social_${brandName.replace(/\s+/g, "_").toLowerCase()}_legenda.txt`;
        document.body.appendChild(aText);
        aText.click();
        document.body.removeChild(aText);
        URL.revokeObjectURL(textUrl);

        let imgUrl = images[0] || null;
        if (!imgUrl && c.imagePrompt) {
          imgUrl = buildPollinationsUrl(c.imagePrompt, { width: 1080, height: 1350, seed: c.imageSeed });
        }

        if (imgUrl) {
          try {
            const res = await fetch(imgUrl);
            const blob = await res.blob();
            const img = new Image();
            const objUrl = URL.createObjectURL(blob);
            img.crossOrigin = "Anonymous";
            
            await new Promise((resolve, reject) => {
              img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 1080;
                canvas.height = 1350;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const finalData = canvas.toDataURL(`image/png`, 1.0);
                  const aImg = document.createElement("a");
                  aImg.href = finalData;
                  aImg.download = `social_${brandName.replace(/\s+/g, "_").toLowerCase()}_arte.png`;
                  aImg.click();
                }
                resolve(true);
              };
              img.onerror = reject;
              img.src = objUrl;
            });
            URL.revokeObjectURL(objUrl);
          } catch (e) {
            window.open(imgUrl, "_blank");
          }
        }
        
        toast.success("Post social exportado com sucesso!", { id: toastId });
      }

    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar arquivos.", { id: toastId });
      console.error(e);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
      setExportDialogOpen(false);
      setExportConfig(null);
    }
  };

  const handleAssetPatch = (assetId: string, patch: Partial<BuilderState>) => {
    if (builder.type !== "campaign" || !builder.campaignAssets) return;
    const next = builder.campaignAssets.map((a) =>
      a.id === assetId ? { ...a, content: { ...a.content, ...patch } } : a,
    );
    setBuilder({ ...builder, campaignAssets: next });
  };

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <BuilderHeader
        isSaveable={isSaveable}
        isSaving={isSaving}
        isExporting={isExporting}
        loading={loading}
        onExport={handleExportClick}
        onSave={handleSave}
        onOpenSettings={onOpenSettings}
      />

      <div
        className={cn(
          "relative flex-1 overflow-y-auto p-6 lg:p-12",
          loading && builder.type === "discovery_plan"
            ? "pointer-events-none opacity-60"
            : "",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "var(--gradient-radial-brand)" }}
        />

        <div className={cn("relative mx-auto space-y-10 pb-40", exportConfig ? "w-fit" : "max-w-5xl")}>
          {loading && generatingLabel && builder.type === "campaign" && (
            <GeneratingBanner label={generatingLabel} />
          )}

          {builder.type === "campaign" && builder.campaignAssets && (
            <div className="fade-in-up">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CampaignAsset["type"])} className="w-full">
                 {!exportConfig && (
                   <div className="flex justify-center mb-8">
                     <TabsList className="bg-surface-2 border border-border-subtle p-1 h-12 w-full max-w-[400px]">
                       <TabsTrigger value="banner" className="flex-1 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-brand data-[state=active]:text-white transition-all duration-200">
                         <Monitor className="size-3.5 mr-2" /> Banner
                       </TabsTrigger>
                       <TabsTrigger value="email" className="flex-1 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-brand data-[state=active]:text-white transition-all duration-200">
                         <Mail className="size-3.5 mr-2" /> E-mail
                       </TabsTrigger>
                       <TabsTrigger value="social" className="flex-1 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-brand data-[state=active]:text-white transition-all duration-200">
                         <Instagram className="size-3.5 mr-2" /> Social
                       </TabsTrigger>
                     </TabsList>
                   </div>
                 )}

                 {builder.campaignAssets.map((asset) => (
                   <TabsContent key={asset.id} value={asset.type} className="mt-0 outline-none animate-in fade-in duration-300">
                     {asset.type === "banner" && (
                       <BannerPreview
                           state={asset.content}
                           onChange={(patch) => handleAssetPatch(asset.id, patch)}
                           exportWrapperClass={exportConfig?.isMobile ? "force-mobile" : ""}
                           exportWrapperStyle={exportConfig ? { width: `${exportConfig.width}px`, height: `${exportConfig.height}px`, aspectRatio: "unset", borderRadius: "0px" } : undefined}
                       />
                     )}
                     {asset.type === "email" && (
                       <EmailPreview state={asset.content} onChange={(patch) => handleAssetPatch(asset.id, patch)} />
                     )}
                     {asset.type === "social" && (
                       <SocialPreview state={asset.content} onChange={(patch) => handleAssetPatch(asset.id, patch)} />
                     )}
                   </TabsContent>
                 ))}
              </Tabs>
            </div>
          )}

          {builder.type === "discovery_plan" && builder.discoveryPlan && (
            <DiscoveryPlanView
              plan={builder.discoveryPlan}
              loading={loading}
              onPatch={patchBuilder}
              onApprove={() =>
                onRefine(
                  "Aprovado. Gere os materiais do ecossistema agora. Seja um designer criativo.",
                )
              }
            />
          )}

          {builder.type === "none" && <BuilderEmptyState />}
        </div>
      </div>

      <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <AlertDialogContent className="bg-surface-1 border-border-strong text-fg-primary shadow-2xl sm:max-w-[425px] animate-in zoom-in-95 duration-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">
              Exportar Banner
            </AlertDialogTitle>
            <AlertDialogDescription className="text-fg-secondary mt-2 leading-relaxed">
              Gere a arte final renderizada em alta qualidade para sua campanha.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="format" className="text-right text-fg-secondary">Formato</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="col-span-3 bg-surface-2 border-border-subtle focus:ring-brand transition-all duration-200">
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent className="bg-surface-2 border-border-subtle text-fg-primary">
                  <SelectItem value="jpeg" className="focus:bg-surface-3 cursor-pointer">JPG</SelectItem>
                  <SelectItem value="png" className="focus:bg-surface-3 cursor-pointer">PNG</SelectItem>
                  <SelectItem value="webp" className="focus:bg-surface-3 cursor-pointer">WEBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="width" className="text-right text-fg-secondary">Largura (px)</Label>
              <Input id="width" type="number" min="1" value={exportW} onChange={(e) => setExportW(e.target.value)} className="col-span-3 bg-surface-2 border-border-subtle text-fg-primary transition-all duration-200 focus-visible:ring-brand" />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="height" className="text-right text-fg-secondary">Altura (px)</Label>
              <Input id="height" type="number" min="1" value={exportH} onChange={(e) => setExportH(e.target.value)} className="col-span-3 bg-surface-2 border-border-subtle text-fg-primary transition-all duration-200 focus-visible:ring-brand" />
            </div>
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="border-border-strong bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary transition-all duration-200 active:scale-95" onClick={() => setExportDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!isExportValid) {
                  toast.error("Dimensões inválidas", { description: "Insira valores numéricos positivos e maiores que zero." });
                  return;
                }
                executeExport();
              }}
              disabled={isExporting || !isExportValid}
              // UX: Feedback de botão desativado e clique
              className="bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)] transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isExporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {isExporting ? "Exportando..." : "Baixar Arte"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}