// src/components/briefflow/chat/ChatInput.tsx
import { useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  return (
    <div className="shrink-0 border-t border-border-subtle bg-surface-1/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-4">
      <form
        onSubmit={handleSubmit}
        // UX: Anel de foco interativo (focus-within) para o contêiner inteiro
        className={cn(
          "relative flex items-end gap-2 rounded-[20px] border bg-surface-2/90 p-1.5 pr-2 transition-all duration-200",
          text.length > 0
            ? "border-brand/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
            : "border-border-subtle shadow-sm",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20",
        )}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Digite o site ou o que deseja criar..."
          aria-label="Mensagem para o BrieFlow"
          className="max-h-[150px] min-h-[44px] w-full resize-none bg-transparent px-3 py-3 text-sm leading-5 text-fg-primary placeholder:text-fg-muted focus:outline-none disabled:opacity-50"
          rows={1}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label={disabled ? "Aguarde a resposta" : "Enviar mensagem"}
          title={disabled ? "Aguarde a resposta" : "Enviar mensagem"}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 mb-0.5",
            text.trim() && !disabled
              ? "bg-brand text-white shadow-md active:scale-90 hover:brightness-110"
              : "bg-surface-3 text-fg-muted cursor-not-allowed",
          )}
        >
          {disabled ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4 ml-0.5" />
          )}
        </button>
      </form>
      <div className="mt-2.5 text-center">
        <span className="text-[9px] font-medium tracking-wide text-fg-muted sm:text-[10px]">
          Revise textos, preços e condições antes de exportar.
        </span>
      </div>
    </div>
  );
}
