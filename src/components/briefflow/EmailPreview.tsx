// components/briefflow/EmailPreview.tsx
import { useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { buildPollinationsUrl } from "@/lib/pollinations";
import { Loader2 } from "lucide-react";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function EmailPreview({ state, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const paragraphs = (state.body ?? "").split(/\n\n+/);

  const heroUrl = useMemo(
    () => state.emailHeroImagePrompt ? buildPollinationsUrl(state.emailHeroImagePrompt, { width: 800, height: 400, seed: state.imageSeed }) : null,
    [state.emailHeroImagePrompt, state.imageSeed],
  );

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0c0c0e]">
      
      {/* SIMULAÇÃO DE NAVEGADOR / CAIXA DE ENTRADA (Estilo macOS) */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex gap-1.5">
           <div className="size-3 rounded-full bg-red-400" />
           <div className="size-3 rounded-full bg-amber-400" />
           <div className="size-3 rounded-full bg-emerald-400" />
        </div>
        <p className="ml-2 text-[12px] text-slate-500 font-medium truncate flex-1 text-center">
           Assunto: <span className="text-slate-800 dark:text-slate-300 font-semibold">{state.title}</span> <span className="opacity-50 ml-2">- {state.preheader}</span>
        </p>
      </div>

      <div className="p-1 md:p-6 bg-slate-50 dark:bg-[#040405]">
        <div className="bg-white dark:bg-black rounded-lg shadow-sm border border-slate-100 dark:border-slate-800/50 overflow-hidden">
            {/* HEADER DO E-MAIL */}
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-2xl font-display font-black tracking-tighter text-slate-900 dark:text-white uppercase">Sua Marca.</div>
            </div>

            {/* HERO IMAGE */}
            {heroUrl && (
              <div className="relative aspect-[2/1] w-full bg-slate-100 dark:bg-slate-900">
                {loading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="size-6 animate-spin text-slate-300" /></div>}
                <img src={heroUrl} alt="Hero" onLoad={() => setLoading(false)} className="h-full w-full object-cover" />
              </div>
            )}

            {/* BODY DO E-MAIL */}
            <div className="space-y-6 px-8 py-10 md:px-12">
              <Editable
                as="h1"
                value={state.title ?? "Título do E-mail"}
                onChange={(v) => onChange({ title: v })}
                className="text-balance font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl text-center"
              />
              
              {state.subtitle && (
                <Editable
                  as="p"
                  value={state.subtitle}
                  onChange={(v) => onChange({ subtitle: v })}
                  className="text-sm font-semibold uppercase tracking-widest text-brand text-center"
                />
              )}
              
              <div className="space-y-5 pt-4 text-center">
                {paragraphs.map((p, i) => (
                  <Editable
                    key={i}
                    as="p"
                    multiline
                    value={p}
                    onChange={(v) => {
                      const next = [...paragraphs];
                      next[i] = v;
                      onChange({ body: next.join("\n\n") });
                    }}
                    className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300"
                  />
                ))}
              </div>
              
              <div className="pt-8 pb-4 flex justify-center">
                <Button className="h-12 w-full max-w-xs rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-[1.02] transition-transform shadow-lg">
                  <Editable as="span" value={state.cta ?? "Acessar Agora"} onChange={(v) => onChange({ cta: v })} />
                </Button>
              </div>
            </div>

            {/* FOOTER DO E-MAIL */}
            <div className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20 px-8 py-10 text-center">
              <Editable
                  as="p"
                  value={state.footerText ?? "Você recebeu este e-mail porque se cadastrou em nossa lista."}
                  onChange={(v) => onChange({ footerText: v })}
                  className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-600"
              />
              <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-600 underline cursor-pointer hover:text-slate-500">Descadastrar-se</p>
            </div>
        </div>
      </div>
    </div>
  );
}