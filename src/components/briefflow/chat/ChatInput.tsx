// src/components/briefflow/chat/ChatInput.tsx
import { useState, useRef, useEffect } from "react";
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
    <div className="p-4 bg-surface-1 border-t border-border-subtle shrink-0">
      <form 
        onSubmit={handleSubmit}
        // UX: Anel de foco interativo (focus-within) para o contêiner inteiro
        className={cn(
          "relative flex items-end gap-2 bg-surface-2 rounded-[20px] p-2 pr-2.5 transition-all duration-300 border",
          text.length > 0 ? "border-brand/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]" : "border-border-subtle shadow-sm",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
        )}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Digite o site ou o que deseja criar..."
          className="w-full max-h-[150px] min-h-[44px] resize-none bg-transparent px-3 py-3 text-sm text-fg-primary placeholder:text-fg-muted focus:outline-none disabled:opacity-50"
          rows={1}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 mb-0.5",
            text.trim() && !disabled
              ? "bg-brand text-white shadow-md active:scale-90 hover:brightness-110"
              : "bg-surface-3 text-fg-muted cursor-not-allowed"
          )}
        >
          {disabled ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4 ml-0.5" />
          )}
        </button>
      </form>
      <div className="text-center mt-3">
        <span className="text-[10px] text-fg-tertiary font-medium tracking-wide">
          BrieFlow pode cometer erros. Revise antes de exportar.
        </span>
      </div>
    </div>
  );
}