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
import { CampaignTabs } from "./builder/CampaignTabs";
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
import { Loader2 } from "lucide-react";

interface Props {
  onRefine: (prompt: string) => void;
}

export function PageBuilder({ onRefine }: Props) {
  const {
    builder,
    loading,
    generatingLabel,
    patchBuilder,
    setBuilder,
  } = useBriefflowStore();

  const [activeTab, setActiveTab] = useState<CampaignAsset["type"]>("banner");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Controle do Dialog de Exportação Visual
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("png");
  const [exportW, setExportW] = useState("1200");
  const [exportH, setExportH] = useState("300");

  const isSavingRef = useRef(false);
  const isExportingRef = useRef(false);

  const hasContent = builder.type !== "none";
  const isSaveable =
    hasContent &&
    builder.type !== "discovery_plan" &&
    (builder.type === "campaign"
      ? Boolean(builder.campaignAssets?.length)
      : true);

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      toast.error("Biblioteca não configurada", { duration: 4000 });
      return;
    }

    if (isSavingRef.current) return;
    
    isSavingRef.current = true;
    setIsSaving(true);
    
    await new Promise((resolve) => setTimeout(resolve, 150));
    toast.info("Salvando campanha na biblioteca...", { duration: 3000 });
    
    try {
      await saveAssetToLibrary("Campanha AI", builder);
      toast.success("Salvo na biblioteca com sucesso!", { duration: 4000 });
    } catch {
      toast.error("Erro ao salvar a campanha", { duration: 4000 });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleExportClick = () => {
    if (activeTab === "banner") {
      setExportW("1200");
      setExportH("300");
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

    try {
      if (activeTab === "banner") {
        toast.info("Processando responsividade e capturando...", { duration: 3000 });
        
        const bannerElement = document.getElementById("banner-export-node");
        const innerElement = document.getElementById("banner-inner-wrapper");
        
        if (!bannerElement || !innerElement) {
            toast.error("Erro: Banner não encontrado na tela.");
            setIsExportingRef.current = false;
            setIsExporting(false);
            setExportDialogOpen(false);
            return;
        }

        const targetWidth = parseInt(exportW) || 1200;
        const targetHeight = parseInt(exportH) || 300;

        const originalBannerStyle = bannerElement.getAttribute('style') || '';
        const originalInnerStyle = innerElement.getAttribute('style') || '';

        bannerElement.setAttribute(
          'style', 
          `${originalBannerStyle}; width: ${targetWidth}px !important; height: ${targetHeight}px !important; max-width: none !important; max-height: none !important;`
        );
        
        innerElement.setAttribute(
          'style',
          `${originalInnerStyle}; border-radius: 0px !important; min-height: 0px !important; height: ${targetHeight}px !important;`
        );

        await new Promise((resolve) => setTimeout(resolve, 300));

        try {
          const canvas = await toCanvas(bannerElement, {
              pixelRatio: 2, 
              backgroundColor: exportFormat === 'jpeg' ? '#000000' : null,
              skipFonts: true, 
              fontEmbedCSS: '', 
           });
           
          const finalData = canvas.toDataURL(`image/${exportFormat}`, 1.0);
           
          const a = document.createElement("a");
          a.href = finalData;
          a.download = `banner_${brandName.replace(/\s+/g, '_').toLowerCase()}_${targetWidth}x${targetHeight}.${exportFormat}`;
          a.click();
           
          toast.success("Banner exportado com sucesso!", { duration: 4000 });
        } finally {
          bannerElement.setAttribute('style', originalBannerStyle);
          innerElement.setAttribute('style', originalInnerStyle);
        }

      } 
      else if (activeTab === "email") {
        toast.info("Gerando HTML do e-mail...", { duration: 3000 });

        const title = cleanText(c.title, "Título do e-mail");
        const cta = cleanText(c.cta, "");
        const hasCta = cta.trim().length > 0;
        
        const offerRaw = builder.discoveryPlan?.offer;
        const hasOffer = !isEmptyLike(offerRaw);
        const couponCode = c.footerText || "LAB70";
        
        const paragraphs = cleanText(c.body || "")
          .split(/\n+/)
          .map((p: string) => cleanText(p))
          .filter((p: string) => p.length > 0)
          .filter((p: string) => {
            const lp = p.toLowerCase();
            const lc = cta.toLowerCase();
            if (!lc) return true;
            if (lp === lc) return false;
            if (lp.includes(lc) && lp.length <= lc.length + 10) return false;
            return true;
          });

        let heroUrl = images[0] || null;
        if (!heroUrl && c.emailHeroImagePrompt) {
            heroUrl = buildPollinationsUrl(c.emailHeroImagePrompt, { width: 1200, height: 600, seed: c.imageSeed });
        }

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f4f4f5; font-family: Arial, sans-serif;">
  <table width="100%" max-width="600" align="center" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border-spacing: 0; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
    <tr>
      <td style="background-color: ${themeColor}; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">${brandName}</h1>
      </td>
    </tr>
    ${heroUrl ? `<tr><td><img src="${heroUrl}" width="100%" style="display: block; max-width: 100%; height: auto;" alt="Capa"></td></tr>` : ''}
    <tr>
      <td style="padding: 40px 30px; text-align: center;">
        <h2 style="color: #1e293b; font-size: 24px; margin-top: 0; margin-bottom: 20px;">${title}</h2>
        
        ${paragraphs.map((p: string) => `<p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">${p}</p>`).join('')}

        ${hasOffer ? `
          <div style="background-color: ${themeColor}05; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 30px 20px; margin: 40px 0; text-align: center; position: relative;">
            <p style="margin: 0 0 20px 0; color: #334155; font-size: 16px; font-weight: bold; line-height: 1.5;">${cleanText(offerRaw)}</p>
            <div style="display: inline-block; background-color: #ffffff; border: 2px dashed ${themeColor}; border-radius: 12px; padding: 15px 30px;">
                <h3 style="margin: 0; color: #1e293b; font-size: 26px; letter-spacing: 4px; text-transform: uppercase;">${couponCode}</h3>
            </div>
            <p style="margin: 15px 0 0 0; color: #94a3b8; font-size: 12px;">Use o código acima ao finalizar a compra</p>
          </div>
        ` : ''}

        ${hasCta ? `
          <div style="margin-top: 30px;">
            <a href="#" style="display: inline-block; background-color: ${themeColor}; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; text-transform: uppercase; font-size: 14px;">${cta}</a>
          </div>
        ` : ''}
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">Você está recebendo este e-mail pois se cadastrou em ${brandName}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const blobHtml = new Blob([html], { type: "text/html;charset=utf-8" });
        const htmlUrl = URL.createObjectURL(blobHtml);
        
        const aHtml = document.createElement("a");
        aHtml.href = htmlUrl;
        aHtml.download = `email_${brandName.replace(/\s+/g, "_").toLowerCase()}.html`;
        document.body.appendChild(aHtml);
        aHtml.click();
        document.body.removeChild(aHtml);
        URL.revokeObjectURL(htmlUrl);
        
        toast.success("E-mail HTML exportado com sucesso!", { duration: 4000 });
      } 
      else if (activeTab === "social") {
        toast.info("Preparando arquivos para download...", { duration: 3000 });
        
        // Texto
        const caption = cleanText(c.caption, "");
        const captionParts = caption.split(/(#\w+)/g);
        const textContent = `${brandName}\n\n${caption}\n\n${captionParts.filter((p:string) => p.startsWith("#")).join(" ")}`;
        
        const textBlob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
        const textUrl = URL.createObjectURL(textBlob);
        const aText = document.createElement("a");
        aText.href = textUrl;
        aText.download = `social_${brandName.replace(/\s+/g, "_").toLowerCase()}_legenda.txt`;
        document.body.appendChild(aText);
        aText.click();
        document.body.removeChild(aText);
        URL.revokeObjectURL(textUrl);

        // Imagem
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
                  // Usamos PNG como padrão para o post social gerado direto pelo botão de cima
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
            window.open(imgUrl, "_blank"); // Fallback agressivo se der erro de CORS na tela
          }
        }

        toast.success("Post social exportado com sucesso!", { duration: 4000 });
      }

    } catch (e) {
      toast.error("Erro ao exportar arquivos.", { duration: 4000 });
      console.error(e);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
      setExportDialogOpen(false);
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
        
        <div className="relative mx-auto max-w-5xl space-y-10 pb-40">
          {loading && generatingLabel && builder.type === "campaign" && (
            <GeneratingBanner label={generatingLabel} />
          )}

          {builder.type === "campaign" && builder.campaignAssets && (
            <div className="fade-in-up">
              <CampaignTabs
                assets={builder.campaignAssets}
                onAssetChange={handleAssetPatch}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
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

      {/* MODAL AGORA É EXCLUSIVO PARA O BANNER */}
      <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <AlertDialogContent className="bg-surface-1 border-border-strong text-fg-primary shadow-2xl sm:max-w-[425px]">
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
                <SelectTrigger className="col-span-3 bg-surface-2 border-border-subtle">
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent className="bg-surface-2 border-border-subtle text-fg-primary">
                  <SelectItem value="jpeg">JPG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="webp">WEBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="width" className="text-right text-fg-secondary">Largura (px)</Label>
              <Input id="width" value={exportW} onChange={(e) => setExportW(e.target.value)} className="col-span-3 bg-surface-2 border-border-subtle text-fg-primary" />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="height" className="text-right text-fg-secondary">Altura (px)</Label>
              <Input id="height" value={exportH} onChange={(e) => setExportH(e.target.value)} className="col-span-3 bg-surface-2 border-border-subtle text-fg-primary" />
            </div>
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="border-border-strong bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary" onClick={() => setExportDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeExport();
              }}
              disabled={isExporting}
              className="bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)]"
            >
              {isExporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Baixar Arte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}