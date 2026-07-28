import { cn } from "@/lib/utils";

interface Props {
  colors: string[];
  className?: string;
}

export function BrandPalette({ colors, className }: Props) {
  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-2.5 border-b border-border-subtle bg-surface-2 px-5",
        "text-[10px] font-semibold uppercase tracking-widest text-fg-muted",
        className,
      )}
    >
      <span>Paleta da marca</span>
      <div className="flex gap-1.5">
        {colors.map((c) => (
          <div
            key={c}
            className="size-4 rounded-full ring-1 ring-white/10 shadow-inner"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}
