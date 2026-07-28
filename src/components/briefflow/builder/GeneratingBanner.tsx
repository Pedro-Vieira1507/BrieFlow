import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function GeneratingBanner({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 rounded-2xl px-6 py-4",
        "border border-brand/25 bg-brand-muted",
        "backdrop-blur-md fade-in-up",
      )}
    >
      <Loader2 className="size-5 animate-spin text-brand" />
      <p className="text-sm font-semibold tracking-wide text-fg-primary">
        {label}
      </p>
    </div>
  );
}
