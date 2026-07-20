// components/briefflow/SocialPreview.tsx — Corrigido (com fallback de erro)
import { useEffect, useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Loader2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, AlertCircle, RefreshCw } from "lucide-react";
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
  // Proporção Instagram (4:5)
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

        {/* IG HEADER */}
        <div className="flex items-center justify-between px-4 py-3">
           <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-gradient-to-tr from-amber-400 to-fuchsia-600 flex items-center justify-center p-[2px]">
                 <div className="size-full rounded-full bg-white dark:bg-black border border-transparent" />
              </div>
              <span className="text-[13px] font-semibold text-slate-900 dark:text-white tracking-tight">
                {state.brandName || "Sua Marca"}
              </span>
           </div>
           <MoreHorizontal className="size-5 text-slate-500" />
        </div>

        {/* IG IMAGE com fallback */}
        <div className="relative aspect-[4/5] w-full bg-slate-100 dark:bg-slate-900 border-y border-slate-100 dark:border-slate-900">
          {url && !error ? (
            <>
              {loading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="size-6 animate-spin text-slate-400" /></div>}
              <img
                key={url}
                src={url}
                alt={state.imagePrompt || "Post"}
                onLoad={() => setLoading(false)}
                onError={handleImageError}
                className="h-full w-full object-cover"
              />
            </>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
              <AlertCircle className="size-6" />
              <span className="text-xs">Falha ao gerar imagem.</span>
              <Button size="sm" variant="ghost" onClick={() => { setUseFallback(false); setError(false); setLoading(true); onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) }); }}>
                <RefreshCw className="mr-1 size-3" /> Retry
              </Button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Gerando visual...</div>
          )}
        </div>

        {/* IG ACTIONS */}
        <div className="flex items-center justify-between px-4 py-3">
           <div className="flex items-center gap-4">
              <Heart className="size-6 text-slate-900 dark:text-white" />
              <MessageCircle className="size-6 text-slate-900 dark:text-white" />
              <Send className="size-6 text-slate-900 dark:text-white" />
           </div>
           <Bookmark className="size-6 text-slate-900 dark:text-white" />
        </div>

        {/* IG CAPTION */}
        <div className="px-4 pb-5">
          <p className="text-[13px] font-semibold mb-1 text-slate-900 dark:text-white">1,245 curtidas</p>
          <div className="text-[13px] text-slate-900 dark:text-slate-100">
             <span className="font-semibold mr-2">{state.brandName || "Sua Marca"}</span>
             <Editable
               as="span"
               multiline
               value={state.caption ?? "Escreva a legenda incrível aqui..."}
               onChange={(v) => onChange({ caption: v })}
               className="leading-relaxed whitespace-pre-wrap break-words"
             />
          </div>

          {state.hashtags && state.hashtags.length > 0 && (
            <Editable
              as="p"
              value={state.hashtags.join(" ")}
              onChange={(v) => onChange({ hashtags: v.split(/\s+/).filter(Boolean) })}
              className="text-[13px] text-blue-900 dark:text-blue-400 mt-2 break-words"
            />
          )}
        </div>
      </div>
    </div>
  );
}