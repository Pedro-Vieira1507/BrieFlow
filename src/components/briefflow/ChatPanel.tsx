// src/components/briefflow/ChatPanel.tsx
import { uploadCampaignAsset } from "@/lib/supabase";
import { useBriefflowStore } from "@/store/briefflow";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessages } from "./chat/ChatMessages";
import { ChatInput } from "./chat/ChatInput";
import { CreditsBar } from "./CreditsBar";

interface Props {
  onSend: (text: string) => void;
}

export function ChatPanel({ onSend }: Props) {
  const {
    messages,
    builder,
    loading,
    scraping,
    user,
    uploadedImage,
    setAuthOpen,
    setUploadedImage,
    setBuilder,
  } = useBriefflowStore();

  const userTurns = messages.filter((m) => m.role === "user").length;
  const hasCampaign = builder.type === "campaign";
  const currentStep = hasCampaign ? 5 : Math.min(5, userTurns + 1);
  const busy = loading || scraping;

  const handleProtectedSend = (text: string) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    onSend(text);
  };

  const handleAttachImage = async (file: File) => {
    if (!user) {
      setAuthOpen(true);
      throw new Error("Entre na sua conta para anexar a foto do produto.");
    }

    const url = await uploadCampaignAsset(file, "products");
    setUploadedImage(url);

    setBuilder((current) => {
      const topLevelImages = Array.from(
        new Set([
          url,
          ...(current.productImages ?? []),
          ...(current.productImageUrl ? [current.productImageUrl] : []),
        ]),
      ).slice(0, 3);

      const discoveryPlan = current.discoveryPlan
        ? { ...current.discoveryPlan, productImageUrl: url }
        : current.discoveryPlan;

      const campaignAssets =
        current.type === "campaign" && current.campaignAssets
          ? current.campaignAssets.map((asset) => {
              if (asset.type !== "banner") return asset;
              const productImages = Array.from(
                new Set([
                  url,
                  ...(asset.content.productImages ?? []),
                  ...(asset.content.productImageUrl
                    ? [asset.content.productImageUrl]
                    : []),
                ]),
              ).slice(0, 3);
              return {
                ...asset,
                content: {
                  ...asset.content,
                  productImageUrl: url,
                  productImages,
                },
              };
            })
          : current.campaignAssets;

      return {
        ...current,
        productImageUrl: url,
        productImages: topLevelImages,
        discoveryPlan,
        campaignAssets,
      };
    });
  };

  const handleRemoveImage = () => {
    const removedUrl = uploadedImage;
    setUploadedImage(null);
    if (!removedUrl) return;

    setBuilder((current) => {
      const discoveryPlan =
        current.discoveryPlan?.productImageUrl === removedUrl
          ? { ...current.discoveryPlan, productImageUrl: null }
          : current.discoveryPlan;

      const campaignAssets =
        current.type === "campaign" && current.campaignAssets
          ? current.campaignAssets.map((asset) => {
              if (asset.type !== "banner") return asset;
              const remainingImages = (asset.content.productImages ?? []).filter(
                (image) => image !== removedUrl,
              );
              return {
                ...asset,
                content: {
                  ...asset.content,
                  productImageUrl:
                    asset.content.productImageUrl === removedUrl
                      ? (remainingImages[0] ?? null)
                      : asset.content.productImageUrl,
                  productImages: remainingImages,
                },
              };
            })
          : current.campaignAssets;

      const remainingTopLevel = (current.productImages ?? []).filter(
        (image) => image !== removedUrl,
      );

      return {
        ...current,
        productImageUrl:
          current.productImageUrl === removedUrl
            ? (remainingTopLevel[0] ?? null)
            : current.productImageUrl,
        productImages: remainingTopLevel,
        discoveryPlan,
        campaignAssets,
      };
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent text-fg-primary">
      <ChatHeader
        currentStep={currentStep}
        showStepper={messages.length > 0 || hasCampaign}
      />
      <CreditsBar />
      <ChatMessages
        messages={messages}
        loading={loading}
        scraping={scraping}
        onPickSuggestion={handleProtectedSend}
      />
      <ChatInput
        disabled={busy}
        onSend={handleProtectedSend}
        onAttachImage={handleAttachImage}
        onRemoveImage={handleRemoveImage}
        attachedImage={uploadedImage}
      />
    </div>
  );
}
