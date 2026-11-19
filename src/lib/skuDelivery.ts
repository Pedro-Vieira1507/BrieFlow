import { useBriefflowStore } from "@/store/briefflow";
import { catalogOwner, getProduct } from "./productCatalog";
import { affectsOutput, reviewSku } from "./skuReview";
import type { BuilderState, CampaignAsset } from "@/types/builder";

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
