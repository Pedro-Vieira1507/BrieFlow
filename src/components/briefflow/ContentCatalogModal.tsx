import {
  Clapperboard,
  FileText,
  Image,
  Instagram,
  Loader2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Mic2,
  Presentation,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCredits } from "@/hooks/useCredits";
import { CONTENT_FORMATS, PLAN_CATALOG, canUseMaterial } from "@/lib/plans";
import { MATERIAL_TYPES, type MaterialType } from "@/types/brief";

const FORMAT_ICONS: Record<MaterialType, typeof Sparkles> = {
  banner: Image,
  email: Mail,
  social: Instagram,
  reel: Clapperboard,
  video: Clapperboard,
  podcast: Mic2,
  slides: Presentation,
  technical_sheet: ScrollText,
  blog: FileText,
  whatsapp: MessageCircle,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (material: MaterialType) => void;
}

export function ContentCatalogModal({ open, onOpenChange, onSelect }: Props) {
  const { loading, plan } = useCredits();
  const currentPlan = plan?.plan ?? "free";

  const selectFormat = (material: MaterialType) => {
    if (loading) return;
    const definition = CONTENT_FORMATS[material];
    const allowed = canUseMaterial(currentPlan, material, plan?.allowedFormats);
    if (!allowed) {
      toast.info(
        `Disponível no plano ${PLAN_CATALOG[definition.minPlan].label}`,
        {
          description:
            "Abra as configurações da conta para comparar os planos e liberar este formato.",
        },
      );
      return;
    }
    onSelect(material);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-24px)] overflow-y-auto rounded-[24px] border-border-strong bg-surface-1 p-0 text-fg-primary shadow-[var(--shadow-elevated)] sm:max-w-[820px]">
        <DialogHeader className="border-b border-border-subtle bg-[radial-gradient(circle_at_15%_0%,rgba(124,105,255,0.15),transparent_55%)] px-6 py-6 text-left sm:px-8">
          <div className="mb-3 grid size-10 place-items-center rounded-xl border border-brand/20 bg-brand-muted text-brand">
            <Sparkles className="size-4" />
          </div>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
            Central de formatos
          </DialogTitle>
          <DialogDescription className="mt-1 max-w-2xl text-sm leading-6 text-fg-tertiary">
            Gere uma nova peça usando o briefing e a direção criativa da
            campanha atual. O plano é validado novamente no servidor.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
          {MATERIAL_TYPES.map((material) => {
            const definition = CONTENT_FORMATS[material];
            const Icon = FORMAT_ICONS[material];
            const allowed = canUseMaterial(
              currentPlan,
              material,
              plan?.allowedFormats,
            );

            return (
              <button
                key={material}
                type="button"
                disabled={loading}
                onClick={() => selectFormat(material)}
                className="group flex min-h-28 items-start gap-4 rounded-2xl border border-border-subtle bg-surface-2/65 p-4 text-left transition hover:-translate-y-px hover:border-brand/25 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border-subtle bg-surface-1 text-fg-tertiary transition group-hover:text-brand">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-fg-primary">
                      {definition.label}
                    </span>
                    {loading ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-fg-muted" />
                    ) : !allowed ? (
                      <LockKeyhole className="size-3.5 shrink-0 text-fg-muted" />
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-fg-tertiary">
                    {definition.description}
                  </span>
                  <span className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                    {definition.creditCost} créditos
                    {!allowed
                      ? ` · Plano ${PLAN_CATALOG[definition.minPlan].label}`
                      : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
