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

    let toastId;

    try {
      if (activeTab === "banner") {
        toastId = toast.loading("Processando responsividade e capturando...");
        const bannerElement = document.getElementById("banner-export-node");
        const innerElement = document.getElementById("banner-inner-wrapper");
        
        if (!bannerElement || !innerElement) {
          toast.error("Erro: Banner não encontrado na tela.", { id: toastId });
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
          toast.success("Banner exportado com sucesso!", { id: toastId });
        } finally {
          bannerElement.setAttribute('style', originalBannerStyle);
          innerElement.setAttribute('style', originalInnerStyle);
        }
      }
      else if (activeTab === "email") {
        toastId = toast.loading("Gerando HTML do e-mail...");
        
        const layoutStyle = c.layoutStyle || "centered";
        const title = cleanText(c.subtitle || c.title, "Headline do e-mail");
        const heroBadge = cleanText(c.heroBadge, "");
        const cta = cleanText(c.cta, "");
        const footerInfo = cleanText(c.footerInfo, "");
        const offerRaw = builder.discoveryPlan?.offer;
        const hasOffer = !isEmptyLike(offerRaw);
        const testimonials = c.testimonials || [];
        const paragraphs = cleanText(c.body || "")
          .split(/\n+/)
          .map((p: string) => cleanText(p))
          .filter((p: string) => p.length > 0);
          
        let heroUrl = images[0] || null;
        if (!heroUrl && c.emailHeroImagePrompt) {
          heroUrl = buildPollinationsUrl(c.emailHeroImagePrompt, { width: 1200, height: 600, seed: c.imageSeed });
        }

        let testimonialsHtml = "";
        if (testimonials.length > 0) {
          testimonialsHtml = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; margin-bottom: 24px;">`;
          testimonials.forEach((test: string) => {
            const parts = test.split(/\||\n/);
            const head = parts[0]?.trim() || "";
            const txt = parts[1]?.trim() || test;
            
            let cardStyle = "";
            let titleStyle = "";
            let textStyle = "";

            if (layoutStyle === "minimalist") {
              cardStyle = `border-left: 4px solid ${themeColor}; padding: 10px 0 10px 16px; margin-bottom: 16px;`;
              titleStyle = `margin: 0 0 4px 0; font-weight: bold; font-size: 15px; color: #0f172a;`;
              textStyle = `margin: 0; font-size: 14px; color: #475569; font-style: italic; line-height: 1.5;`;
            } else if (layoutStyle === "split") {
              cardStyle = `background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-align: left;`;
              titleStyle = `margin: 0 0 6px 0; font-weight: bold; font-size: 15px; color: #0f172a;`;
              textStyle = `margin: 0; font-size: 14px; color: #475569; font-style: italic; line-height: 1.5;`;
            } else if (layoutStyle === "diagonal") {
               cardStyle = `background-color: #ffffff; border-left: 4px solid ${themeColor}; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-align: left;`;
               titleStyle = `margin: 0 0 4px 0; font-weight: bold; font-size: 15px; color: #0f172a;`;
               textStyle = `margin: 0; font-size: 14px; color: #475569; font-style: italic; line-height: 1.5;`;
            } else { 
               cardStyle = `background-color: #ffffff; border: 2px solid ${themeColor}; border-radius: 12px; padding: 20px; margin-bottom: 16px; text-align: left;`;
               titleStyle = `margin: 0 0 6px 0; font-weight: bold; font-size: 15px; color: #0f172a;`;
               textStyle = `margin: 0; font-size: 14px; color: #475569; font-style: italic; line-height: 1.5;`;
            }

            testimonialsHtml += `
                <tr>
                  <td>
                    <div style="${cardStyle}">
                      <p style="${titleStyle}">${head}</p>
                      <p style="${textStyle}">${txt.replace(/["']/g, '')}</p>
                    </div>
                  </td>
                </tr>
              `;
          });
          testimonialsHtml += `</table>`;
        }

        // MONTAGEM DOS 4 TEMPLATES DISTINTOS DE E-MAIL EM HTML
        let htmlContent = "";

        if (layoutStyle === "minimalist") {
          htmlContent = `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; font-family: Arial, sans-serif;">
              <tr>
                <td align="left" style="padding: 24px 32px;">
                  <h1 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase;">${brandName}</h1>
                </td>
              </tr>
              ${heroUrl ? `<tr><td align="center"><img src="${heroUrl}" width="100%" style="display: block; width: 100%; border-radius: 0;" alt="Hero"></td></tr>` : ''}
              <tr>
                <td align="left" style="padding: 32px;">
                  ${heroBadge ? `<div style="display: inline-block; background-color: #f1f5f9; color: #64748b; padding: 4px 12px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 16px;">${heroBadge}</div>` : ''}
                  <h2 style="color: #0f172a; font-size: 32px; font-weight: 900; margin: 0 0 24px 0; line-height: 1.2;">${title}</h2>
                  ${paragraphs.map((p: string) => `<p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">${p}</p>`).join('')}
                  ${testimonialsHtml}
                  ${hasOffer ? `<div style="background-color: #f8fafc; border: 1px solid #f1f5f9; color: ${themeColor}; border-radius: 8px; padding: 16px; margin: 24px 0; font-weight: bold; font-size: 18px; text-align: center;">${offerRaw}</div>` : ''}
                  ${cta ? `<div style="margin-top: 24px;"><a href="#" style="display: inline-block; background-color: ${themeColor}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">${cta}</a></div>` : ''}
                  ${footerInfo ? `<p style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">${footerInfo}</p>` : ''}
                </td>
              </tr>
            </table>
          `;
        } 
        else if (layoutStyle === "split") {
          htmlContent = `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); font-family: Arial, sans-serif;">
              ${heroUrl ? `<tr><td align="center"><img src="${heroUrl}" width="100%" style="display: block; width: 100%; height: 300px; object-fit: cover;" alt="Hero"></td></tr>` : ''}
              <tr>
                <td align="center" style="padding: 40px 30px; background-color: ${themeColor};">
                  <h1 style="color: rgba(255,255,255,0.8); margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">${brandName}</h1>
                  ${heroBadge ? `<div style="display: inline-block; background-color: rgba(255,255,255,0.2); color: #ffffff; padding: 4px 16px; border-radius: 20px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px;">${heroBadge}</div>` : ''}
                  <h2 style="color: #ffffff; font-size: 32px; font-weight: 900; margin: 0 0 24px 0; line-height: 1.1;">${title}</h2>
                  ${cta ? `<a href="#" style="display: inline-block; background-color: #ffffff; color: ${themeColor}; padding: 14px 32px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 14px;">${cta}</a>` : ''}
                </td>
              </tr>
              <tr>
                <td align="left" style="background-color: #f8fafc; padding: 40px 30px;">
                  ${paragraphs.map((p: string) => `<p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">${p}</p>`).join('')}
                  ${testimonialsHtml}
                  ${hasOffer ? `<div style="border: 2px solid #e2e8f0; background-color: #ffffff; border-radius: 12px; padding: 20px; margin-top: 24px; font-weight: bold; text-align: center; font-size: 18px; color: ${themeColor};">${offerRaw}</div>` : ''}
                  ${footerInfo ? `<p style="margin-top: 32px; font-size: 12px; color: #64748b; text-align: center;">${footerInfo}</p>` : ''}
                </td>
              </tr>
            </table>
          `;
        }
        else if (layoutStyle === "diagonal") {
          htmlContent = `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #f1f5f9; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); font-family: Arial, sans-serif;">
              <tr>
                <td align="center" style="padding: 40px 30px 60px 30px; background-color: ${themeColor};">
                  <h1 style="color: #ffffff; margin: 0 0 30px 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${brandName}</h1>
                  <h2 style="color: #ffffff; font-size: 34px; font-weight: 900; margin: 0; line-height: 1.15;">${title}</h2>
                </td>
              </tr>
              ${heroUrl ? `<tr><td align="center" style="padding: 0 30px;"><div style="margin-top: -30px; border: 4px solid #ffffff; border-radius: 12px; overflow: hidden; background-color: #e2e8f0;"><img src="${heroUrl}" width="100%" style="display: block; width: 100%; height: 200px; object-fit: cover;" alt="Hero"></div></td></tr>` : ''}
              <tr>
                <td align="center" style="padding: 30px 30px 40px 30px;">
                  ${heroBadge ? `<div style="display: inline-block; background-color: #ffffff; color: ${themeColor}; padding: 6px 16px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">${heroBadge}</div><br>` : ''}
                  ${paragraphs.map((p: string) => `<p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; text-align: left;">${p}</p>`).join('')}
                  ${testimonialsHtml}
                  ${hasOffer ? `<div style="background-color: #e2e8f0; color: #0f172a; border-radius: 8px; padding: 16px; margin: 24px 0; font-weight: bold; text-align: center; font-size: 18px;">${offerRaw}</div>` : ''}
                  ${cta ? `<div style="margin-top: 24px;"><a href="#" style="display: block; width: 100%; max-width: 280px; margin: 0 auto; background-color: ${themeColor}; color: #ffffff; padding: 16px 0; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; text-align: center;">${cta}</a></div>` : ''}
                  ${footerInfo ? `<p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">${footerInfo}</p>` : ''}
                </td>
              </tr>
            </table>
          `;
        }
        else {
          // CLÁSSICO CENTERED
          htmlContent = `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: ${themeColor}; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); font-family: Arial, sans-serif;">
              <tr>
                <td align="center" style="padding: 30px 20px 20px 20px;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-style: italic; letter-spacing: 1px; font-weight: 900;">${brandName}</h1>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 10px 30px 40px 30px;">
                  ${heroBadge ? `<div style="display: inline-block; background-color: rgba(255,255,255,0.15); color: #ffffff; padding: 4px 16px; border-radius: 20px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 20px;">${heroBadge}</div>` : ''}
                  <h2 style="color: #ffffff; font-size: 34px; font-weight: 900; margin: 0 0 24px 0; line-height: 1.1;">${title}</h2>
                  ${cta ? `<a href="#" style="display: inline-block; background-color: #86efac; color: ${themeColor}; padding: 14px 32px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 14px;">${cta}</a>` : ''}
                  ${heroUrl ? `<div style="margin-top: 32px;"><img src="${heroUrl}" width="100%" style="display: block; width: 100%; max-width: 100%; border-radius: 12px; border: 2px solid rgba(255,255,255,0.2); object-fit: cover; height: 220px;" alt="Hero"></div>` : ''}
                </td>
              </tr>
              <tr>
                <td align="center" style="background-color: #fffbf5; border-radius: 32px 32px 0 0; padding: 40px 30px;">
                  ${paragraphs.map((p: string, i: number) => `<p style="color: ${i === 0 ? '#0f172a' : '#475569'}; font-size: ${i === 0 ? '20px' : '16px'}; font-weight: ${i === 0 ? 'bold' : 'normal'}; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">${p}</p>`).join('')}
                  ${testimonialsHtml}
                  ${hasOffer ? `<div style="background-color: #86efac; color: ${themeColor}; border-radius: 12px; padding: 16px; margin-top: 32px; font-weight: bold; text-align: center; font-size: 18px;">${offerRaw}</div>` : ''}
                  ${cta ? `<div style="margin-top: 32px; text-align: center;"><a href="#" style="display: inline-block; background-color: #86efac; color: ${themeColor}; padding: 16px 36px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">${cta}</a></div>` : ''}
                  ${footerInfo ? `<p style="text-align: center; margin-top: 24px; font-size: 12px; color: #64748b; text-decoration: underline;">${footerInfo}</p>` : ''}
                </td>
              </tr>
              <tr>
                <td align="center" style="background-color: ${themeColor}; padding: 30px 20px;">
                  <h3 style="color: #ffffff; margin: 0 0 10px 0; font-size: 16px; font-style: italic; opacity: 0.9; font-weight: 900;">${brandName}</h3>
                  <p style="color: rgba(255,255,255,0.7); font-size: 11px; margin: 0; line-height: 1.5;">Siga o ${brandName} nas redes e saiba todas as ofertas e novidades em primeira mão.</p>
                </td>
              </tr>
            </table>
          `;
        }

        const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        ${htmlContent}
      </td>
    </tr>
  </table>
</body>
</html>`;

        const blobHtml = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
        const htmlUrl = URL.createObjectURL(blobHtml);
        const aHtml = document.createElement("a");
        aHtml.href = htmlUrl;
        aHtml.download = `email_${brandName.replace(/\s+/g, "_").toLowerCase()}.html`;
        document.body.appendChild(aHtml);
        aHtml.click();
        document.body.removeChild(aHtml);
        URL.revokeObjectURL(htmlUrl);
        
        toast.success("E-mail adaptável exportado com sucesso!", { id: toastId });
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
              <Input id="width" type="number" min="1" value={exportW} onChange={(e) => setExportW(e.target.value)} className="col-span-3 bg-surface-2 border-border-subtle text-fg-primary" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="height" className="text-right text-fg-secondary">Altura (px)</Label>
              <Input id="height" type="number" min="1" value={exportH} onChange={(e) => setExportH(e.target.value)} className="col-span-3 bg-surface-2 border-border-subtle text-fg-primary" />
            </div>
          </div>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="border-border-strong bg-transparent text-fg-secondary hover:bg-surface-2 hover:text-fg-primary" onClick={() => setExportDialogOpen(false)}>
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
              className="bg-brand text-brand-fg hover:brightness-110 shadow-[var(--shadow-brand)] disabled:opacity-50 disabled:cursor-not-allowed"
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