import type { BuilderState, CampaignAsset } from "../types/builder";
import type { MaterialType } from "../types/brief";
import {
  applySkuReview,
  reviewSku,
  type CatalogProduct,
  type SkuMention,
  type ReviewDecision,
} from "./skuReview.ts";
import { formatStructuredContentText } from "./structuredContent.ts";
import { buildSocialExportText } from "./export-utils.ts";
import { buildDeliveryEmail } from "./emailDelivery.ts";

export type PilotScope = "library" | "canvas" | "partial";
export type PilotFormat = "TXT" | "HTML" | "PNG" | "JPG" | "PDF" | "PPTX";
export interface PilotCampaign {
  id: string;
  name: string;
  state: BuilderState;
}
export interface PilotCohort {
  scope: PilotScope;
  campaigns: PilotCampaign[];
}
export interface PilotPiece {
  campaignId: string;
  campaignName: string;
  assetId: string;
  channel: MaterialType;
  reviewedAt?: number;
  exportedAt?: number;
  format?: PilotFormat;
}
export interface PilotRun {
  owner: string;
  sku: string;
  revision: string;
  name: string;
  startedAt: number;
  scope: PilotScope;
  demonstration: boolean;
  examined: number;
  pieces: PilotPiece[];
  before: { priceCents: number; unit: string };
  after: { priceCents: number; unit: string };
  supersededAt?: number;
  manualSeconds?: number;
}
export type PilotEvent =
  | { type: "review"; campaignId: string; at: number }
  | {
      type: "file";
      campaignId: string;
      assetId: string;
      channel: MaterialType;
      format: PilotFormat;
      at: number;
    }
  | { type: "supersede"; at: number }
  | { type: "manual"; seconds?: number };

export const factRevision = (product: CatalogProduct) =>
  product.factRevision ?? product.revision;
export const campaignKey = (state?: BuilderState, libraryId?: string | null) =>
  state?.skuLink?.campaignId || (libraryId ? "saved:" + libraryId : undefined);
export function withPilotIdentity(
  state: BuilderState,
  libraryId?: string | null,
): BuilderState {
  if (!state.skuLink || state.skuLink.campaignId) return state;
  return {
    ...state,
    skuLink: {
      ...state.skuLink,
      campaignId: campaignKey(state, libraryId) || crypto.randomUUID(),
    },
  };
}
export function copySkuCampaign(state: BuilderState): BuilderState {
  return state.skuLink
    ? {
        ...state,
        skuLink: { ...state.skuLink, campaignId: crypto.randomUUID() },
      }
    : state;
}
function issueKey(issue: SkuMention) {
  return JSON.stringify([issue.key, issue.start, issue.before, issue.after]);
}
function deliveryText(
  asset: Pick<CampaignAsset, "type" | "content">,
  offer?: string,
) {
  const c = asset.content;
  if (asset.type === "email")
    return buildDeliveryEmail(c, "https://example.org/", "", offer);
  if (asset.type === "social") return buildSocialExportText(c);
  if (asset.type === "banner")
    return JSON.stringify([
      c.brandName,
      c.title,
      c.subtitle,
      c.body,
      c.cta,
      c.footerInfo,
      c.badgePrimary,
      c.badgeSecondary,
      c.keyBenefits,
    ]);
  const d = c.structuredContent;
  if (!d) return "";
  if (d.format === "technical_sheet")
    return JSON.stringify([
      c.brandName,
      d.title,
      d.subtitle,
      d.summary,
      d.keywords,
      d.disclaimer,
      d.sections.map((s) => [s.title, s.body, s.items]),
    ]);
  if (d.format === "slides")
    return JSON.stringify([
      c.brandName,
      d.title,
      d.subtitle,
      d.summary,
      d.cta,
      d.disclaimer,
      d.sections.map((s) => [
        s.title,
        s.body,
        s.items?.slice(0, 10),
        s.timing,
        s.visualDirection,
        s.speakerNotes,
      ]),
    ]);
  return formatStructuredContentText(d);
}
function deliverableAssets(
  state: BuilderState,
): Pick<CampaignAsset, "id" | "type" | "content">[] {
  if (state.type === "campaign") return state.campaignAssets ?? [];
  if (state.type === "none" || state.type === "discovery_plan") return [];
  return [{ id: "standalone", type: state.type, content: state }];
}
export function startPilotRun(
  owner: string,
  previous: CatalogProduct,
  product: CatalogProduct,
  cohort: PilotCohort,
): PilotRun {
  const pieces: PilotPiece[] = [];
  const linked = cohort.campaigns.filter(
    (c) => c.state.skuLink?.approved.sku === product.sku,
  );
  let examined = 0;
  for (const campaign of linked) {
    const state = campaign.state;
    const assets = deliverableAssets(state);
    examined += assets.filter((a) => !a.content.generationError).length;
    const alreadyPending = new Set(reviewSku(state, previous).map(issueKey));
    const issues = reviewSku(state, product);
    if (!issues.some((i) => !alreadyPending.has(issueKey(i)))) continue;
    // Project the new proposals on a copy. Existing issues and the user's draft stay intact.
    const decisions: Record<string, ReviewDecision> = Object.fromEntries(
      issues.map((i) => [
        i.id,
        alreadyPending.has(issueKey(i)) ? "keep" : "update",
      ]),
    );
    const proposed = applySkuReview(state, product, decisions);
    const outputs = deliverableAssets(proposed);
    assets.forEach((asset, index) => {
      if (asset.content.generationError) return;
      if (
        deliveryText(asset, state.discoveryPlan?.offer) !==
        deliveryText(outputs[index], proposed.discoveryPlan?.offer)
      )
        pieces.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          assetId: asset.id,
          channel: asset.type,
        });
    });
  }
  const facts = (p: CatalogProduct) => ({
    priceCents: p.priceCents,
    unit: p.unit,
  });
  return {
    owner,
    sku: product.sku,
    revision: factRevision(product),
    name: product.name,
    startedAt: Date.parse(product.updatedAt),
    scope: cohort.scope,
    demonstration:
      linked.length > 0
        ? linked.every((c) => c.state.skuLink?.demo === true)
        : product.source === "Catálogo de demonstração",
    examined,
    pieces,
    before: facts(previous),
    after: facts(product),
  };
}
export function pilotFinishedAt(run: PilotRun): number | undefined {
  if (
    run.scope === "partial" ||
    run.supersededAt != null ||
    !run.pieces.length ||
    run.pieces.some((p) => p.exportedAt == null)
  )
    return undefined;
  return Math.max(...run.pieces.map((p) => p.exportedAt!));
}
export function pilotStatus(run: PilotRun) {
  if (run.scope === "partial") return "Amostra parcial";
  if (run.supersededAt != null) return "Substituída";
  if (!run.pieces.length) return "Sem peças afetadas";
  return pilotFinishedAt(run) != null ? "Concluída" : "Em andamento";
}
function validFile(channel: MaterialType, format: PilotFormat) {
  if (channel === "banner") return format === "PNG" || format === "JPG";
  if (channel === "email") return format === "HTML";
  if (channel === "slides") return format === "PPTX";
  if (channel === "technical_sheet") return format === "PDF";
  return format === "TXT";
}
export function applyPilotEvent(run: PilotRun, event: PilotEvent): PilotRun {
  if (event.type === "manual") {
    if (
      event.seconds != null &&
      (!Number.isSafeInteger(event.seconds) || event.seconds <= 0)
    )
      throw new Error("Informe um tempo manual maior que zero.");
    return event.seconds === run.manualSeconds
      ? run
      : { ...run, manualSeconds: event.seconds };
  }
  if (
    run.supersededAt != null ||
    event.at < run.startedAt ||
    !Number.isFinite(event.at)
  )
    return run;
  if (event.type === "supersede") {
    return run.pieces.some((p) => p.exportedAt == null)
      ? { ...run, supersededAt: event.at }
      : run;
  }
  let changed = false;
  const pieces = run.pieces.map((piece) => {
    if (piece.campaignId !== event.campaignId) return piece;
    if (event.type === "review") {
      if (piece.reviewedAt != null || piece.exportedAt != null) return piece;
      changed = true;
      return { ...piece, reviewedAt: event.at };
    }
    if (
      piece.assetId !== event.assetId ||
      piece.channel !== event.channel ||
      piece.exportedAt != null ||
      !validFile(piece.channel, event.format)
    )
      return piece;
    changed = true;
    return { ...piece, exportedAt: event.at, format: event.format };
  });
  return changed ? { ...run, pieces } : run;
}
export function pilotDuration(ms: number) {
  const seconds = Math.round(Math.abs(ms) / 1000);
  if (seconds < 60) return seconds + " s";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + " min " + (seconds % 60) + " s";
  return Math.floor(minutes / 60) + " h " + (minutes % 60) + " min";
}
const scopeLabels: Record<PilotScope, string> = {
  library: "Biblioteca e campanha aberta",
  canvas: "Campanha aberta",
  partial: "Biblioteca indisponível",
};
export const pilotScopeLabel = (scope: PilotScope) => scopeLabels[scope];
const iso = (date?: number) =>
  date == null ? "" : new Date(date).toISOString();
