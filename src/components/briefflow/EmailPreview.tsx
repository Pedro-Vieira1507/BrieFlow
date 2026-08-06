// src/components/briefflow/EmailPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  TicketPercent,
  Hexagon,
  Upload,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { cleanText, isEmptyLike } from "@/lib/sanitize";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function EmailPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [useFallback, setUseFallback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { builder } = useBriefflowStore();

  const themeColor = state.themeColor || "#2563EB";
  const brandName = cleanText(state.brandName, "SUA MARCA");
  const title = cleanText(state.title, "Título do e-mail");
  const cta = cleanText(state.cta, "Comprar agora");
  const hasCta = !isEmptyLike(cta);

  const paragraphs = useMemo(
    () =>
      cleanText(state.body ?? "")
        .split(/\n+/)
        .map((p) => cleanText(p))
        .filter((p) => p.length > 0)
        .filter((p) => {
          // remove parágrafos que são só duplicata do CTA
          const lp = p.toLowerCase();
          const lc = cta.toLowerCase();
          if (!lc) return true;
          if (lp === lc) return false;
          if (lp.includes(lc) && lp.length <= lc.length + 10) return false;
          return true;
        }),
    [state.body, cta],
  );

  const prompt = cleanText(state.emailHeroImagePrompt);
  const isProductImage = !!state.productImageUrl;

  const offerRaw = builder.discoveryPlan?.offer;
  const hasOffer = !isEmptyLike(offerRaw);
  const couponCode = hasOffer ? cleanText(offerRaw).toUpperCase() : null;

  const images = Array.from(
    new Set([
      ...(state.productImageUrl ? [state.productImageUrl] : []),
      ...(state.productImages || []),
    ]),
  );

  const heroUrl = useMemo(() => {
    if (!prompt) return null;
    return useFallback
      ? buildFallbackUrl(prompt, {
          width: 1200,
          height: 600,
          seed: state.imageSeed,
        })
      : buildPollinationsUrl(prompt, {
          width: 1200,
          height: 600,
          seed: state.imageSeed,
        });
  }, [prompt, state.imageSeed, useFallback]);

  useEffect(() => {
    if (!heroUrl) return;
    setImageStatus("loading");
    const timer = setTimeout(() => {
      setImageStatus((prev) => {
        if (prev === "loading") {
          if (!useFallback && !isProductImage) {
            setUseFallback(true);
            return "loading";
          }
          return "error";
        }
        return prev;
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [heroUrl, useFallback, isProductImage]);

  const handleImageError = () => {
    if (!useFallback && !isProductImage) setUseFallback(true);
    else setImageStatus("error");
  };
  const handleImageLoad = () => setImageStatus("loaded");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({ productImageUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRegenerate = () => {
    setImageStatus("loading");
    setUseFallback(false);
    onChange({ imageSeed: Math.floor(Math.random() * 1_000_000) });
  };

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col space-y-4"
      data-testid="email-preview"
    >
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#09090b]">
        {/* Barra estilo cliente de e-mail */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-2">
            <div className="size-3 rounded-full bg-red-400" />
            <div className="size-3 rounded-full bg-amber-400" />
            <div className="size-3 rounded-full bg-emerald-400" />
          </div>
          <p className="ml-4 flex-1 truncate text-center text-[13px] font-medium text-slate-500">
            Assunto:{" "}
            <span className="font-bold text-slate-900 dark:text-slate-200">
              {title}
            </span>
          </p>
        </div>

        <div className="bg-slate-50 p-4 md:p-8 dark:bg-[#030304]">
          {/*
            CARD INTERNO: flex-col para o CTA nunca ser cortado.
            min-h garante altura mínima; conteúdo faz scroll interno se estourar.
          */}
          <div
            className={cn(
              "flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl",
              "dark:border-white/5 dark:bg-[#0c0c0e]",
              "min-h-[420px]",
            )}
          >
            {/* Brand bar */}
            <div className="flex items-center justify-center border-b border-slate-100 bg-white px-8 py-5 dark:border-slate-800 dark:bg-[#0c0c0e]">
              <div className="flex items-center gap-2 min-w-0">
                <Hexagon className="size-6 shrink-0" style={{ color: themeColor }} />
                <span className="truncate text-lg font-black uppercase tracking-[0.1em] text-slate-900 dark:text-white">
                  {brandName}
                </span>
              </div>
            </div>

            {/* Hero */}
            {heroUrl && (
              <div className="relative flex aspect-[2.2/1] w-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-900">
                {imageStatus === "loading" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center">
                    <Loader2 className="size-8 animate-spin text-slate-400" />
                  </div>
                )}

                {imageStatus === "error" ? (
                  <div className="absolute inset-0 z-0 flex flex-col items-center justify-center border-y border-dashed border-slate-500/30 bg-slate-200/50 dark:bg-slate-800/50">
                    <AlertCircle className="mb-2 size-8 text-slate-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Falha ao carregar capa
                    </span>
                  </div>
                ) : (
                  <img
                    src={heroUrl}
                    alt="Hero"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    loading="lazy"
                    decoding="async"
                    className={cn(
                      "absolute inset-0 z-0 h-full w-full object-cover",
                      imageStatus === "loading"
                        ? "opacity-0"
                        : "opacity-100 transition-opacity duration-700",
                    )}
                  />
                )}

                {images.map((src, i) => (
                  <DraggableImage key={`${src}-${i}`} src={src} />
                ))}
              </div>
            )}

            {/* Corpo — flex-1 para que CTA fique ancorado no rodapé */}
            <div className="flex flex-1 flex-col px-6 py-10 md:px-12">
              <Editable
                as="h1"
                value={title}
                onChange={(v) => onChange({ title: v })}
                className={cn(
                  "mb-8 text-center font-display text-2xl font-black leading-tight tracking-tight",
                  "text-slate-900 dark:text-white",
                  "text-balance break-words",
                )}
              />

              <div className="space-y-4">
                {paragraphs.length === 0 ? (
                  <p className="text-center text-[14px] italic text-slate-400">
                    Ainda não há corpo definido. Edite o briefing e regenere o
                    e-mail.
                  </p>
                ) : (
                  paragraphs.map((p, i) => {
                    const isBullet = /^[-*]\s/.test(p);
                    if (isBullet) {
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30"
                        >
                          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                          <Editable
                            as="p"
                            multiline
                            value={p.replace(/^[-*]\s/, "")}
                            onChange={(v) => {
                              const next = [...paragraphs];
                              next[i] = `- ${v}`;
                              onChange({ body: next.join("\n") });
                            }}
                            className="min-w-0 flex-1 break-words text-[15px] font-medium leading-relaxed text-slate-700 dark:text-slate-300"
                          />
                        </div>
                      );
                    }
                    return (
                      <Editable
                        key={i}
                        as="p"
                        multiline
                        value={p}
                        onChange={(v) => {
                          const next = [...paragraphs];
                          next[i] = v;
                          onChange({ body: next.join("\n") });
                        }}
                        className="break-words text-center text-[16px] font-light leading-[1.8] text-slate-600 dark:text-slate-400"
                      />
                    );
                  })
                )}
              </div>

              {couponCode && (
                <div className="relative mb-6 mt-10 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="absolute -top-3 flex items-center gap-1.5 bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:bg-[#0c0c0e]">
                    <TicketPercent className="size-3.5" /> Desconto Exclusivo
                  </div>
                  <span className="mt-2 break-all text-xl font-black tracking-widest text-slate-900 dark:text-white">
                    {couponCode}
                  </span>
                </div>
              )}

              {/* CTA ancorado no rodapé */}
              {hasCta && (
                <div className="mt-auto flex flex-col items-center gap-4 pt-8">
                  <button
                    type="button"
                    data-testid="email-cta-btn"
                    className={cn(
                      "group flex w-full max-w-sm items-center justify-center gap-3 rounded-xl px-8 py-4",
                      "text-[14px] font-bold uppercase tracking-widest text-white shadow-xl",
                      "transition-all hover:scale-[1.02]",
                    )}
                    style={{ backgroundColor: themeColor }}
                  >
                    <Editable
                      as="span"
                      value={cta}
                      onChange={(v) => onChange({ cta: v })}
                      className="block max-w-[28ch] truncate"
                    />
                    <ChevronRight className="size-4 shrink-0" strokeWidth={3} />
                  </button>
                  <div className="mt-2 flex items-center gap-2 text-slate-400">
                    <ShieldCheck className="size-4" />
                    <span className="text-[11px] font-medium uppercase tracking-widest">
                      Ambiente Seguro
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 opacity-80 shadow-sm transition-opacity hover:opacity-100">
        <div className="min-w-0 flex-1 truncate pr-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Peça:{" "}
          <span style={{ color: themeColor }} className="mr-3">
            E-MAIL MARKETING
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileRef}
            onChange={handleFileChange}
            data-testid="email-upload-input"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-border-strong bg-surface-2 text-xs font-bold"
            onClick={() => fileRef.current?.click()}
            data-testid="email-upload-btn"
          >
            <Upload className="mr-2 size-3.5" /> Upload Foto
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 text-xs font-bold"
            onClick={handleRegenerate}
            data-testid="email-regenerate-btn"
          >
            <RefreshCw className="mr-2 size-3.5" /> Gerar IA
          </Button>
        </div>
      </div>
    </div>
  );
}
