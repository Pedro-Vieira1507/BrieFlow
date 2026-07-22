// components/briefflow/SocialPreview.tsx — Premium Agency Quality
import { useEffect, useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import {
  Loader2, Heart, MessageCircle, Send, Bookmark,
  MoreHorizontal, AlertCircle, RefreshCw, RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function SocialPreview({ state, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const prompt = state.imagePrompt || "";
  const url = useMemo(
    () =>
      prompt
        ? useFallback
          ? buildFallbackUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed })
          : buildPollinationsUrl(prompt, { width: 1080, height: 1350, seed: state.imageSeed })
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
    <div className="mx-auto max-w-[400px]">
      <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-black">

        {/* ── IG HEADER ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-gradient-to-tr from-amber-400 to-fuchsia-600 flex items-center justify-center p-[2px]">
              <div className="size-full rounded-full bg-white dark:bg-black border border-transparent" />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-slate-900 dark:text-white tracking-tight leading-none">
                {state.brandName || "Sua Marca"}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Patrocinado</span>
            </div>
          </div>
          <MoreHorizontal className="size-5 text-slate-500" />
        </div>

        {/* ── IG IMAGE com overlay de texto premium ─────────────────── */}
        <div className="relative aspect-[4/5] w-full bg-[#08080f] border-y border-slate-100 dark:border-slate-900 overflow-hidden">
          {url && !error ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#08080f]/60">
                  <Loader2 className="size-6 animate-spin text-slate-400" />
                </div>
              )}
              <img
                key={url}
                src={url}
                alt={state.imagePrompt || "Post"}
                onLoad={() => setLoading(false)}
                onError={handleImageError}
                className="h-full w-full object-cover"
              />

              {/* Gradiente bottom para legibilidade */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#08080f]/95 via-[#08080f]/40 to-transparent" />

              {/* Badge de oferta — topo esquerdo */}
              <div className="absolute top-4 left-4 z-20">
                <div
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm"
                  style={{ background: "#00a2ff" }}
                >
                  <RefreshCw className="size-2.5" />
                  Frete Grátis
                </div>
              </div>

              {/* Overlay de texto — inferior */}
              <div className="absolute bottom-0 left-0 right-0 z-20 p-5">
                <p
                  className="mb-1.5 text-[10px] font-bold uppercase tracking-[2px]"
                  style={{ color: "#00a2ff" }}
                >
                  Equipamentos Laboratoriais
                </p>

                {/* Headline editável com destaque */}
                <h2 className="text-[22px] font-black leading-[1.1] tracking-tight text-white mb-3">
                  Pesquisa séria começa<br />
                  com o{" "}
                  <span style={{ color: "#00d4ff" }}>equipamento certo.</span>
                </h2>

                {/* Divisor */}
                <div
                  className="mb-3 h-px w-full"
                  style={{ background: "linear-gradient(to right, rgba(0,162,255,0.6), transparent)" }}
                />

                {/* Descrição compacta */}
                <p className="text-[12px] leading-relaxed text-white/60 mb-4">
                  Entrega nacional · Universidades · Fundações<br />
                  Acima de R$1.500 com frete grátis.
                </p>

                {/* CTA visual */}
                <div
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[12px] font-semibold text-white backdrop-blur-sm"
                  style={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.18)" }}
                >
                  Ver catálogo completo
                  <span style={{ color: "#00a2ff" }}>→</span>
                </div>
              </div>
            </>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
              <AlertCircle className="size-6" />
              <span className="text-xs">Falha ao gerar imagem.</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setUseFallback(false);
                  setError(false);
                  setLoading(true);
                  onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
                }}
              >
                <RefreshCw className="mr-1 size-3" /> Retry
              </Button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Gerando visual...
            </div>
          )}
        </div>

        {/* ── IG ACTIONS ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Heart className="size-6 text-slate-900 dark:text-white" />
            <MessageCircle className="size-6 text-slate-900 dark:text-white" />
            <Send className="size-6 text-slate-900 dark:text-white" />
          </div>
          <Bookmark className="size-6 text-slate-900 dark:text-white" />
        </div>

        {/* ── IG CAPTION ─────────────────────────────────────────────── */}
        <div className="px-4 pb-5">
          <p className="text-[13px] font-semibold mb-1.5 text-slate-900 dark:text-white">1,245 curtidas</p>

          <div className="text-[13px] text-slate-900 dark:text-slate-100">
            <span className="font-semibold mr-2">{state.brandName || "Sua Marca"}</span>
            <Editable
              as="span"
              multiline
              value={state.caption ?? "Legenda aqui..."}
              onChange={(v) => onChange({ caption: v })}
              className="leading-[1.8] whitespace-pre-wrap break-words"
            />
          </div>

          {state.hashtags && state.hashtags.length > 0 && (
            <Editable
              as="p"
              value={state.hashtags.join(" ")}
              onChange={(v) => onChange({ hashtags: v.split(/\s+/).filter(Boolean) })}
              className="text-[13px] text-blue-600 dark:text-blue-400 mt-2 break-words leading-relaxed"
            />
          )}

          {/* Art Direction compacto */}
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Art Direction
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">
              {state.imagePrompt}
            </p>
            <button
              className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => {
                onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
              }}
            >
              <RefreshCcw className="size-2.5" /> Nova imagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}