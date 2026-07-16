// components/briefflow/ChatPanel.tsx
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles } from "lucide-react";
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
}

const LOADING_MESSAGES = [
  "Acessando base de dados...",
  "Analisando parâmetros comerciais...",
  "Estruturando lógica de campanha...",
  "Formulando estratégia..."
];

const SUGGESTIONS = [
  "Olá! Vim pelo site. Quero saber como acelerar as vendas da minha empresa.",
  "Preciso lançar uma campanha de Inbound para um novo produto.",
  "Queremos estruturar a prospecção Outbound de grandes clientes."
];

// Utilitário rápido para transformar Markdown simples em HTML seguro no chat
const formatMarkdown = (text: string) => {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

export function ChatPanel({ messages, onSend, loading }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  // Calcula a etapa baseada nas interações do usuário (máx 5)
  const userTurns = messages.filter(m => m.role === 'user').length;
  const currentStep = Math.min(5, userTurns + 1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    } else {
      setLoadingTextIndex(0);
      if (messages.length > 0) inputRef.current?.focus();
    }
    return () => clearInterval(interval);
  }, [loading, messages.length]);

  const submitChat = () => {
    const t = input.trim();
    if (!t || loading) return;
    onSend(t);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-surface dark:bg-[#09090b] transition-colors">
      <header className="flex items-center justify-between border-b border-border/50 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="font-sans text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">Consultoria BrieFlow</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Geração de Demanda</p>
          </div>
        </div>
        {/* BARRA DE PROGRESSO */}
        {messages.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Etapa {currentStep}/5</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(step => (
                <div key={step} className={`h-1.5 w-4 rounded-full ${step <= currentStep ? 'bg-brand' : 'bg-slate-200 dark:bg-slate-800'}`} />
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
        
        {messages.length === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center text-center mt-10">
             <div className="size-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <Sparkles className="size-8 text-brand" />
             </div>
             <h3 className="text-2xl font-display font-bold text-foreground tracking-tight mb-2">Qualificação de Negócio</h3>
             <p className="text-sm text-muted-foreground mb-8 max-w-sm">
               Sou seu consultor virtual B2B. Selecione um cenário ou digite sua necessidade para alinharmos a estratégia.
             </p>
             <div className="flex flex-col gap-3 w-full max-w-md">
               {SUGGESTIONS.map(s => (
                 <button 
                   key={s} 
                   onClick={() => onSend(s)}
                   className="text-[13px] text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-slate-700 dark:text-slate-300 shadow-sm"
                 >
                   "{s}"
                 </button>
               ))}
             </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 dark:bg-slate-100 px-5 py-3 text-[14px] leading-relaxed text-white dark:text-slate-900 shadow-md" : "max-w-[85%] rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-4 text-[14px] leading-relaxed text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"}>
              {formatMarkdown(m.content)}
            </div>
          </div>
        ))}
        
        {/* INDICADOR DE DIGITAÇÃO (Oculta se o Streaming já começou a renderizar a bolha) */}
        {loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content === "" && (
          <div className="flex justify-start animate-in fade-in">
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-3 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
              <div className="flex gap-1.5">
                <span className="typing-dot size-1.5 rounded-full bg-slate-400" />
                <span className="typing-dot size-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0.15s" }} />
                <span className="typing-dot size-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0.3s" }} />
              </div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">{LOADING_MESSAGES[loadingTextIndex]}</span>
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitChat(); } }}
            placeholder="Responda ao Consultor..."
            rows={2}
            className="min-h-[60px] resize-none border-0 bg-transparent pr-14 focus-visible:ring-0 text-[14px] leading-relaxed p-4"
            disabled={loading}
          />
          <Button 
            size="icon" 
            onClick={submitChat} 
            disabled={loading || !input.trim()} 
            className="absolute right-3 bottom-3 size-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm hover:scale-105 transition-transform"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}