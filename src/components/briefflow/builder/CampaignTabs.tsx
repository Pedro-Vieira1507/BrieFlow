// src/components/briefflow/builder/CampaignTabs.tsx
import { useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BuilderState, CampaignAsset } from "@/types/builder";
import { EmailPreview } from "@/components/briefflow/EmailPreview";
import { BannerPreview } from "@/components/briefflow/BannerPreview";
import { SocialPreview } from "@/components/briefflow/SocialPreview";
import { StructuredContentPreview } from "@/components/briefflow/StructuredContentPreview";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clapperboard,
  FileText,
  Image,
  Instagram,
  Mail,
  MessageCircle,
  Mic2,
  Presentation,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTENT_FORMATS } from "@/lib/plans";
import { CORE_MATERIAL_TYPES, MATERIAL_TYPES } from "@/types/brief";
import {
  getCampaignBrandName,
  getGenerationErrorMessage,
} from "@/lib/campaignGeneration";

interface Props {
  assets: CampaignAsset[];
  onAssetChange: (assetId: string, patch: Partial<BuilderState>) => void;
  // NOVAS PROPS: Comunicação direta com o PageBuilder
  activeTab: CampaignAsset["type"];
  onTabChange: (tab: CampaignAsset["type"]) => void;
  loading?: boolean;
  onRetry?: (channel: CampaignAsset["type"]) => void | Promise<void>;
}

const CHANNELS: Array<{
  key: CampaignAsset["type"];
  label: string;
  icon: typeof Image;
}> = [
  { key: "banner", label: "Banner", icon: Image },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "social", label: "Social", icon: Instagram },
  { key: "reel", label: "Reel", icon: Clapperboard },
  { key: "video", label: "Vídeo", icon: Clapperboard },
  { key: "podcast", label: "Podcast", icon: Mic2 },
  { key: "slides", label: "Slides", icon: Presentation },
  { key: "technical_sheet", label: "Ficha técnica", icon: ScrollText },
  { key: "blog", label: "Blog", icon: FileText },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

export function CampaignTabs({
  assets,
  onAssetChange,
  activeTab,
  onTabChange,
  loading = false,
  onRetry,
}: Props) {
  const previousAssetIdsRef = useRef<string[]>([]);
  const campaignBrandName = getCampaignBrandName(assets);
  const visibleChannels = CHANNELS.filter(
    ({ key }) =>
      assets.some((asset) => asset.type === key) ||
      (CORE_MATERIAL_TYPES as readonly string[]).includes(key),
  ).sort(
    (left, right) =>
      MATERIAL_TYPES.indexOf(left.key) - MATERIAL_TYPES.indexOf(right.key),
  );

  // Ao aparecer um novo asset gerado pela IA, foca automaticamente nele
  useEffect(() => {
    if (!assets.length) return;

    const previousIds = previousAssetIdsRef.current;
    const newAsset = assets.find((asset) => !previousIds.includes(asset.id));
    const activeStillExists = assets.some((asset) => asset.type === activeTab);

    if (newAsset) onTabChange(newAsset.type);
    else if (!activeStillExists) onTabChange(assets[0].type);

    previousAssetIdsRef.current = assets.map((asset) => asset.id);
  }, [activeTab, assets, onTabChange]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as CampaignAsset["type"])}
      className="w-full"
    >
      <div className="sticky top-0 z-[5] mb-6 flex justify-center lg:mb-8">
        <TabsList className="flex h-12 w-full max-w-[min(100%,760px)] justify-start gap-1 overflow-x-auto rounded-2xl border border-border-strong bg-surface-1/90 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          {visibleChannels.map(({ key, label, icon: Icon }) => {
            const exists = assets.some((a) => a.type === key);
            return (
              <TabsTrigger
                key={key}
                value={key}
                disabled={!exists}
                className={cn(
                  "w-auto shrink-0 rounded-xl px-3 text-[11px] font-semibold tracking-wide text-fg-tertiary transition-all",
                  "data-[state=active]:bg-brand-muted data-[state=active]:text-brand data-[state=active]:shadow-[inset_0_0_0_1px_rgba(124,105,255,0.22)]",
                  !exists && "opacity-40",
                )}
              >
                <Icon className="mr-1.5 size-3.5" />
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {assets.map((asset) => {
        const generationError = getGenerationErrorMessage(asset.content);
        const channel = CHANNELS.find(({ key }) => key === asset.type);

        return (
          <TabsContent
            key={asset.id}
            value={asset.type}
            className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {generationError ? (
              <div className="mx-auto flex min-h-[420px] max-w-2xl flex-col items-center justify-center rounded-[28px] border border-amber-400/20 bg-surface-1/90 px-8 py-12 text-center shadow-[var(--shadow-elevated)]">
                <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
                  <AlertTriangle className="size-7" />
                </div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">
                  {asset.content.brandName || campaignBrandName || "Campanha"} ·{" "}
                  {channel?.label ?? CONTENT_FORMATS[asset.type].shortLabel}
                </p>
                <h3 className="text-2xl font-semibold tracking-tight text-fg-primary">
                  Esta peça não ficou pronta
                </h3>
                <p className="mt-3 max-w-lg text-sm leading-6 text-fg-secondary">
                  {generationError}
                </p>
                <Button
                  type="button"
                  className="mt-7 rounded-xl"
                  disabled={loading}
                  onClick={() => void onRetry?.(asset.type)}
                >
                  <RefreshCw
                    className={cn("mr-2 size-4", loading && "animate-spin")}
                  />
                  {loading ? "Gerando novamente..." : "Tentar novamente"}
                </Button>
                <p className="mt-4 text-xs text-fg-muted">
                  As outras peças da campanha serão preservadas.
                </p>
              </div>
            ) : asset.type === "banner" ? (
              <BannerPreview
                state={asset.content}
                onChange={(patch) => onAssetChange(asset.id, patch)}
              />
            ) : asset.type === "email" ? (
              <EmailPreview
                state={asset.content}
                onChange={(patch) => onAssetChange(asset.id, patch)}
              />
            ) : asset.type === "social" ? (
              <SocialPreview
                state={asset.content}
                onChange={(patch) => onAssetChange(asset.id, patch)}
              />
            ) : (
              <StructuredContentPreview
                state={asset.content}
                onChange={(patch) => onAssetChange(asset.id, patch)}
              />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
