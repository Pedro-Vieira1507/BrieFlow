// components/briefflow/ChatPanel.tsx
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Send, Sparkles, Settings2, Globe } from "lucide-react";
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

const DISCOVERY_CHIPS = [
  "Lançar Produto",
  "Captar Leads",
  "Campanha de Black Friday",
  "Nutrição de Base"
];

export function ChatPanel({ messages, onSend, loading, brandContext, setBrandContext }: Props) {
  const [companyContext, setCompanyContext] = useState("");
  const [objectiveContext, setObjectiveContext] = useState("");
  
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading && messages.length > 0) inputRef.current?.focus();
  }, [loading, messages.length]);

  const submitInitialBrief = () => {
    if (!companyContext || !objectiveContext || loading) return;
    onSend(`Empresa/Produto: ${companyContext}. Objetivo: ${objectiveContext}. Por favor, analise esse cenário e me proponha um plano estratégico de campanha antes de gerar qualquer conteúdo.`);
  };

  const submitChat = () => {
    const t = input.trim();
    if (!t || loading) return;
    onSend(t);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-surface dark:bg-[#09090b] transition-colors">
      <header className="flex items-center gap-3 border-b border-border/50 px-6 py-5">
        <div className="grid size-10 place-items-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="font-sans text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">Agente BrieFlow</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Automação Estratégica de Campanhas</p>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
        
        {/* ESTADO ZERO: INGESTÃO DE INTENÇÃO (Substitui o Textarea cru inicial) */}
        {messages.length === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="mb-6 space-y-2">
                 <h3 className="text-xl font-display font-bold text-foreground tracking-tight">O que vamos lançar hoje?</h3>
                 <p className="text-sm text-muted-foreground">O agente montará a estratégia, investigará as lacunas e gerará os ativos por você.</p>
             </div>

             <div className="space-y-5 rounded-2xl border border-border/60 bg-white/50 dark:bg-slate-900/30 p-5 shadow-sm">
                 <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Globe className="size-3.5"/> Empresa ou Site</label>
                    <Input 
                      value={companyContext} 
                      onChange={(e) => setCompanyContext(e.target.value)}
                      className="h-11 bg-background focus-visible:ring-slate-400" placeholder="Ex: Forlab Express ou forlab.com.br" 
                    />
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Objetivo da Campanha</label>
                    <Input 
                      value={objectiveContext} 
                      onChange={(e) => setObjectiveContext(e.target.value)}
                      className="h-11 bg-background focus-visible:ring-slate-400" placeholder="Ex: Vender a nova esteira 360" 
                    />
                 </div>

                 <div className="pt-2">
                    <p className="text-[10px] text-slate-400 font-medium mb-2 uppercase tracking-widest">Ações Rápidas:</p>
                    <div className="flex flex-wrap gap-2">
                      {DISCOVERY_CHIPS.map(chip => (
                         <button 
                           key={chip}
                           onClick={() => setObjectiveContext(chip)}
                           className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
                         >
                           {chip}
                         </button>
                      ))}
                    </div>
                 </div>

                 <Button 
                    onClick={submitInitialBrief} 
                    disabled={!companyContext || !objectiveContext || loading}
                    className="w-full mt-2 h-11 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold tracking-wide shadow-md"
                 >
                    {loading ? "Analisando Contexto..." : "Analisar Empresa & Montar Plano"}
                 </Button>
             </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 dark:bg-slate-100 px-5 py-3 text-[14px] leading-relaxed text-white dark:text-slate-900 shadow-md" : "max-w-[85%] rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-4 text-[14px] leading-relaxed text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"}>
              {m.content}
            </div>
          </div>
        ))}
        
        {loading && messages.length > 0 && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 px-5 py-4 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
              <span className="typing-dot size-1.5 rounded-full bg-slate-400" />
              <span className="typing-dot size-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0.15s" }} />
              <span className="typing-dot size-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* ÁREA DE RESPOSTA (Apenas visível APÓS o fluxo inicial ser ativado) */}
      {messages.length > 0 && (
        <div className="border-t border-border/50 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md p-4 md:p-6 animate-in slide-in-from-bottom-4">
          <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/20 dark:focus-within:ring-white/20 transition-all">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitChat(); } }}
              placeholder="Responda ao Agente (ex: 'Público são B2B, pode gerar a campanha')."
              rows={2}
              className="min-h-[60px] resize-none border-0 bg-transparent pr-14 focus-visible:ring-0 text-[14px] leading-relaxed p-4"
              disabled={loading}
            />
            <Button 
              size="icon" 
              onClick={submitChat} 
              disabled={loading || !input.trim()} 
              className="absolute right-3 bottom-3 size-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm hover:scale-105 transition-transform disabled:opacity-50"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}