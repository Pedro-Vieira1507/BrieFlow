import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = { key: string; label: string };

export function Stepper({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  return (
    <ol className="flex items-center w-full gap-2 md:gap-3">
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={s.key} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  "h-7 w-7 rounded-full grid place-items-center text-xs font-semibold border shrink-0",
                  done && "bg-success text-success-foreground border-success",
                  current && "bg-primary text-primary-foreground border-primary",
                  !done && !current && "bg-muted text-muted-foreground border-border",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-sm truncate",
                  current ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-px mx-3", done ? "bg-success" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
