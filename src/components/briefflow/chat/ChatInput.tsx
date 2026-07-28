import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
    // Foca de volta para manter fluxo de conversação
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="border-t border-border-subtle p-4">
      <div
        className={cn(
          "relative rounded-2xl border border-border-strong bg-surface-2",
          "transition-all focus-within:border-brand/50 focus-within:ring-1 focus-within:ring-brand/40",
          "shadow-[var(--shadow-soft)]",
        )}
      >
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Descreva a peça ou cole a URL do produto…"
          rows={2}
          disabled={disabled}
          className={cn(
            "min-h-[60px] resize-none border-0 bg-transparent p-4 pr-14",
            "text-[14px] leading-relaxed text-fg-primary placeholder:text-fg-muted",
            "focus-visible:ring-0",
          )}
        />
        <Button
          size="icon"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Enviar mensagem"
          className={cn(
            "absolute bottom-2 right-2 size-9 rounded-xl",
            "bg-brand text-brand-fg hover:brightness-110 transition-all",
            "shadow-[var(--shadow-brand)] disabled:shadow-none disabled:opacity-40",
          )}
        >
          <Send className="size-4" />
        </Button>
      </div>
      <p className="mt-2 px-1 text-[10px] uppercase tracking-widest text-fg-muted">
        Enter para enviar · Shift + Enter para nova linha
      </p>
    </div>
  );
}
