// src/components/briefflow/builder/CampaignTabs.tsx
import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BuilderState, CampaignAsset } from "@/types/builder";
import { EmailPreview } from "@/components/briefflow/EmailPreview";
import { BannerPreview } from "@/components/briefflow/BannerPreview";
import { SocialPreview } from "@/components/briefflow/SocialPreview";
import { cn } from "@/lib/utils";

interface Props {
  assets: CampaignAsset[];
  onAssetChange: (assetId: string, patch: Partial<BuilderState>) => void;
  // NOVAS PROPS: Comunicação direta com o PageBuilder
  activeTab: CampaignAsset["type"];
  onTabChange: (tab: CampaignAsset["type"]) => void;
}

const CHANNELS: Array<{ key: CampaignAsset["type"]; label: string }> = [
  { key: "banner", label: "Banner" },
  { key: "email", label: "E-mail" },
  { key: "social", label: "Social" },
];

export function CampaignTabs({ assets, onAssetChange, activeTab, onTabChange }: Props) {
  // Ao aparecer um novo asset gerado pela IA, foca automaticamente nele
  useEffect(() => {
    if (assets.length) {
      onTabChange(assets[assets.length - 1].type);
    }
  }, [assets.length, onTabChange]);

  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as CampaignAsset["type"])} className="w-full">
      <div className="mb-8 flex justify-center">
        <TabsList className="h-12 bg-surface-2 p-1 shadow-sm border border-border-subtle">
          {CHANNELS.map(({ key, label }) => {
            const exists = assets.some((a) => a.type === key);
            return (
              <TabsTrigger
                key={key}
                value={key}
                disabled={!exists}
                className={cn(
                  "w-32 rounded-lg text-[13px] font-bold uppercase tracking-wider transition-all",
                  "data-[state=active]:bg-brand data-[state=active]:text-brand-fg data-[state=active]:shadow-md",
                  !exists && "opacity-40"
                )}
              >
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {assets.map((asset) => (
        <TabsContent key={asset.id} value={asset.type} className="mt-0 outline-none">
          {asset.type === "banner" && (
            <BannerPreview
              state={asset.content}
              onChange={(patch) => onAssetChange(asset.id, patch)}
            />
          )}
          {asset.type === "email" && (
            <EmailPreview
              state={asset.content}
              onChange={(patch) => onAssetChange(asset.id, patch)}
            />
          )}
          {asset.type === "social" && (
            <SocialPreview
              state={asset.content}
              onChange={(patch) => onAssetChange(asset.id, patch)}
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}