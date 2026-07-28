import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BuilderState, CampaignAsset } from "@/types/builder";
import { EmailPreview } from "@/components/briefflow/EmailPreview";
import { BannerPreview } from "@/components/briefflow/BannerPreview";
import { SocialPreview } from "@/components/briefflow/SocialPreview";
import { cn } from "@/lib/utils";

interface Props {
  assets: CampaignAsset[];
  onAssetChange: (assetId: string, patch: Partial<BuilderState>) => void;
}

const CHANNELS: Array<{ key: CampaignAsset["type"]; label: string }> = [
  { key: "banner", label: "Banner" },
  { key: "email", label: "E-mail" },
  { key: "social", label: "Social" },
];

export function CampaignTabs({ assets, onAssetChange }: Props) {
  const [tab, setTab] = useState<CampaignAsset["type"]>(
    assets[0]?.type ?? "banner",
  );

  // Ao aparecer um novo asset, foca nele
  useEffect(() => {
    if (assets.length) setTab(assets[assets.length - 1].type);
  }, [assets.length]);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as CampaignAsset["type"])} className="w-full">
      <TabsList
        className={cn(
          "mx-auto mb-8 grid h-12 w-full max-w-md grid-cols-3 rounded-2xl p-1",
          "border border-border-strong bg-surface-2",
        )}
      >
        {CHANNELS.map(({ key, label }) => {
          const has = assets.some((a) => a.type === key);
          return (
            <TabsTrigger
              key={key}
              value={key}
              disabled={!has}
              className={cn(
                "rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all",
                "text-fg-muted",
                "data-[state=active]:bg-surface-3 data-[state=active]:text-fg-primary",
                "data-[state=active]:shadow-[var(--shadow-soft)]",
              )}
            >
              {label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {assets.map((asset) => (
        <TabsContent
          key={asset.id}
          value={asset.type}
          className="mt-0 fade-in-up"
        >
          <AssetPreview
            type={asset.type}
            content={asset.content}
            onChange={(patch) => onAssetChange(asset.id, patch)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function AssetPreview({
  type,
  content,
  onChange,
}: {
  type: CampaignAsset["type"];
  content: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}) {
  if (type === "email") return <EmailPreview state={content} onChange={onChange} />;
  if (type === "banner") return <BannerPreview state={content} onChange={onChange} />;
  return <SocialPreview state={content} onChange={onChange} />;
}
