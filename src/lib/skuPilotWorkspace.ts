import { useBriefflowStore } from "@/store/briefflow";
import {
  catalogOwner,
  getProduct,
  writeProducts,
  type CatalogWrite,
} from "./productCatalog";
import {
  campaignKey,
  withPilotIdentity,
  type PilotCampaign,
  type PilotScope,
} from "./skuPilot";
import { getSavedSkuCampaigns } from "./supabase";

export async function updateCatalog(owner: string, updates: CatalogWrite[]) {
  const initial = useBriefflowStore.getState();
  function currentWorkspace() {
    const current = useBriefflowStore.getState();
    if (
      owner !== catalogOwner(current.user?.id) ||
      initial.workspaceVersion !== current.workspaceVersion
    )
      throw new Error("A campanha ou a conta mudou. Reabra o catálogo.");
    return current;
  }
  currentWorkspace();
  const changes = await Promise.all(
    updates
      .filter((u) => u.expected !== null)
      .map(async ({ input }) => {
        const before = await getProduct(owner, input.sku);
        return before &&
          (before.priceCents !== input.priceCents || before.unit !== input.unit)
          ? input.sku
          : undefined;
      }),
  );
  const skus = new Set(changes.filter((sku): sku is string => Boolean(sku)));
  const campaigns = new Map<string, PilotCampaign>();
  let scope: PilotScope = "canvas";
  if (skus.size && initial.user) {
    try {
      const saved = await getSavedSkuCampaigns(initial.user.id, skus);
      for (const item of saved) {
        const id = campaignKey(item.content, item.id)!;
        campaigns.set(id, {
          id,
          libraryAssetId: item.id,
          name: item.name,
          state: item.content,
        });
      }
      scope = "library";
    } catch {
      scope = "partial";
    }
  }
  const current = currentWorkspace();
  const link = current.builder.skuLink;
  if (link && skus.has(link.approved.sku)) {
    const state = withPilotIdentity(
      current.builder,
      current.activeLibraryAssetId,
    );
    if (state !== current.builder) current.setBuilder(state);
    const id = state.skuLink!.campaignId!;
    campaigns.set(id, {
      id,
      libraryAssetId:
        current.activeLibraryAssetId ?? campaigns.get(id)?.libraryAssetId,
      name:
        campaigns.get(id)?.name ||
        state.brandName ||
        state.discoveryPlan?.brandName ||
        "Campanha aberta",
      state,
    });
  }
  await writeProducts(owner, updates, false, {
    scope,
    campaigns: [...campaigns.values()],
  });
}
