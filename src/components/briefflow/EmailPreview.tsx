// src/components/briefflow/EmailPreview.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { buildPollinationsUrl, buildFallbackUrl } from "@/lib/pollinations";
import { Button } from "@/components/ui/button";
import {
  Loader2, AlertCircle, ChevronRight, ShieldCheck, BadgeCheck, CheckCircle2, TicketPercent,
  Hexagon, Upload, RefreshCw, Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";
import { cleanText, isEmptyLike } from "@/lib/sanitize";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function EmailPreview({ state, onChange }: Props) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">("loading");
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
  
  // Lógica do Cupom Ajustada
  const offerRaw = builder.discoveryPlan?.offer;
  const hasOffer = !isEmptyLike(offerRaw);
  const couponCode = state.footerText || "LAB70";

  const images = Array.from(
    new Set([
      ...(state.productImageUrl ? [state.productImageUrl] : []),
      ...(state.productImages || []),
    ]),
  );

  const heroUrl = useMemo(() => {
    if (!prompt) return null;
    return useFallback
      ? buildFallbackUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed })
      : buildPollinationsUrl(prompt, { width: 1200, height: 600, seed: state.imageSeed });
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
    <div className="mx-auto flex w-full max-w-2xl flex-col space-y-3" data-testid="email-preview">
      <div className="overflow-hidden rounded-[20px] border border-slate-200 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-red-400/90" />
            <div className="size-3 rounded-full bg-amber-400/90" />
            <div className="size-3 rounded-full bg-emerald-400/90" />
          </div>
          <p className="ml-2 flex-1 truncate text-center text-[12px] font-medium text-slate-400">
            Para: <span className="font-semibold text-slate-700">cliente@exemplo.com</span>
            {"     "}
            <span className="font-semibold text-slate-700">{title}</span>
          </p>
        </div>

        <div className="px-4 py-6 md:px-8 md:py-8" style={{ backgroundColor: `${themeColor}10` }}>
          <div
            className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            style={{ borderTop: `4px solid ${themeColor}` }}
          >
            <div
              className="flex flex-col items-center justify-center border-b border-slate-100 px-8 py-6"
              style={{ background: `linear-gradient(180deg, ${themeColor}08 0%, transparent 100%)` }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: `${themeColor}18` }}>
                  <Hexagon className="size-5" style={{ color: themeColor }} />
                </div>
                <span className="text-lg font-black uppercase tracking-[0.2em] text-slate-900">
                  {brandName}
                </span>
              </div>
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                Comunicação Oficial
              </p>
            </div>

            {heroUrl && (
              <div className="relative aspect-[2/1] w-full overflow-hidden bg-slate-100">
                {imageStatus === "loading" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm">
                    <Loader2 className="size-8 animate-spin text-slate-400" />
                  </div>
                )}
                {imageStatus === "error" ? (
                  <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-slate-200/50">
                    <AlertCircle className="mb-2 size-8 text-slate-400" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Falha ao carregar imagem de capa
                    </span>
                  </div>
                ) : (
                  <img
                    src={heroUrl}
                    alt="Capa do e-mail"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    loading="lazy"
                    className={cn(
                      "absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-700",
                      imageStatus === "loading" ? "opacity-0" : "opacity-100",
                    )}
                  />
                )}
                {images.map((src, i) => (
                  <DraggableImage key={`${src}-${i}`} src={src} />
                ))}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/30 to-transparent" />
              </div>
            )}

            <div className="flex flex-1 flex-col px-7 py-10 md:px-12">
              <Editable
                as="h1"
                value={title}
                onChange={(v) => onChange({ title: v })}
                className="mb-8 text-center font-black leading-tight tracking-tight text-[24px] md:text-[28px] text-slate-900 text-balance break-words"
              />

              <div className="space-y-4">
                {paragraphs.length === 0 ? (
                  <p className="text-center text-[14px] italic text-slate-400">Nenhum corpo definido. Edite o briefing e regenere o e-mail.</p>
                ) : (
                  paragraphs.map((p, i) => {
                    const isBullet = /^[-*]\s/.test(p);
                    if (isBullet) {
                      return (
                        <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                          <CheckCircle2 className="mt-0.5 size-5 shrink-0" style={{ color: themeColor }} />
                          <Editable
                            as="p"
                            multiline
                            value={p.replace(/^[-*]\s/, "")}
                            onChange={(v) => {
                              const next = [...paragraphs];
                              next[i] = `- ${v}`;
                              onChange({ body: next.join("\n") });
                            }}
                            className="min-w-0 flex-1 break-words text-[15px] font-medium leading-relaxed text-slate-700"
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
                        className="break-words text-center text-[16px] font-light leading-[1.8] text-slate-600"
                      />
                    );
                  })
                )}
              </div>

              {hasOffer && (
                <div className="relative mb-6 mt-10 rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white px-6 py-8">
                  <div
                    className="absolute z-10 -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border px-4 py-1 text-[11px] font-extrabold uppercase tracking-widest"
                    style={{ borderColor: `${themeColor}40`, backgroundColor: "white", color: themeColor }}
                  >
                    <TicketPercent className="size-3.5" /> Desconto Exclusivo
                  </div>
                  <div className="flex flex-col items-center gap-3 pt-2 relative z-0">
                    <p className="text-center text-[14px] font-bold text-slate-700 max-w-[90%] leading-snug mb-1">
                      {cleanText(offerRaw)}
                    </p>
                    <div 
                      className="rounded-xl border-2 border-dashed px-8 py-3 bg-white"
                      style={{ borderColor: `${themeColor}50` }}
                    >
                      <Editable 
                        as="span" 
                        value={couponCode} 
                        onChange={(v) => onChange({ footerText: v })} 
                        className="text-2xl font-black tracking-[0.25em] text-slate-900 uppercase"
                      />
                    </div>
                    <p className="text-[12px] font-medium text-slate-400 mt-1">Use o código acima ao finalizar a compra</p>
                  </div>
                  <div className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-slate-100" />
                  <div className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-slate-100" />
                </div>
              )}

              {hasCta && (
                <div className="mt-auto flex flex-col items-center gap-5 pt-8">
                  <button
                    type="button"
                    className="group flex w-full max-w-sm items-center justify-center gap-3 rounded-xl px-8 py-4 text-[14px] font-extrabold uppercase tracking-widest text-white shadow-xl transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl"
                    style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                  >
                    <Editable as="span" value={cta} onChange={(v) => onChange({ cta: v })} className="block max-w-[28ch] truncate" />
                    <ChevronRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={3} />
                  </button>

                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <ShieldCheck className="size-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Ambiente Seguro</span>
                    </div>
                    <div className="h-3 w-px bg-slate-200" />
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <BadgeCheck className="size-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Compra Garantida</span>
                    </div>
                    <div className="h-3 w-px bg-slate-200" />
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Lock className="size-3.5" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Dados Protegidos</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-10 border-t border-slate-100 pt-6 text-center">
                <p className="text-[11px] text-slate-400">
                  Você está recebendo este e-mail pois se cadastrou em <span className="font-bold text-slate-500">{brandName}</span>.
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  <span className="cursor-pointer underline">Cancelar inscrição</span>
                  {" | "}
                  <span className="cursor-pointer underline">Política de Privacidade</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3 opacity-80 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100">
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
          <Button size="sm" variant="outline" className="h-8 shrink-0 border-border-strong bg-surface-2 text-xs font-bold" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Upload Foto
          </Button>
          <Button size="sm" variant="ghost" className="h-8 shrink-0 text-xs font-bold" onClick={handleRegenerate}>
            <RefreshCw className="mr-1.5 size-3.5" /> Gerar IA
          </Button>
        </div>
      </div>
    </div>
  );
}