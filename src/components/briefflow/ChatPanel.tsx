import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
}

export function ChatPanel({ messages, onSend, loading }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const submit = () => {
    const t = input.trim();
    if (!t || loading) return;
    onSend(t);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-3 border-b px-6 py-4">
        <div className="grid size-9 place-items-center rounded-lg bg-gradient-brand text-brand-foreground shadow-elegant">
          <Sparkles className="size-4" />
        </div>
        <div>
          <h1 className="font-display text-base font-bold">BrieFlow</h1>
          <p className="text-xs text-muted-foreground">Assistente de marketing digital</p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="rounded-xl border bg-gradient-subtle p-5 text-sm text-muted-foreground">
            👋 Olá! Descreva a campanha que você quer criar. Posso gerar e-mails,
            posts para redes sociais e banners.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-brand px-4 py-2.5 text-sm text-brand-foreground shadow-soft"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
              <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
              <span
                className="typing-dot size-1.5 rounded-full bg-muted-foreground"
                style={{ animationDelay: "0.15s" }}
              />
              <span
                className="typing-dot size-1.5 rounded-full bg-muted-foreground"
                style={{ animationDelay: "0.3s" }}
              />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-surface-elevated p-4">
        <div className="relative rounded-xl border bg-background shadow-soft focus-within:ring-2 focus-within:ring-brand/40">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Descreva a campanha que quer criar..."
            rows={2}
            className="min-h-[60px] resize-none border-0 bg-transparent pr-14 focus-visible:ring-0"
            disabled={loading}
          />
          <Button
            size="icon"
            onClick={submit}
            disabled={loading || !input.trim()}
            className="absolute right-2 bottom-2 size-9 bg-gradient-brand text-brand-foreground shadow-elegant hover:opacity-90"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
