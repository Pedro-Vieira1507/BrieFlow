import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/lib/store";
import { STATUS_LABEL } from "@/lib/store";

const styles: Record<CampaignStatus, string> = {
  recebido: "bg-muted text-muted-foreground border-border",
  transcrito: "bg-info/10 text-info border-info/20",
  brief_gerado: "bg-warning/15 text-warning-foreground border-warning/30",
  materiais_gerados: "bg-success/10 text-success border-success/20",
  erro: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-muted-foreground": status === "recebido",
        "bg-info": status === "transcrito",
        "bg-warning": status === "brief_gerado",
        "bg-success": status === "materiais_gerados",
        "bg-destructive": status === "erro",
      })} />
      {STATUS_LABEL[status]}
    </span>
  );
}
