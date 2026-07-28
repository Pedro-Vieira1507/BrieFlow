import { useEffect, useRef, useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { ChatEmptyState } from "./ChatEmptyState";
import type { ChatMessage as Msg } from "./types";

const LOADING_TEXTS = [
  "Lendo o briefing…",
  "Analisando a marca…",
  "Estruturando a estratégia…",
  "Pensando no design perfeito…",
];

interface Props {
  messages: Msg[];
  loading: boolean;
  scraping: boolean;
  onPickSuggestion: (s: string) => void;
}

export function ChatMessages({ messages, loading, scraping, onPickSuggestion }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [textIdx, setTextIdx] = useState(0);
  const busy = loading || scraping;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, scraping]);

  useEffect(() => {
    if (!busy) {
      setTextIdx(0);
      return;
    }
    const id = setInterval(
      () => setTextIdx((i) => (i + 1) % LOADING_TEXTS.length),
      2400,
    );
    return () => clearInterval(id);
  }, [busy]);

  const lastAssistantEmpty =
    loading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  return (
    <div className="flex-1 space-y-5 overflow-y-auto scroll-smooth px-5 py-6">
      {messages.length === 0 && <ChatEmptyState onPick={onPickSuggestion} />}

      {messages.map((m) => (
        <ChatMessage key={m.id} message={m} />
      ))}

      {scraping && <StatusPill icon={<Globe className="size-4 animate-spin text-brand" />} label="Acessando site…" />}
      {lastAssistantEmpty && (
        <StatusPill
          icon={<Loader2 className="size-4 animate-spin text-fg-muted" />}
          label={LOADING_TEXTS[textIdx]}
        />
      )}

      <div ref={bottomRef} className="h-2" />
    </div>
  );
}

function StatusPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex justify-start fade-in-up">
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-full px-4 py-2",
          "glass",
        )}
      >
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-widest text-fg-tertiary">
          {label}
        </span>
      </div>
    </div>
  );
}
