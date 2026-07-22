import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
// CORREÇÃO: Loader2 adicionado na importação abaixo
import { Globe, Send, Sparkles, Wand2, Loader2 } from "lucide-react";
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
  "Estruturando a estratégia...",
  "Pensando no design perfeito...",
];

const SUGGESTIONS = [
  "Quero um banner e post de carrinho abandonado: https://exemplo.com",
  "Preciso de um e-mail marketing de reativação com cupom VOLTA10",
];

const STEPS_LABELS = ["Marca", "Objetivo", "Público", "Produtos", "Aprovação"];

function renderMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const imageMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/\*(.+?)\*/);
    const newlineIdx = remaining.indexOf("\n");

    let nextMatch: { idx: number; len: number; type: "image" | "bold" | "italic" | "newline"; text: string; url?: string } | null = null;

    if (imageMatch && imageMatch.index !== undefined) {
      nextMatch = { idx: imageMatch.index, len: imageMatch[0].length, type: "image", text: imageMatch[1], url: imageMatch[2] };
    }
    if (boldMatch && boldMatch.index !== undefined) {
      if (!nextMatch || boldMatch.index < nextMatch.idx) {
        nextMatch = { idx: boldMatch.index, len: boldMatch[0].length, type: "bold", text: boldMatch[1] };
      }
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

    if (nextMatch.type === "image") {
      parts.push(<img key={key++} src={nextMatch.url} alt={nextMatch.text} className="my-3 max-h-48 rounded-xl object-contain border border-white/10 bg-white/5 shadow-xl" />);
    } else if (nextMatch.type === "bold") {
      parts.push(<strong key={key++} className="font-semibold text-white">{nextMatch.text}</strong>);
    } else if (nextMatch.type === "italic") {
      parts.push(<em key={key++} className="text-white/80">{nextMatch.text}</em>);
    } else if (nextMatch.type === "newline") {
      parts.push(<br key={key++} />);
    }
    remaining = remaining.slice(nextMatch.idx + nextMatch.len);
  }
  return <span>{parts}</span>;
}

export function ChatPanel({ messages, onSend, loading, brandContext, scraping }: Props) {
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
    if (isBusy) interval = setInterval(() => setLoadingTextIndex((prev) => (prev + 1) % LOADING_MESSAGES.length), 2500);
    else setLoadingTextIndex(0);
    return () => { if (interval) clearInterval(interval); };
  }, [isBusy]);

  const submitChat = () => {
    const t = input.trim();
    if (!t || isBusy) return;
    onSend(t);
    setInput("");
  };

  const isLastAssistantLoading = loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content === "";

  return (
    <div className="flex h-full flex-col bg-[#0E0E12] text-white/90">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20 text-white">
            <Wand2 className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight text-white">BrieFlow AI</h1>
            <p className="text-xs font-medium text-white/50">Diretor de Arte Autônomo</p>
          </div>
        </div>
        {messages.length > 0 && (
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
              Passo {currentStep}: {STEPS_LABELS[currentStep - 1]}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((step) => (
                <div key={step} className={`h-1.5 w-4 rounded-full transition-colors ${step <= currentStep ? "bg-blue-500" : "bg-white/10"}`} />
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center text-center mt-12">
            <div className="size-24 bg-white/5 rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10">
              <Sparkles className="size-10 text-blue-400" />
            </div>
            <h3 className="text-2xl font-display font-bold text-white tracking-tight mb-3">Criação de Campanha</h3>
            <p className="text-sm text-white/50 mb-8 max-w-[280px] leading-relaxed">
              Sou sua IA de Direção de Arte. Diga o objetivo, cole o site da sua marca e eu crio as artes.
            </p>
            <div className="flex flex-col gap-3 w-full">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => onSend(s)} className="text-[13px] text-left px-5 py-3.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-white/70 shadow-sm">
                  "{s}"
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600 px-5 py-3.5 text-[14px] leading-relaxed text-white shadow-md"
                  : "max-w-[90%] rounded-2xl rounded-tl-sm bg-[#18181B] px-5 py-4 text-[14px] leading-relaxed text-white/80 border border-white/5 shadow-sm"
              }
            >
              {renderMarkdown(m.content)}
            </div>
          </div>
        ))}

        {scraping && (
          <div className="flex justify-start animate-in fade-in">
            <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm bg-[#18181B] px-5 py-3 border border-white/5">
              <Globe className="size-4 animate-spin text-blue-500" />
              <span className="text-[11px] font-medium text-white/50 uppercase tracking-widest">Acessando site...</span>
            </div>
          </div>
        )}

        {isLastAssistantLoading && (
          <div className="flex justify-start animate-in fade-in">
            <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm bg-[#18181B] px-5 py-3.5 border border-white/5">
              <Loader2 className="size-4 animate-spin text-white/40" />
              <span className="text-[11px] font-medium text-white/50 uppercase tracking-widest">{LOADING_MESSAGES[loadingTextIndex]}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      <div className="p-5 border-t border-white/5 bg-[#0E0E12]">
        <div className="relative rounded-2xl border border-white/10 bg-[#18181B] shadow-inner focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitChat(); } }}
            placeholder="Descreva a peça ou cole a URL do produto..."
            rows={2}
            className="min-h-[60px] resize-none border-0 bg-transparent pr-14 focus-visible:ring-0 text-[14px] leading-relaxed p-4 text-white placeholder:text-white/30"
            disabled={isBusy}
          />
          <Button size="icon" onClick={submitChat} disabled={isBusy || !input.trim()} className="absolute right-2 bottom-2 size-9 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-transform">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}