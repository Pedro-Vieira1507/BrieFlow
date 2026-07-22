// components/briefflow/BannerPreview.tsx — Premium Agency Quality
import { useEffect, useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { RefreshCw, Loader2, ArrowRight, AlertCircle, Shield, Truck } from "lucide-react";

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
      {/* ── BANNER PRINCIPAL ─────────────────────────────────────────── */}
      <div className="relative flex aspect-[21/9] md:aspect-[3/1] min-h-[260px] w-full shrink-0 overflow-hidden rounded-2xl bg-[#08080f] shadow-2xl ring-1 ring-white/5">

        {url && !error ? (
          <>
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#08080f]/80 backdrop-blur-md">
                <Loader2 className="size-8 animate-spin text-white/40" />
              </div>
            )}

            {/* Imagem — lado direito */}
            <img
              key={url}
              src={url}
              alt={state.imagePrompt || "Banner"}
              onLoad={() => setLoading(false)}
              onError={handleImageError}
              className="absolute inset-0 h-full w-full object-cover object-right"
            />

            {/* Gradiente cinemático — blend da imagem para o texto */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#08080f] via-[#08080f]/92 via-35% to-[#08080f]/10" />

            {/* Linha de acento azul no rodapé */}
            <div
              className="absolute bottom-0 left-0 h-[2px] w-full"
              style={{ background: "linear-gradient(90deg, #00a2ff 0%, transparent 60%)" }}
            />

            {/* ── CONTEÚDO ─────────────────────────────────────────── */}
            <div className="relative z-20 flex h-full w-full max-w-[58%] md:max-w-[52%] flex-col justify-center px-6 md:px-12 lg:px-16 overflow-hidden">

              {/* Badge de oferta */}
              <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-[#00a2ff]/30 bg-[#00a2ff]/10 px-3 py-1.5">
                <Truck className="size-3 text-[#00a2ff]" />
                <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#00a2ff]">
                  {state.subtitle ? "Frete Grátis acima de R$1.500" : "Oferta Premium"}
                </span>
              </div>

              {/* Headline principal */}
              <Editable
                as="h2"
                value={state.title ?? "Título"}
                onChange={(v) => onChange({ title: v })}
                className="mb-3 line-clamp-3 break-words text-balance font-display text-2xl font-black leading-[1.05] tracking-tight text-white drop-shadow-lg md:text-4xl lg:text-[3.2rem]"
              />

              {/* Subtítulo */}
              {state.subtitle && (
                <Editable
                  as="p"
                  value={state.subtitle}
                  onChange={(v) => onChange({ subtitle: v })}
                  className="mb-6 line-clamp-2 max-w-sm text-balance font-sans text-xs font-medium leading-relaxed text-slate-300/80 drop-shadow-md md:text-sm lg:text-[15px]"
                />
              )}

              {/* CTA */}
              {state.cta && (
                <div className="flex items-center gap-4">
                  <div
                    className="group relative inline-flex w-fit cursor-pointer items-center rounded-lg px-5 py-2.5 md:px-7 md:py-3.5 font-sans text-[11px] md:text-[13px] font-bold uppercase tracking-widest text-white shadow-xl transition-all hover:scale-105 hover:shadow-[0_6px_28px_rgba(0,162,255,0.45)]"
                    style={{ background: "linear-gradient(135deg, #00a2ff, #0077cc)" }}
                  >
                    <Editable
                      as="span"
                      value={state.cta}
                      onChange={(v) => onChange({ cta: v })}
                      className="mr-2 line-clamp-1"
                    />
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1 md:size-4" strokeWidth={2.5} />
                  </div>

                  {/* Micro-prova social */}
                  <div className="flex items-center gap-1.5 text-white/40">
                    <Shield className="size-3" />
                    <span className="text-[10px] font-medium">Loja Segura</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── STATS DE CREDIBILIDADE — canto inferior esquerdo ─── */}
            <div className="absolute bottom-5 left-6 z-20 hidden md:flex gap-6 lg:left-16">
              <div className="flex flex-col">
                <span className="text-lg font-black text-white leading-none">+5.000</span>
                <span className="text-[9px] uppercase tracking-widest text-white/35 mt-0.5">Produtos</span>
              </div>
              <div className="w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-lg font-black text-white leading-none">B2B & B2C</span>
                <span className="text-[9px] uppercase tracking-widest text-white/35 mt-0.5">Atendimento</span>
              </div>
              <div className="w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-lg font-black text-white leading-none">Nacional</span>
                <span className="text-[9px] uppercase tracking-widest text-white/35 mt-0.5">Entrega</span>
              </div>
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
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
            Gerando visual...
          </div>
        )}
      </div>

      {/* ── ART DIRECTION BAR ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-3 opacity-60 hover:opacity-100 transition-opacity">
        <div className="min-w-0 flex-1 truncate pr-3 text-[10px] text-muted-foreground uppercase tracking-widest">
          Art Direction:{" "}
          <span className="text-foreground lowercase normal-case">{state.imagePrompt}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs shrink-0"
          onClick={() => {
            setLoading(true);
            setError(false);
            setUseFallback(false);
            onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
          }}
        >
          <RefreshCw className="mr-2 size-3" /> Nova Imagem
        </Button>
      </div>
    </div>
  );
}