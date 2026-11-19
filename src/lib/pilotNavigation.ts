import type { BuilderState, CampaignAsset } from "../types/builder";
import { getPilotRun, getProduct, listPilotRuns } from "./productCatalog.ts";
import {
  campaignKey,
  deliverableAssets,
  factRevision,
  type PilotPiece,
} from "./skuPilot.ts";

export interface PilotAddress {
  revision: string;
  index: number;
}
export interface PilotTarget {
  owner: string;
  revision: string;
  sku: string;
  piece: PilotPiece;
}

export function pilotFragment(revision: string, index: number) {
  return "#revisar-peca=" + revision + "." + index;
}
export function parsePilotFragment(hash: string): PilotAddress | undefined {
  const match = /^#revisar-peca=([a-z0-9-]{1,80})\.(0|[1-9]\d{0,6})$/i.exec(
    hash,
  );
  return match ? { revision: match[1], index: Number(match[2]) } : undefined;
}
export async function getPendingTarget(
  owner: string,
  address: PilotAddress,
  sku?: string,
): Promise<PilotTarget> {
  const run = sku
    ? await getPilotRun(owner, sku, address.revision)
    : (await listPilotRuns(owner)).find((r) => r.revision === address.revision);
  const piece = run?.pieces[address.index];
  if (!run || !piece)
    throw new Error(
      "Esta medição não está disponível nesta conta e neste navegador.",
    );
  if (run.supersededAt != null)
    throw new Error(
      "Uma mudança mais recente substituiu esta revisão. Abra a mudança atual em Resultados do piloto.",
    );
  if (piece.exportedAt != null)
    throw new Error(
      "Esta peça já foi exportada. Consulte as demais pendências no painel.",
    );
  const product = await getProduct(owner, run.sku);
  if (!product || factRevision(product) !== run.revision)
    throw new Error(
      "O cadastro do produto mudou. Abra a revisão atual no painel.",
    );
  return { owner, revision: run.revision, sku: run.sku, piece };
}
export function targetAsset(
  target: PilotTarget,
  state: BuilderState,
  libraryId?: string | null,
): CampaignAsset | undefined {
  if (
    state.skuLink?.approved.sku !== target.sku ||
    campaignKey(state, libraryId) !== target.piece.campaignId
  )
    return;
  return deliverableAssets(state).find(
    (a) =>
      a.id === target.piece.assetId &&
      a.type === target.piece.channel &&
      !a.content.generationError,
  );
}
