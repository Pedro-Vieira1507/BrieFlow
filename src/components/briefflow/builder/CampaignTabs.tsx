// src/components/briefflow/builder/CampaignTabs.tsx
import { useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BuilderState, CampaignAsset } from "@/types/builder";
import { EmailPreview } from "@/components/briefflow/EmailPreview";
import { BannerPreview } from "@/components/briefflow/BannerPreview";
import { SocialPreview } from "@/components/briefflow/SocialPreview";
import { cn } from "@/lib/utils";
import { Image, Instagram, Mail } from "lucide-react";

interface Props {
  assets: CampaignAsset[];
  onAssetChange: (assetId: string, patch: Partial<BuilderState>) => void;
  // NOVAS PROPS: Comunicação direta com o PageBuilder
  activeTab: CampaignAsset["type"];
  onTabChange: (tab: CampaignAsset["type"]) => void;
}

const CHANNELS: Array<{
  key: CampaignAsset["type"];
  label: string;
  icon: typeof Image;
}> = [
  { key: "banner", label: "Banner", icon: Image },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "social", label: "Social", icon: Instagram },
];

export function CampaignTabs({
  assets,
  onAssetChange,
  activeTab,
  onTabChange,
}: Props) {
  const previousAssetIdsRef = useRef<string[]>([]);

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
        <TabsList className="grid h-12 w-full max-w-[440px] grid-cols-3 rounded-2xl border border-border-strong bg-surface-1/90 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          {CHANNELS.map(({ key, label, icon: Icon }) => {
            const exists = assets.some((a) => a.type === key);
            return (
              <TabsTrigger
                key={key}
                value={key}
                disabled={!exists}
                className={cn(
                  "w-auto rounded-xl text-[11px] font-semibold tracking-wide text-fg-tertiary transition-all",
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

      {assets.map((asset) => (
        <TabsContent
          key={asset.id}
          value={asset.type}
          className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
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
