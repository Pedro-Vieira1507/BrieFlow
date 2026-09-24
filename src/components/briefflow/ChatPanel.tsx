// src/components/briefflow/ChatPanel.tsx
import { useEffect, useRef } from "react";
import {
  asksForProductImage,
  withAttachedProductImage,
} from "@/lib/productImageContext";
import { uploadCampaignAsset } from "@/lib/supabase";
import { useBriefflowStore } from "@/store/briefflow";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessages } from "./chat/ChatMessages";
import { ChatInput } from "./chat/ChatInput";
import { CreditsBar } from "./CreditsBar";

interface Props {
  onSend: (text: string) => void;
}

const IMAGE_ATTACHED_CONTINUE_MESSAGE =
  "A foto real do produto já foi anexada e está disponível como imagem principal no BrieFlow. Considere esse requisito atendido e continue agora com a solicitação anterior, sem pedir a imagem novamente.";

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
  const pendingMessageRef = useRef<string | null>(null);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const hasCampaign = builder.type === "campaign";
  const currentStep = hasCampaign ? 5 : Math.min(5, userTurns + 1);
  const busy = loading || scraping;

  useEffect(() => {
    if (!user || !pendingMessageRef.current) return;
    const pendingMessage = pendingMessageRef.current;
    pendingMessageRef.current = null;
    onSend(pendingMessage);
  }, [onSend, user]);

  const handleProtectedSend = (text: string) => {
    if (!user) {
      pendingMessageRef.current = text;
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
      const discoveryPlan = withAttachedProductImage(
        current.discoveryPlan,
        url,
      );

      const campaignAssets =
        current.type === "campaign" && current.campaignAssets
          ? current.campaignAssets.map((asset) => {
              if (asset.type !== "banner") return asset;
              return {
                ...asset,
                content: {
                  ...asset.content,
                  productImageUrl: url,
                  // A deliberate manual upload is authoritative for the banner.
                  // Scraped/reference images stay out of the rendered hero layer.
                  productImages: [url],
                },
              };
            })
          : current.campaignAssets;

      return {
        ...current,
        productImageUrl: url,
        productImages: [url],
        discoveryPlan,
        campaignAssets,
      };
    });

    const lastAssistantMessage = [...messages]
      .reverse()
      .find(
        (message) => message.role === "assistant" && message.content.trim(),
      );

    if (
      lastAssistantMessage &&
      asksForProductImage(lastAssistantMessage.content)
    ) {
      // The upload itself answers the assistant's pending question. Continue
      // automatically so users never get stuck in an "attach, then explain
      // that it was attached" loop.
      onSend(IMAGE_ATTACHED_CONTINUE_MESSAGE);
    }
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
              const remainingImages = (
                asset.content.productImages ?? []
              ).filter((image) => image !== removedUrl);
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
