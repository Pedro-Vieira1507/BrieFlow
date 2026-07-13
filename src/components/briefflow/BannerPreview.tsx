import { useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { buildPollinationsUrl } from "@/lib/pollinations";
import { RefreshCw, Loader2, ArrowRight } from "lucide-react";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function BannerPreview({ state, onChange }: Props) {
  const [loading, setLoading] = useState(true);

  // Mantemos o tamanho exato de 1200x300 (Proporção 4:1)
  const url = useMemo(
    () =>
      state.imagePrompt
        ? buildPollinationsUrl(state.imagePrompt, { width: 1200, height: 300, seed: state.imageSeed })
        : null,
    [state.imagePrompt, state.imageSeed],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col space-y-4">
      {/* Banner Container - Sombras profundas e borda sutil de vidro */}
      <div className="relative flex aspect-[4/1] w-full shrink-0 overflow-hidden rounded-xl bg-slate-950 shadow-2xl ring-1 ring-white/10">
        {url ? (
          <>
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60 backdrop-blur-md">
                <Loader2 className="size-8 animate-spin text-white" />
              </div>
            )}
            
            {/* Imagem de Fundo (1200x300) gerada pelo Pollinations */}
            <img
              key={url}
              src={url}
              alt={state.imagePrompt}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            
            {/* Gradiente Agência: 100% sólido na esquerda esfumaçando suavemente até o meio */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 via-40% to-transparent" />
            
            {/* Conteúdo de Texto e CTA - Escala responsiva segura para evitar overflow */}
            <div className="relative z-20 flex h-full w-full max-w-[65%] flex-col justify-center overflow-hidden p-4 sm:p-6 md:p-10 lg:p-12">
              
              {/* Título Principal */}
              <Editable
                as="h2"
                value={state.title ?? "Título do Banner"}
                onChange={(v) => onChange({ title: v })}
                className="mb-1 line-clamp-2 break-words font-sans text-base font-extrabold leading-[1.15] tracking-tight text-white drop-shadow-lg sm:mb-2 sm:text-2xl md:text-3xl lg:text-[40px]"
              />
              
              {/* Subtítulo de Apoio */}
              {state.subtitle && (
                <Editable
                  as="p"
                  value={state.subtitle}
                  onChange={(v) => onChange({ subtitle: v })}
                  className="mb-3 line-clamp-2 break-words font-sans text-[10px] font-medium text-slate-300 drop-shadow-md sm:mb-5 sm:text-sm md:text-base lg:text-lg"
                />
              )}
              
              {/* Call To Action (Botão) */}
              {state.cta && (
                <div className="flex items-center">
                  <div className="group relative inline-flex w-fit cursor-pointer items-center rounded bg-white px-3 py-1.5 font-sans text-[9px] font-bold uppercase tracking-wide text-slate-900 shadow-xl transition-all hover:scale-105 hover:bg-slate-100 sm:px-5 sm:py-2.5 sm:text-xs md:text-sm">
                    <Editable
                      as="span"
                      value={state.cta}
                      onChange={(v) => onChange({ cta: v })}
                      className="mr-1.5 sm:mr-2"
                    />
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-1 sm:size-4" strokeWidth={3} />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Sem imagem
          </div>
        )}
      </div>

      {/* Controles de Prompt Ocultos (Para o Builder) */}
      <div className="flex items-center justify-between rounded-xl border bg-surface p-3">
        <div className="min-w-0 flex-1 truncate pr-3 text-xs text-muted-foreground">
          Prompt: <span className="text-foreground">{state.imagePrompt}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => {
            setLoading(true);
            onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
          }}
        >
          <RefreshCw className="mr-2 size-4" /> Nova Imagem
        </Button>
      </div>
    </div>
  );
}