function csvCell(value: string | number | undefined) {
  const str = value == null ? "" : String(value);
  const safe =
    typeof value === "string" &&
    (/^\s*[=+\-@]/.test(str) || /^[\t\r\n]/.test(str))
      ? "'" + str
      : str;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function pilotCsv(runs: PilotRun[]) {
  const rows: (string | number | undefined)[][] = [
    [
      "sku",
      "produto",
      "revisao",
      "amostra",
      "abrangencia",
      "estado",
      "preco_anterior_centavos",
      "preco_novo_centavos",
      "embalagem_anterior",
      "embalagem_nova",
      "inicio_utc",
      "substituida_em_utc",
      "pecas_conferidas",
      "pecas_afetadas",
      "campanha",
      "id_campanha",
      "id_peca",
      "canal",
      "aprovacao_explicita_utc",
      "exportacao_utc",
      "formato_final",
      "ultima_entrega_utc",
      "tempo_total_s",
      "tempo_manual_informado_s",
      "diferenca_manual_menos_brieflow_s",
    ],
  ];
  for (const run of runs) {
    const end = pilotFinishedAt(run),
      seconds =
        end == null ? undefined : Math.round((end - run.startedAt) / 1000);
    for (const piece of run.pieces.length ? run.pieces : [undefined]) {
      rows.push([
        run.sku,
        run.name,
        run.revision,
        run.demonstration ? "Demonstração" : "Catálogo cadastrado",
        pilotScopeLabel(run.scope),
        pilotStatus(run),
        run.before.priceCents,
        run.after.priceCents,
        run.before.unit,
        run.after.unit,
        iso(run.startedAt),
        iso(run.supersededAt),
        run.examined,
        run.pieces.length,
        piece?.campaignName,
        piece?.campaignId,
        piece?.assetId,
        piece?.channel,
        iso(piece?.reviewedAt),
        iso(piece?.exportedAt),
        piece?.format,
        iso(end),
        seconds,
        run.manualSeconds,
        seconds != null && run.manualSeconds != null
          ? run.manualSeconds - seconds
          : undefined,
      ]);
    }
  }
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
