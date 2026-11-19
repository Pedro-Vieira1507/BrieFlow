import { useProductCatalog } from "@/hooks/useProductCatalog";
import { webDestination } from "@/lib/emailDelivery";
import { useMemo, useState } from "react";
import { Package, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTENT_FORMATS } from "@/lib/plans";
import { useBriefflowStore } from "@/store/briefflow";
import { getProduct, recordPilot, writeProducts } from "@/lib/productCatalog";
import {
  affectsOutput,
  applySkuReview,
  formatPrice,
  reviewSku,
  type CatalogProduct,
  type ReviewDecision,
  type SkuMention,
} from "@/lib/skuReview";
import { demoCampaign, demoProducts } from "@/lib/skuDemo";
import { campaignKey, factRevision } from "@/lib/skuPilot";
import { PilotResults } from "./PilotResults";
import { ProductCatalogDialog } from "./ProductCatalogDialog";
import { toast } from "sonner";

function FragmentPreview({
  issue,
  after,
}: {
  issue: SkuMention;
  after: boolean;
}) {
  const beforeContext = issue.text.slice(
    Math.max(0, issue.start - 60),
    issue.start,
  );
  const afterContext = issue.text.slice(issue.end, issue.end + 60);
  return (
    <p className="break-words text-sm leading-relaxed text-fg-secondary">
      <span className="font-semibold">{after ? "Proposta" : "Atual"} · </span>
      {issue.start > 60 ? "…" : ""}
      {beforeContext}
      <mark className="rounded bg-brand/20 px-0.5 text-fg-primary">
        {after ? issue.after : issue.before}
      </mark>
      {afterContext}
      {issue.end + 60 < issue.text.length ? "…" : ""}
    </p>
  );
}

