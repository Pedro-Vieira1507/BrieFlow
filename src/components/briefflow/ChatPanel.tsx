// components/briefflow/ChatPanel.tsx — Corrigido (sem XSS)
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Send, Sparkles } from "lucide-react";
import type { BrandContext } from "@/types/builder";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  brandContext: BrandContext;
  setBrandContext: (ctx: BrandContext) => void;
  scraping?: boolean;
}

const LOADING_MESSAGES = [
  "Lendo o briefing...",
  "Analisando a marca...",
  "Estruturando a conversa...",
  "Preparando a próxima pergunta...",
];

const SUGGESTIONS = [
  "Quero um banner e um post para o lançamento do meu produto: https://exemplo.com",
  "Preciso de um e-mail marketing de reativação de clientes inativos.",
  "Monte uma campanha completa (banner + e-mail + post) a partir do meu site: https://exemplo.com",
  "Crie um banner de Black Friday com 40% de desconto para minha loja.",
];

// Parser de markdown SEGURO (sem dangerouslySetInnerHTML)
function renderMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/\*(.+?)\*/);
    const newlineIdx = remaining.indexOf("\n");

    let nextMatch: { idx: number; len: number; type: "bold" | "italic" | "newline"; text: string } | null = null;

    if (boldMatch && boldMatch.index !== undefined) {
      nextMatch = { idx: boldMatch.index, len: boldMatch[0].length, type: "bold", text: boldMatch[1] };
    }
    if (italicMatch && italicMatch.index !== undefined) {
      if (!nextMatch || italicMatch.index < nextMatch.idx) {
        nextMatch = { idx: italicMatch.index, len: italicMatch[0].length, type: "italic", text: italicMatch[1] };
      }
    }
    if (newlineIdx !== -1) {
      if (!nextMatch || newlineIdx < nextMatch.idx) {
        nextMatch = { idx: newlineIdx, len: 1, type: "newline", text: "" };
      }
    }

    if (!nextMatch) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (nextMatch.idx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, nextMatch.idx)}</span>);
    }

    if (nextMatch.type === "bold") {
      parts.push(<strong key={key++}>{nextMatch.text}</strong>);
    } else if (nextMatch.type === "italic") {
      parts.push(<em key={key++}>{nextMatch.text}</em>);
    } else if (nextMatch.type === "newline") {
      parts.push(<br key={key++} />);
    }

    remaining = remaining.slice(nextMatch.idx + nextMatch.len);
  }

  return <span>{parts}</span>;
}

export function ChatPanel({
  messages,
  onSend,
  loading,
  brandContext,
  scraping,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const currentStep = Math.min(5, userTurns + 1);
  const isBusy = loading || !!scraping;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, scraping]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isBusy) {
      interval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    } else {
      setLoadingTextIndex(0);
      if (messages.length > 0) inputRef.current?.focus();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBusy, messages.length]);

  const submitChat = () => {
    const t = input.trim();
    if (!t || isBusy) return;
    onSend(t);
    setInput("");
  };

  const isLastAssistantLoading =
    loading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  return (
    <div className="flex h-full flex-col bg-surface dark:bg-[#09090b] transition-colors">
      <header className="flex items-center justify-between border-b border-border/50 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="font-sans text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
              BrieFlow Creative
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Agente de peças de marketing premium
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Briefing {currentStep}/5
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 w-4 rounded-full ${
                    step <= currentStep
                      ? "bg-slate-900 dark:bg-white"
                      : "bg-slate-200 dark:bg-slate-800"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      {brandContext.site && (
        <div className="flex items-center gap-2 border-b border-border/40 bg-emerald-50/80 dark:bg-emerald-950/30 px-4 py-2 text-[11px] text-emerald-800 dark:text-emerald-300">
          <Globe className="size-3.5 shrink-0" />
          <span className="truncate">
            Site analisado:{" "}
            <strong>{brandContext.site.brandName || brandContext.site.title}</strong>
            {" · "}
            <span className="opacity-80">{brandContext.site.url}</span>
          </span>
        </div>
      )}

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
        {messages.length === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center text-center mt-10">
            <div className="size-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Sparkles className="size-8 text-slate-700 dark:text-slate-200" />
            </div>
            <h3 className="text-2xl font-display font-bold text-foreground tracking-tight mb-2">
              Criação de Peças Premium
            </h3>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm">
              Sou seu diretor de criação. Conte o objetivo, cole o site da marca e eu
              monto banners, posts e e-mails com qualidade de agência no painel ao lado.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  className="text-[13px] text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-slate-700 dark:text-slate-300 shadow-sm"
                >
                  &ldquo;{s}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 dark:bg-slate-100 px-5 py-3 text-[14px] leading-relaxed text-white dark:text-slate-900 shadow-md"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-4 text-[14px] leading-relaxed text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
              }
            >
              {renderMarkdown(m.content)}
            </div>
          </div>
        ))}

        {scraping && (
          <div className="flex justify-start animate-in fade-in">
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-3 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
              <Globe className="size-4 animate-pulse text-emerald-500" />
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">
                Acessando e analisando o site...
              </span>
            </div>
          </div>
        )}

        {isLastAssistantLoading && (
          <div className="flex justify-start animate-in fade-in">
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-3 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
              <div className="flex gap-1.5">
                <span className="typing-dot size-1.5 rounded-full bg-slate-400" />
                <span
                  className="typing-dot size-1.5 rounded-full bg-slate-400"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="typing-dot size-1.5 rounded-full bg-slate-400"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">
                {LOADING_MESSAGES[loadingTextIndex]}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      <div className="border-t border-border/50 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md p-4 md:p-6">
        <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:focus-within:ring-white/20 transition-all">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitChat();
              }
            }}
            placeholder="Descreva a peça, cole o site da marca ou responda ao briefing..."
            rows={2}
            className="min-h-[60px] resize-none border-0 bg-transparent pr-14 focus-visible:ring-0 text-[14px] leading-relaxed p-4"
            disabled={isBusy}
          />
          <Button
            size="icon"
            onClick={submitChat}
            disabled={isBusy || !input.trim()}
            className="absolute right-3 bottom-3 size-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm hover:scale-105 transition-transform"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Dica: cole uma URL e o agente acessa o site para extrair a identidade da marca.
        </p>
      </div>
    </div>
  );
}