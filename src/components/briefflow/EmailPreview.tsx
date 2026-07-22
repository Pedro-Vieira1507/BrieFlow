// components/briefflow/EmailPreview.tsx — Premium Agency Quality
import { useEffect, useMemo, useState } from "react";
import { Editable } from "./Editable";
import type { BuilderState } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Loader2, AlertCircle, RefreshCw, Truck, FlaskConical, Building2, RefreshCcw } from "lucide-react";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function EmailPreview({ state, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const paragraphs = (state.body ?? "").split(/\n\n+/).filter(Boolean);

  const prompt = state.emailHeroImagePrompt || "";
  const heroUrl = useMemo(
    () =>
      prompt
        ? useFallback
          ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed })
          : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed })
        : null,
    [prompt, state.imageSeed, useFallback],
  );

  useEffect(() => {
    if (heroUrl) {
      setLoading(true);
      setError(false);
    }
  }, [heroUrl]);

  const handleImageError = () => {
    setLoading(false);
    if (!useFallback) {
      setUseFallback(true);
    } else {
      setError(true);
    }
  };

  const benefits = [
    { icon: <FlaskConical className="size-4 text-[#00a2ff]" />, label: "Catálogo especializado", desc: "Equipamentos técnicos selecionados para cada área" },
    { icon: <Truck className="size-4 text-[#00a2ff]" />, label: "Frete grátis acima de R$1.500", desc: "Consulte regiões disponíveis" },
    { icon: <Building2 className="size-4 text-[#00a2ff]" />, label: "Atendimento B2B & institucional", desc: "Nota fiscal, pedido empresarial e suporte técnico" },
  ];

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0c0c0e]">

      {/* ── SIMULAÇÃO CAIXA DE ENTRADA ─────────────────────────────── */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-red-400" />
          <div className="size-3 rounded-full bg-amber-400" />
          <div className="size-3 rounded-full bg-emerald-400" />
        </div>
        <p className="ml-2 text-[12px] text-slate-500 font-medium truncate flex-1 text-center">
          Assunto:{" "}
          <span className="text-slate-800 dark:text-slate-300 font-semibold">{state.title}</span>
          {state.preheader && (
            <span className="opacity-40 ml-2">— {state.preheader}</span>
          )}
        </p>
      </div>

      <div className="p-1 md:p-6 bg-slate-50 dark:bg-[#040405]">
        <div className="bg-white dark:bg-black rounded-lg shadow-sm border border-slate-100 dark:border-slate-800/50 overflow-hidden">

          {/* ── HEADER DA MARCA ────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-8 py-5"
            style={{ background: "#08080f" }}
          >
            <span className="text-sm font-black tracking-[2px] text-white uppercase">
              {state.brandName || "Sua Marca"}
            </span>
            <span
              className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
              style={{ borderColor: "rgba(0,162,255,0.4)", color: "#00a2ff", background: "rgba(0,162,255,0.08)" }}
            >
              Frete Grátis
            </span>
          </div>

          {/* ── HERO IMAGE ─────────────────────────────────────────── */}
          {heroUrl && !error ? (
            <div className="relative aspect-[2/1] w-full bg-slate-100 dark:bg-slate-900">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-slate-300" />
                </div>
              )}
              {/* Título sobreposto no hero */}
              <img
                key={heroUrl}
                src={heroUrl}
                alt="Hero"
                onLoad={() => setLoading(false)}
                onError={handleImageError}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <span
                  className="mb-3 inline-block rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                  style={{ background: "#00a2ff" }}
                >
                  Oferta Ativa
                </span>
                <Editable
                  as="h1"
                  value={state.title ?? "Título do E-mail"}
                  onChange={(v) => onChange({ title: v })}
                  className="text-balance font-display text-xl font-black leading-tight tracking-tight text-white drop-shadow-lg md:text-3xl"
                />
              </div>
            </div>
          ) : error ? (
            <div className="aspect-[2/1] w-full bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-2 text-slate-400">
              <AlertCircle className="size-6" />
              <span className="text-xs">Falha ao carregar imagem.</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setUseFallback(false); setError(false); setLoading(true); onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) }); }}
              >
                <RefreshCw className="mr-1 size-3" /> Retry
              </Button>
            </div>
          ) : null}

          {/* ── CORPO ──────────────────────────────────────────────── */}
          <div className="space-y-5 px-8 py-8 md:px-10">

            {/* Saudação */}
            <p className="text-[13px] text-slate-400">Para diretores de laboratório, pesquisadores e compradores institucionais,</p>

            {/* Parágrafos do body gerado pela IA */}
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
                  className="text-[15px] leading-[1.75] text-slate-600 dark:text-slate-300"
                />
              ))}
            </div>

            {/* ── HIGHLIGHT BOX ────────────────────────────────────── */}
            <div
              className="rounded-r-lg border-l-4 px-5 py-4"
              style={{ borderLeftColor: "#00a2ff", background: "#f0f9ff" }}
            >
              <p className="text-[14px] leading-relaxed text-slate-700">
                Compras acima de{" "}
                <strong className="font-bold text-[#0077cc]">R$1.500</strong>{" "}
                têm <strong className="font-bold text-[#0077cc]">frete grátis</strong> para regiões selecionadas.
                Verifique disponibilidade para a sua cidade.
              </p>
            </div>

            {/* ── BENEFÍCIOS ───────────────────────────────────────── */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "rgba(0,162,255,0.08)" }}
                  >
                    {b.icon}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{b.label}</p>
                    <p className="text-[12px] text-slate-400">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── CTA PRINCIPAL ────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-2 pt-4 pb-2">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Estoque disponível para pronta entrega</p>
              <button
                className="w-full max-w-xs rounded-lg py-4 text-[14px] font-bold tracking-wide text-white shadow-lg transition-transform hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #00a2ff, #0077cc)", boxShadow: "0 4px 20px rgba(0,162,255,0.3)" }}
              >
                <Editable
                  as="span"
                  value={state.cta ?? "Explorar Equipamentos →"}
                  onChange={(v) => onChange({ cta: v })}
                />
              </button>
              <p className="text-[11px] text-slate-400">Acesse o catálogo completo com preços</p>
            </div>
          </div>

          {/* ── BANNER DE COMPRA RECORRENTE ────────────────────────── */}
          <div className="mx-6 mb-6 flex items-start gap-4 rounded-xl p-4 md:p-5" style={{ background: "#08080f" }}>
            <RefreshCcw className="size-6 shrink-0 text-[#00a2ff] mt-0.5" />
            <div>
              <p className="text-[13px] font-bold text-white">Compra recorrente disponível</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                Configure reposições automáticas de insumos e nunca interrompa sua pesquisa.{" "}
                <span className="font-semibold text-[#00a2ff] cursor-pointer">Saiba mais →</span>
              </p>
            </div>
          </div>

          {/* ── FOOTER ───────────────────────────────────────────────── */}
          <div className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20 px-8 py-8 text-center">
            <Editable
              as="p"
              value={state.footerText ?? "100% Seguro — Loja Totalmente Protegida."}
              onChange={(v) => onChange({ footerText: v })}
              className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-600"
            />
            <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-600 underline cursor-pointer hover:text-slate-500">
              Descadastrar-se
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}