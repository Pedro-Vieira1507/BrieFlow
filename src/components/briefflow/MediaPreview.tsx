import { useId, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Film,
  Headphones,
  Loader2,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildMediaRenderPrompt } from "@/lib/mediaRender";
import type { BuilderState } from "@/types/builder";

interface Props {
  state: BuilderState;
  onImportReel?: (file: File) => Promise<void>;
}

const ZSKY_CREATE_URL = "https://zsky.ai/";

export function MediaPreview({ state, onImportReel }: Props) {
  const media = state.mediaRender;
  const document = state.structuredContent;
  const inputId = useId();
  const [importing, setImporting] = useState(false);

  if (
    state.type === "reel" &&
    media?.provider === "zsky" &&
    media.status === "idle" &&
    document
  ) {
    const prompt = buildMediaRenderPrompt("reel", document, state.brandName);

    const copyPrompt = async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        toast.success("Prompt do Reel copiado");
      } catch {
        toast.error("Não foi possível copiar o prompt.");
      }
    };

    const importReel = async (file: File | undefined) => {
      if (!file || !onImportReel || importing) return;
      setImporting(true);
      try {
        await onImportReel(file);
        toast.success("Reel importado e salvo na Biblioteca");
      } catch (error) {
        toast.error("Não foi possível importar o Reel", {
          description:
            error instanceof Error ? error.message : "Tente novamente.",
        });
      } finally {
        setImporting(false);
      }
    };

    return (
      <section className="mx-auto w-full max-w-4xl overflow-hidden rounded-[28px] border border-border-strong bg-surface-1/95 shadow-[var(--shadow-elevated)]">
        <header className="border-b border-border bg-[radial-gradient(circle_at_10%_0%,rgba(124,105,255,0.16),transparent_58%)] px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand">
              <Film className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-fg-primary">
                Reel pronto para gerar gratuitamente
              </p>
              <p className="mt-1 text-xs leading-5 text-fg-tertiary">
                O BrieFlow preparou a direção 9:16. Gere no plano gratuito do
                ZSky e importe o arquivo final aqui.
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <label
              htmlFor={`${inputId}-prompt`}
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-fg-muted"
            >
              Prompt otimizado
            </label>
            <Textarea
              id={`${inputId}-prompt`}
              readOnly
              value={prompt}
              className="min-h-64 resize-none rounded-2xl border-border-strong bg-surface-2 text-xs leading-5 text-fg-secondary"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => void copyPrompt()}
              >
                <Copy className="mr-2 size-4" />
                Copiar prompt
              </Button>
              <Button asChild className="rounded-xl">
                <a
                  href={ZSKY_CREATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir ZSky grátis
                  <ExternalLink className="ml-2 size-4" />
                </a>
              </Button>
            </div>
          </div>

          <aside className="rounded-2xl border border-border-subtle bg-surface-2/70 p-4">
            <p className="text-xs font-semibold text-fg-primary">
              Finalizar no BrieFlow
            </p>
            <ol className="mt-3 space-y-3 text-xs leading-5 text-fg-tertiary">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                Copie o prompt e gere 5 segundos em formato vertical 9:16.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                Baixe o resultado em MP4, WebM ou MOV.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                Importe abaixo; o arquivo será salvo na Biblioteca privada.
              </li>
            </ol>

            <input
              id={inputId}
              type="file"
              className="sr-only"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              disabled={importing || !onImportReel}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void importReel(file);
              }}
            />
            <Button
              asChild
              variant="secondary"
              className="mt-5 w-full rounded-xl"
              aria-disabled={importing || !onImportReel}
            >
              <label
                htmlFor={importing || !onImportReel ? undefined : inputId}
                className="cursor-pointer"
              >
                {importing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                {importing ? "Salvando Reel..." : "Importar Reel final"}
              </label>
            </Button>
            <p className="mt-3 text-center text-[10px] leading-4 text-fg-muted">
              O plano gratuito inclui a marca do ZSky. Limite de 48 MB; nenhuma
              credencial é armazenada.
            </p>
          </aside>
        </div>
      </section>
    );
  }

  if (!media || media.status !== "ready" || !media.url) {
    return (
      <div className="mx-auto flex min-h-[420px] max-w-3xl flex-col items-center justify-center rounded-[28px] border border-border-strong bg-surface-1/90 px-8 py-12 text-center shadow-[var(--shadow-elevated)]">
        <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
          <LoaderCircle className="size-7 animate-spin" />
        </div>
        <h3 className="text-2xl font-semibold tracking-tight text-fg-primary">
          Renderizando mídia final
        </h3>
        <p className="mt-3 max-w-lg text-sm leading-6 text-fg-secondary">
          O BrieFlow está transformando a direção criativa em um arquivo pronto
          para reprodução.
        </p>
      </div>
    );
  }

  const title =
    document?.title ||
    state.title ||
    (media.kind === "audio" ? "Podcast" : "Vídeo");

  return (
    <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-border-strong bg-surface-1/95 shadow-[var(--shadow-elevated)]">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-7">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand">
          {media.kind === "audio" ? (
            <Headphones className="size-5" />
          ) : (
            <Film className="size-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg-primary">
            {title}
          </p>
          <p className="text-xs text-fg-muted">
            {media.kind === "audio"
              ? "Podcast em áudio finalizado"
              : "Vídeo finalizado"}
          </p>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        {media.kind === "audio" ? (
          <div className="rounded-2xl border border-border bg-surface-2 p-5 sm:p-7">
            <audio
              className="w-full"
              controls
              preload="metadata"
              src={media.url}
            >
              Seu navegador não suporta reprodução de áudio.
            </audio>
          </div>
        ) : (
          <div
            className={
              state.type === "reel"
                ? "mx-auto max-w-[430px] overflow-hidden rounded-2xl bg-black"
                : "overflow-hidden rounded-2xl bg-black"
            }
          >
            <video
              className={
                state.type === "reel"
                  ? "aspect-[9/16] w-full object-contain"
                  : "aspect-video w-full object-contain"
              }
              controls
              playsInline
              preload="metadata"
              src={media.url}
            >
              Seu navegador não suporta reprodução de vídeo.
            </video>
          </div>
        )}

        {document?.summary && (
          <p className="mt-5 text-sm leading-6 text-fg-secondary">
            {document.summary}
          </p>
        )}
      </div>
    </section>
  );
}
