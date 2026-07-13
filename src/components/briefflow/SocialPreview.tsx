import { useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { buildPollinationsUrl } from "@/lib/pollinations";
import { RefreshCw, Loader2 } from "lucide-react";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function SocialPreview({ state, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const url = useMemo(
    () =>
      state.imagePrompt
        ? buildPollinationsUrl(state.imagePrompt, { seed: state.imageSeed })
        : null,
    [state.imagePrompt, state.imageSeed],
  );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
        <div className="relative aspect-square w-full bg-muted">
          {url ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-subtle">
                  <Loader2 className="size-8 animate-spin text-brand" />
                </div>
              )}
              <img
                key={url}
                src={url}
                alt={state.imagePrompt}
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
                className="h-full w-full object-cover"
              />
              {state.title && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
                  <Editable
                    as="h2"
                    value={state.title}
                    onChange={(v) => onChange({ title: v })}
                    className="text-2xl font-bold text-white drop-shadow"
                  />
                  {state.subtitle && (
                    <Editable
                      as="p"
                      value={state.subtitle}
                      onChange={(v) => onChange({ subtitle: v })}
                      className="mt-1 text-sm text-white/90 drop-shadow"
                    />
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem imagem
            </div>
          )}
        </div>
        <div className="space-y-3 p-5">
          <Editable
            as="p"
            multiline
            value={state.caption ?? "Escreva a legenda do post..."}
            onChange={(v) => onChange({ caption: v })}
            className="text-sm leading-relaxed text-foreground"
          />
          {state.hashtags && state.hashtags.length > 0 && (
            <Editable
              as="p"
              value={state.hashtags.join(" ")}
              onChange={(v) => onChange({ hashtags: v.split(/\s+/).filter(Boolean) })}
              className="text-sm font-medium text-brand"
            />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl border bg-surface p-3">
        <div className="min-w-0 flex-1 truncate pr-3 text-xs text-muted-foreground">
          Prompt: <span className="text-foreground">{state.imagePrompt}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setLoading(true);
            onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
          }}
        >
          <RefreshCw className="mr-2 size-4" /> Nova imagem
        </Button>
      </div>
    </div>
  );
}
