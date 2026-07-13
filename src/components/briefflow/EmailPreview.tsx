import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function EmailPreview({ state, onChange }: Props) {
  const paragraphs = (state.body ?? "").split(/\n\n+/);

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border bg-white shadow-soft">
      <div className="h-2 bg-gradient-brand" />
      <div className="space-y-6 p-10">
        <Editable
          as="h1"
          value={state.title ?? "Título do e-mail"}
          onChange={(v) => onChange({ title: v })}
          className="text-3xl font-bold text-neutral-900"
        />
        {state.subtitle !== undefined && (
          <Editable
            as="p"
            value={state.subtitle}
            onChange={(v) => onChange({ subtitle: v })}
            className="text-lg text-neutral-600"
          />
        )}
        <div className="space-y-4">
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
              className="text-base leading-relaxed text-neutral-700"
            />
          ))}
        </div>
        <div className="pt-4">
          <Button className="bg-gradient-brand text-brand-foreground shadow-elegant hover:opacity-90">
            <Editable
              as="span"
              value={state.cta ?? "Clique aqui"}
              onChange={(v) => onChange({ cta: v })}
              className="text-base font-semibold"
            />
          </Button>
        </div>
        <div className="border-t pt-6 text-xs text-neutral-400">
          Enviado por BrieFlow · Editável clicando em qualquer texto
        </div>
      </div>
    </div>
  );
}
