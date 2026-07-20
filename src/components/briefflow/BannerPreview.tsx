// components/briefflow/BannerPreview.tsx — Corrigido (com fallback de erro)
import { useEffect, useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { RefreshCw, Loader2, ArrowRight, AlertCircle } from "lucide-react";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function BannerPreview({ state, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const prompt = state.imagePrompt || "";
  const url = useMemo(
    () =>
      prompt
        ? useFallback
          ? buildFallbackUrl(prompt, { width: 1200, height: 400, seed: state.imageSeed })
          : buildPollinationsUrl(prompt, { width: 1200, height: 400, seed: state.imageSeed })
        : null,
    [prompt, state.imageSeed, useFallback],
  );

  useEffect(() => {
    if (url) {
      setLoading(true);
      setError(false);
    }
  }, [url]);

  const handleImageError = () => {
    setLoading(false);
    if (!useFallback) {
      setUseFallback(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col space-y-4">
      <div className="relative flex aspect-[21/9] md:aspect-[3/1] min-h-[250px] w-full shrink-0 overflow-hidden rounded-2xl bg-[#0a0a0c] shadow-2xl ring-1 ring-border/50">
        {url && !error ? (
          <>
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0c]/80 backdrop-blur-md">
                <Loader2 className="size-8 animate-spin text-white/50" />
              </div>
            )}

            <img
              key={url}
              src={url}
              alt={state.imagePrompt || "Banner"}
              onLoad={() => setLoading(false)}
              onError={handleImageError}
              className="absolute inset-0 h-full w-full object-cover object-right"
            />

            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/90 via-40% to-transparent" />

            <div className="relative z-20 flex h-full w-full max-w-[60%] md:max-w-[50%] flex-col justify-center px-6 md:px-12 lg:px-16 overflow-hidden">
              <Editable
                as="h2"
                value={state.title ?? "Título"}
                onChange={(v) => onChange({ title: v })}
                className="mb-2 line-clamp-3 break-words text-balance font-display text-2xl font-black leading-[1.1] tracking-tight text-white drop-shadow-lg md:text-4xl lg:text-5xl"
              />

              {state.subtitle && (
                <Editable
                  as="p"
                  value={state.subtitle}
                  onChange={(v) => onChange({ subtitle: v })}
                  className="mb-6 line-clamp-3 max-w-sm text-balance font-sans text-xs font-medium leading-relaxed text-slate-300 drop-shadow-md md:text-sm lg:text-base"
                />
              )}

              {state.cta && (
                <div className="flex items-center">
                  <div className="group relative inline-flex w-fit cursor-pointer items-center rounded-full bg-white px-5 py-2.5 md:px-7 md:py-3.5 font-sans text-[10px] md:text-[13px] font-bold uppercase tracking-widest text-slate-900 shadow-xl transition-all hover:scale-105">
                    <Editable as="span" value={state.cta} onChange={(v) => onChange({ cta: v })} className="mr-2 line-clamp-1" />
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1 md:size-4" strokeWidth={2.5} />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : error ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400">
            <AlertCircle className="size-8" />
            <span className="text-sm">Falha ao gerar imagem.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setUseFallback(false);
                setError(false);
                setLoading(true);
                onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
              }}
            >
              <RefreshCw className="mr-2 size-3" /> Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">Gerando visual...</div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-3 opacity-60 hover:opacity-100">
        <div className="min-w-0 flex-1 truncate pr-3 text-[10px] text-muted-foreground uppercase tracking-widest">
          Art Direction: <span className="text-foreground lowercase normal-case">{state.imagePrompt}</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setLoading(true); setError(false); setUseFallback(false); onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) }); }}>
          <RefreshCw className="mr-2 size-3" /> Nova Imagem
        </Button>
      </div>
    </div>
  );
}