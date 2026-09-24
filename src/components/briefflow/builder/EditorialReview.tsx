import { ClipboardCheck, ArrowUpRight } from "lucide-react";
import { reviewEditorialContent } from "@/lib/editorialReview";
import { toMarketingBrief } from "@/types/brief";
import { useBriefflowStore } from "@/store/briefflow";
import type { CampaignAsset } from "@/types/builder";

export function EditorialReview({
  asset,
  onOpenChat,
}: {
  asset: CampaignAsset;
  onOpenChat?: () => void;
}) {
  const { builder, brandContext } = useBriefflowStore();
  const brief = toMarketingBrief({ brandContext, plan: builder.discoveryPlan });
  const issues = reviewEditorialContent(
    asset.type,
    asset.content,
    brief,
    builder.campaignAssets,
  );
  return (
    <details className="mb-5 rounded-2xl border border-border-strong bg-surface-1/85 px-4 py-3 text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 font-semibold text-fg-primary focus-visible:outline-brand">
        <ClipboardCheck className="size-4 text-brand" aria-hidden />
        Revisão editorial
        <span className="ml-auto rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-fg-secondary">
          {issues.length
            ? `${issues.length} ${issues.length === 1 ? "ponto para revisar" : "pontos para revisar"}`
            : "Pronta para sua revisão"}
        </span>
      </summary>
      <p className="mt-2 text-xs leading-5 text-fg-tertiary">
        Verificação de clareza e consistência com o briefing. Confira fatos,
        direitos de imagem e condições comerciais antes de publicar.
      </p>
      {issues.length > 0 && (
        <ul className="mt-3 space-y-2">
          {issues.map((issue) => (
            <li
              key={issue.code}
              className="rounded-xl bg-surface-2 p-3 text-xs leading-5 text-fg-secondary"
            >
              <span
                className={
                  issue.severity === "blocking"
                    ? "text-rose-300"
                    : "text-amber-200"
                }
              >
                {issue.severity === "blocking" ? "Concluir: " : "Revisar: "}
              </span>
              {issue.message}
              {issue.excerpt && (
                <p className="mt-1 font-mono text-fg-muted">{issue.excerpt}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onOpenChat}
        className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-brand"
      >
        Refinar com o assistente <ArrowUpRight className="size-4" />
      </button>
    </details>
  );
}
