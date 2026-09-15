import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  FileAudio2,
  Languages,
  Loader2,
  Mic,
  MicOff,
  Send,
  Upload,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  multimodalErrorMessage,
  transcribeMultimodalFile,
  translateAndDubFile,
} from "@/lib/multimodal";
import { startLiveBriefing, type LiveBriefingSession } from "@/lib/liveAudio";
import { useCreditsStore } from "@/hooks/useCredits";

type Mode = "voice" | "transcribe" | "translate";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseBriefing: (text: string) => void;
}

const MODES: Array<{
  id: Mode;
  label: string;
  description: string;
  icon: typeof Mic;
}> = [
  {
    id: "voice",
    label: "Briefing por voz",
    description: "Converse ao vivo com o diretor criativo.",
    icon: Mic,
  },
  {
    id: "transcribe",
    label: "Transcrever",
    description: "Transforme áudio ou vídeo em briefing editável.",
    icon: FileAudio2,
  },
  {
    id: "translate",
    label: "Traduzir e dublar",
    description: "Localize a fala e gere um novo áudio.",
    icon: Languages,
  },
];

const LANGUAGES = [
  ["pt-BR", "Português (Brasil)"],
  ["en-US", "Inglês (EUA)"],
  ["es-ES", "Espanhol"],
  ["fr-FR", "Francês"],
  ["de-DE", "Alemão"],
  ["it-IT", "Italiano"],
] as const;

function appendTranscript(current: string, incoming: string): string {
  const clean = incoming.trim();
  if (!clean || current.endsWith(clean)) return current;
  return `${current}${current ? " " : ""}${clean}`.trim();
}

