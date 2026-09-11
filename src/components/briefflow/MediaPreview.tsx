import { Film, Headphones, LoaderCircle } from "lucide-react";
import type { BuilderState } from "@/types/builder";

interface Props {
  state: BuilderState;
}

export function MediaPreview({ state }: Props) {
  const media = state.mediaRender;
  const document = state.structuredContent;

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