export function CampaignProduct() {
  const { builder, user, workspaceVersion, loading, setBuilder } =
    useBriefflowStore();
  const { products, owner, ready, error } = useProductCatalog(user?.id);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>(
    {},
  );
  const approved = builder.skuLink?.approved;
  const product = products.find((p) => p.sku === approved?.sku);
  const issues = useMemo(
    () => (product ? reviewSku(builder, product) : []),
    [builder, product],
  );
  const affected =
    builder.campaignAssets?.filter((a) =>
      issues.some((issue) => affectsOutput(issue, a.type)),
    ) ?? [];
  const missingChoices = issues.some((i) => i.needsChoice && !decisions[i.id]);
  const isCurrent = () => {
    const now = useBriefflowStore.getState();
    return (
      now.workspaceVersion === workspaceVersion && now.user?.id === user?.id
    );
  };
  async function act(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      if (isCurrent())
        toast.error(
          e instanceof Error ? e.message : "Não foi possível concluir.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function openDemo() {
    await writeProducts(
      owner,
      demoProducts().map((input) => ({ input, expected: null })),
      true,
    );
    const coffee = await getProduct(owner, "DEMO-CAFE");
    if (
      coffee &&
      isCurrent() &&
      useBriefflowStore.getState().builder.type === "none"
    )
      setBuilder(demoCampaign(coffee));
  }
  async function approve() {
    if (!product) return;
    const latest = await getProduct(owner, product.sku);
    if (
      !latest ||
      latest.revision !== product.revision ||
      useBriefflowStore.getState().builder !== builder
    )
      throw new Error(
        "O texto ou o cadastro mudou. Confira os trechos atuais.",
      );
    if (!isCurrent()) return;
    const next = applySkuReview(builder, latest, decisions);
    setBuilder(next);
    const id = campaignKey(
      next,
      useBriefflowStore.getState().activeLibraryAssetId,
    );
    if (id)
      await recordPilot(owner, latest.sku, factRevision(latest), {
        type: "review",
        campaignId: id,
        at: Date.now(),
      }).catch(() =>
        toast.warning(
          "Os textos foram revisados. Não foi possível registrar o horário.",
        ),
      );
    setDecisions({});
    toast.success(
      "Revisão aprovada. Os textos já estão disponíveis para exportação.",
    );
  }
  function link(next: CatalogProduct) {
    if (!isCurrent()) return;
    setBuilder((current) => ({
      ...current,
      skuLink: {
        approved: next,
        campaignId:
          campaignKey(
            current,
            useBriefflowStore.getState().activeLibraryAssetId,
          ) || crypto.randomUUID(),
      },
    }));
    setEditing(false);
    toast.success("Produto vinculado à campanha.");
  }
  const empty = builder.type === "none";
  const status = product ?? approved;
  const sourceLink = webDestination(status?.source);
  return (
    <section
      aria-label="Produto da campanha"
      className="rounded-2xl border border-border-strong bg-surface-1 p-4 shadow-[var(--shadow-soft)] sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 font-semibold text-fg-primary">
            <Package className="size-4 text-brand" />
            Produto da campanha
          </h3>
          {status ? (
            <>
              <p className="break-words text-sm text-fg-primary">
                <strong>{status.name}</strong> · {status.sku} ·{" "}
                {formatPrice(status.priceCents)} · {status.unit}
              </p>
              <p className="break-words text-xs text-fg-tertiary">
                Fonte ·{" "}
                {sourceLink ? (
                  <a
                    className="underline underline-offset-2 hover:text-brand"
                    href={sourceLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {status.source}
                  </a>
                ) : (
                  status.source
                )}{" "}
                · {new Date(status.updatedAt).toLocaleString("pt-BR")}
              </p>
            </>
          ) : (
            <p className="text-sm text-fg-secondary">
              Vincule um SKU para conferir preço e embalagem nas peças.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {ready && <PilotResults key={owner} owner={owner} />}
          {empty && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy || loading || !ready}
              onClick={() => void act(openDemo)}
            >
              Testar com o café de exemplo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!ready || loading || busy}
            onClick={() => setEditing(true)}
          >
            <PencilLine className="mr-1 size-4" />
            {approved && product
              ? "Editar cadastro"
              : approved
                ? "Cadastrar fonte atual"
                : empty
                  ? "Abrir catálogo"
                  : "Vincular produto"}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-amber-300">
          {error}
        </p>
      )}
      {approved && ready && !product && (
        <p role="status" className="mt-2 text-sm text-amber-300">
          Cadastre ou importe a fonte atual deste SKU neste navegador para
          conferir as exportações.
        </p>
      )}
      {product && issues.length > 0 && (
        <div
          className="mt-4 space-y-3 border-t border-border-subtle pt-3"
          aria-label="Revisão do SKU"
        >
          <h4 className="text-sm font-semibold text-fg-primary">
            Revisar {issues.length} {issues.length === 1 ? "menção" : "menções"}
          </h4>
          {affected.length > 0 && (
            <p className="text-sm text-fg-secondary">
              Peças afetadas ·{" "}
              {affected
                .map((a) => CONTENT_FORMATS[a.type].shortLabel)
                .join(", ")}
            </p>
          )}
          <ul className="max-h-[28rem] space-y-3 overflow-y-auto">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className="space-y-1 rounded-xl border border-border-subtle bg-surface-2/60 p-3"
              >
                <h5 className="text-xs font-semibold text-fg-primary">
                  {issue.channel === "briefing"
                    ? "Briefing"
                    : CONTENT_FORMATS[issue.channel].shortLabel}{" "}
                  · {issue.label}
                </h5>
                <FragmentPreview issue={issue} after={false} />
                <FragmentPreview issue={issue} after />
                <label className="inline-flex max-w-full flex-wrap items-center gap-2 text-xs text-fg-secondary">
                  Decisão
                  <select
                    aria-label={
                      "Decisão para " + issue.before + " em " + issue.label
                    }
                    className="max-w-full rounded border border-border-strong bg-surface-1 p-1.5"
                    value={
                      decisions[issue.id] ?? (issue.needsChoice ? "" : "update")
                    }
                    onChange={(e) =>
                      setDecisions({
                        ...decisions,
                        [issue.id]: e.target.value as ReviewDecision,
                      })
                    }
                  >
                    {issue.needsChoice && <option value="">Escolher</option>}
                    <option value="update">Usar o dado do SKU</option>
                    <option value="keep">Manter como outro valor</option>
                  </select>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {product &&
        (issues.length > 0 || product.revision !== approved?.revision) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!issues.length && (
              <span className="text-sm text-fg-secondary">
                A fonte mudou. Os textos conferidos já estão atualizados.
              </span>
            )}
            <Button
              size="sm"
              disabled={missingChoices || busy || loading}
              onClick={() => void act(approve)}
            >
              Aprovar revisão
            </Button>
          </div>
        )}
      {product && !issues.length && product.revision === approved?.revision && (
        <p role="status" className="mt-2 text-xs text-fg-secondary">
          Textos conferidos com a fonte.
        </p>
      )}
      {approved && (
        <p className="mt-2 text-xs text-fg-tertiary">
          A revisão cobre os campos de texto. Confira à parte valores impressos
          em fotos.
        </p>
      )}
      {editing && (
        <ProductCatalogDialog
          owner={owner}
          products={products}
          initial={product}
          previousSnapshot={approved}
          canLink={!approved && !empty}
          onLink={link}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}
