import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function GeneratingBanner({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3.5 sm:px-5",
        "border border-brand/20 bg-brand-muted shadow-[0_18px_50px_-32px_var(--brand-glow)]",
        "backdrop-blur-md fade-in-up",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand/10">
        <Loader2 className="size-4 animate-spin text-brand" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-fg-primary">
          {label}
        </p>
        <p className="mt-0.5 text-[10px] text-fg-tertiary">
          O canvas será atualizado automaticamente.
        </p>
      </div>
    </div>
  );
}
