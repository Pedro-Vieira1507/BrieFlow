import { useBriefflowStore } from "@/store/briefflow";
import { catalogOwner, getProduct, recordPilot } from "./productCatalog";
import { affectsOutput, reviewSku } from "./skuReview";
import { toast } from "sonner";
import { campaignKey, factRevision, type PilotFormat } from "./skuPilot";
import { exportStructuredDocument } from "./structuredDocumentExport";
import type {
  BuilderState,
  CampaignAsset,
  StructuredContentDocument,
} from "@/types/builder";

export async function checkSku(
  state?: BuilderState,
  channel?: CampaignAsset["type"],
) {
  if (!state?.skuLink) return;
  const owner = catalogOwner(useBriefflowStore.getState().user?.id);
  const sku = state.skuLink.approved.sku;
  const current = await getProduct(owner, sku);
  if (owner !== catalogOwner(useBriefflowStore.getState().user?.id))
    throw new Error("A conta mudou. Reabra a campanha.");
  if (!current)
    throw new Error(
      "Cadastre a fonte atual de " +
        sku +
        " no catálogo deste navegador para conferir a campanha.",
    );
  const changes = reviewSku(state, current);
  if (changes.some((issue) => !channel || affectsOutput(issue, channel)))
    throw new Error(
      "Há valores pendentes para " +
        sku +
        ". Abra a campanha no estúdio e revise os trechos em Produto da campanha.",
    );
  return current;
}

export async function prepareSkuDelivery(
  state: BuilderState | undefined,
  channel: CampaignAsset["type"],
  assetId?: string,
) {
  const workspace = useBriefflowStore.getState();
  const owner = state?.skuLink ? catalogOwner(workspace.user?.id) : undefined;
  const current = await checkSku(state, channel);
  const campaignId = campaignKey(
    state,
    workspace.builder === state ? workspace.activeLibraryAssetId : undefined,
  );
  const piece =
    assetId ||
    (state?.type === "campaign"
      ? state.campaignAssets?.find((a) => a.type === channel)?.id
      : "standalone");
  if (!owner || !current || !campaignId || !piece) return undefined;
  return async (format: PilotFormat) => {
    try {
      await recordPilot(owner, current.sku, factRevision(current), {
        type: "file",
        campaignId,
        assetId: piece,
        channel,
        format,
        at: Date.now(),
      });
    } catch {
      toast.warning("Arquivo exportado. Não foi possível registrar o horário.");
    }
  };
}

export async function exportSkuDocument(
  campaign: BuilderState,
  document: StructuredContentDocument,
  brand?: string,
  assetId?: string,
) {
  let receipt: Awaited<ReturnType<typeof prepareSkuDelivery>>;
  const format = await exportStructuredDocument(document, brand, async () => {
    receipt = await prepareSkuDelivery(campaign, document.format, assetId);
  });
  await receipt?.(format);
  return format;
}