export function MultimodalStudioModal({
  open,
  onOpenChange,
  onUseBriefing,
}: Props) {
  const [mode, setMode] = useState<Mode>("voice");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState<
    "idle" | "connecting" | "listening" | "closed" | "error"
  >("idle");
  const [transcript, setTranscript] = useState("");
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [dubbedUrl, setDubbedUrl] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en-US");
  const liveSessionRef = useRef<LiveBriefingSession | null>(null);

  const stopLive = async () => {
    const session = liveSessionRef.current;
    liveSessionRef.current = null;
    if (session) await session.stop();
    setLiveStatus((current) => (current === "idle" ? current : "closed"));
  };

  useEffect(() => {
    if (!open) void stopLive();
    return () => {
      void liveSessionRef.current?.stop();
      liveSessionRef.current = null;
    };
  }, [open]);

  const beginLive = async () => {
    setBusy(true);
    setTranscript("");
    setAssistantTranscript("");
    try {
      liveSessionRef.current = await startLiveBriefing({
        onInputTranscript: (text) =>
          setTranscript((current) => appendTranscript(current, text)),
        onAssistantTranscript: (text) =>
          setAssistantTranscript((current) => appendTranscript(current, text)),
        onStatus: setLiveStatus,
        onError: (error) => toast.error(multimodalErrorMessage(error)),
      });
      await useCreditsStore.getState().refresh();
    } catch (error) {
      setLiveStatus("error");
      toast.error("Não foi possível iniciar o briefing por voz", {
        description: multimodalErrorMessage(error),
      });
    } finally {
      setBusy(false);
    }
  };

  const processFile = async () => {
    if (!file || busy) return;
    setBusy(true);
    setTranslation("");
    setDubbedUrl("");
    try {
      if (mode === "transcribe") {
        const result = await transcribeMultimodalFile(file);
        setTranscript(result.transcript);
        toast.success("Transcrição concluída");
      } else {
        const result = await translateAndDubFile(file, targetLanguage);
        setTranscript(result.transcript);
        setTranslation(result.translation);
        setDubbedUrl(result.url);
        toast.success("Tradução e dublagem concluídas");
      }
      await useCreditsStore.getState().refresh();
    } catch (error) {
      toast.error("Não foi possível processar o arquivo", {
        description: multimodalErrorMessage(error),
      });
    } finally {
      setBusy(false);
    }
  };

  const useAsBriefing = () => {
    const content =
      mode === "translate" ? translation || transcript : transcript;
    if (!content.trim()) return;
    onUseBriefing(
      `Use esta transcrição como fonte para o briefing. Extraia objetivo, público, mensagem principal, tom, oferta e canais; faça apenas as perguntas que ainda forem necessárias.\n\nTRANSCRIÇÃO:\n${content}`,
    );
    onOpenChange(false);
  };

  const changeMode = (nextMode: Mode) => {
    void stopLive();
    setMode(nextMode);
    setFile(null);
    setTranscript("");
    setAssistantTranscript("");
    setTranslation("");
    setDubbedUrl("");
    setLiveStatus("idle");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94dvh] w-[calc(100vw-20px)] max-w-[920px] flex-col overflow-hidden rounded-[24px] border-border-strong bg-surface-1 p-0 text-fg-primary shadow-[var(--shadow-elevated)]">
        <DialogHeader className="shrink-0 border-b border-border-subtle bg-[radial-gradient(circle_at_12%_0%,rgba(124,105,255,0.16),transparent_58%)] px-6 py-5 pr-14 text-left">
          <DialogTitle className="flex items-center gap-3 font-display text-xl font-semibold">
            <span className="grid size-10 place-items-center rounded-xl border border-brand/20 bg-brand-muted text-brand">
              <AudioLines className="size-5" />
            </span>
            Estúdio de áudio com IA
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-fg-tertiary">
            Fale com o BrieFlow, transcreva arquivos e produza versões
            traduzidas com áudio final.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[260px_minmax(0,1fr)]">
          <nav className="border-b border-border-subtle bg-surface-2/45 p-3 md:border-b-0 md:border-r">
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
              {MODES.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeMode(item.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      mode === item.id
                        ? "border-brand/40 bg-brand-muted text-fg-primary"
                        : "border-border-subtle bg-surface-2 text-fg-secondary hover:bg-surface-3",
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <Icon className="size-4 text-brand" /> {item.label}
                    </span>
                    <span className="mt-1.5 hidden text-[11px] leading-4 text-fg-muted md:block">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <section className="min-w-0 space-y-5 p-5 sm:p-6">
            {mode === "voice" ? (
              <>
                <div className="rounded-2xl border border-border-subtle bg-surface-2/65 p-5">
                  <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                    <span
                      className={cn(
                        "grid size-14 shrink-0 place-items-center rounded-full border",
                        liveStatus === "listening"
                          ? "animate-pulse border-rose-400/40 bg-rose-500/15 text-rose-300"
                          : "border-brand/20 bg-brand-muted text-brand",
                      )}
                    >
                      {liveStatus === "listening" ? (
                        <AudioLines className="size-6" />
                      ) : (
                        <Mic className="size-6" />
                      )}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold">
                        Diretor de briefing ao vivo
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-fg-tertiary">
                        A IA fará uma pergunta por vez e transcreverá a conversa
                        para você revisar.
                      </p>
                    </div>
                    {liveStatus === "listening" ||
                    liveStatus === "connecting" ? (
                      <Button
                        variant="outline"
                        onClick={() => void stopLive()}
                        className="rounded-xl"
                      >
                        <MicOff className="mr-2 size-4" /> Encerrar
                      </Button>
                    ) : (
                      <Button
                        onClick={() => void beginLive()}
                        disabled={busy}
                        className="rounded-xl bg-brand text-brand-fg"
                      >
                        {busy ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Mic className="mr-2 size-4" />
                        )}
                        Iniciar conversa
                      </Button>
                    )}
                  </div>
                </div>
                {assistantTranscript && (
                  <div className="rounded-xl border border-brand/15 bg-brand-muted/45 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand">
                      Diretor BrieFlow
                    </p>
                    <p className="mt-2 text-sm leading-6 text-fg-secondary">
                      {assistantTranscript}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface-2/65 p-5">
                <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-1/55 px-4 text-center transition hover:border-brand/40">
                  <Upload className="mb-2 size-5 text-brand" />
                  <span className="text-xs font-semibold text-fg-primary">
                    {file ? file.name : "Selecionar áudio ou vídeo"}
                  </span>
                  <span className="mt-1 text-[10px] text-fg-muted">
                    MP3, WAV, OGG, WebM, MP4 ou MOV · até 18 MB
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,video/mp4,video/webm,video/quicktime"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
                {mode === "translate" && (
                  <label className="block text-xs font-semibold text-fg-secondary">
                    Idioma de destino
                    <select
                      value={targetLanguage}
                      onChange={(event) =>
                        setTargetLanguage(event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-border-strong bg-surface-1 px-3 text-sm text-fg-primary outline-none focus:border-brand"
                    >
                      {LANGUAGES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Button
                  onClick={() => void processFile()}
                  disabled={!file || busy}
                  className="w-full rounded-xl bg-brand text-brand-fg"
                >
                  {busy ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <WandSparkles className="mr-2 size-4" />
                  )}
                  {mode === "translate"
                    ? "Traduzir e gerar áudio"
                    : "Transcrever arquivo"}
                </Button>
              </div>
            )}

            {transcript && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                  {mode === "translate"
                    ? "Transcrição original"
                    : "Transcrição do briefing"}
                </label>
                <Textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  className="min-h-36 rounded-xl border-border-strong bg-surface-2 text-sm leading-6"
                />
              </div>
            )}

            {translation && (
              <div className="space-y-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Versão localizada
                </p>
                <Textarea
                  value={translation}
                  onChange={(event) => setTranslation(event.target.value)}
                  className="min-h-32 rounded-xl border-border-strong bg-surface-1 text-sm leading-6"
                />
                {dubbedUrl && (
                  <audio
                    className="w-full"
                    controls
                    preload="metadata"
                    src={dubbedUrl}
                  />
                )}
              </div>
            )}

            {transcript && (
              <Button
                onClick={useAsBriefing}
                variant="outline"
                className="w-full rounded-xl border-brand/30 text-brand"
              >
                <Send className="mr-2 size-4" /> Usar no briefing e criar
                campanha
              </Button>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
