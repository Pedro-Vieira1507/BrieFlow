// src/components/briefflow/builder/BuilderEmptyState.tsx
import { Sparkles, MessageSquare, Wand2, Download } from "lucide-react";

export function BuilderEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] h-full text-center px-4 animate-in fade-in zoom-in-95 duration-700">
      
      {/* Ícone de Destaque com Glow */}
      <div className="relative flex size-24 items-center justify-center rounded-3xl bg-surface-2 border border-border-subtle shadow-[0_0_60px_rgba(99,102,241,0.15)] mb-8">
        <div className="absolute inset-0 bg-brand/10 rounded-3xl animate-pulse" />
        <Sparkles className="size-10 text-brand relative z-10" />
      </div>

      <h2 className="font-display text-3xl md:text-4xl font-extrabold text-fg-primary tracking-tight mb-4 drop-shadow-md">
        Seu ecossistema de campanhas
      </h2>
      <p className="text-fg-secondary text-base md:text-lg max-w-lg mb-12 leading-relaxed">
        O BrieFlow analisa sua marca e cria Banners, E-mails e Posts de alta conversão em minutos.
      </p>

      {/* Cards de Instrução (Passo a Passo) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        <div className="flex flex-col items-center p-6 rounded-2xl bg-surface-1/50 border border-border-subtle backdrop-blur-sm">
          <div className="size-10 rounded-full bg-surface-2 flex items-center justify-center mb-4 text-fg-primary">
            <MessageSquare className="size-4" />
          </div>
          <h3 className="font-semibold text-fg-primary mb-2 text-sm">1. Converse</h3>
          <p className="text-xs text-fg-tertiary">Envie o link do seu site ou o SKU do produto no chat lateral.</p>
        </div>

        <div className="flex flex-col items-center p-6 rounded-2xl bg-surface-1/50 border border-border-subtle backdrop-blur-sm">
          <div className="size-10 rounded-full bg-brand/10 flex items-center justify-center mb-4 text-brand">
            <Wand2 className="size-4" />
          </div>
          <h3 className="font-semibold text-fg-primary mb-2 text-sm">2. Aprove</h3>
          <p className="text-xs text-fg-tertiary">Confirme o briefing gerado pela IA e deixe-a montar os layouts.</p>
        </div>

        <div className="flex flex-col items-center p-6 rounded-2xl bg-surface-1/50 border border-border-subtle backdrop-blur-sm">
          <div className="size-10 rounded-full bg-surface-2 flex items-center justify-center mb-4 text-fg-primary">
            <Download className="size-4" />
          </div>
          <h3 className="font-semibold text-fg-primary mb-2 text-sm">3. Exporte</h3>
          <p className="text-xs text-fg-tertiary">Ajuste os textos se precisar e baixe as artes renderizadas.</p>
        </div>
      </div>
    </div>
  );
}