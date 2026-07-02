import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Eye, Sparkles, User2, Square, Building2, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Message } from "@/lib/chat-storage";
import type { Artifact } from "@/lib/chat-storage";
import type { BrandProfile } from "@/lib/brand-memory";

interface Props {
  messages: Message[];
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  streamingText?: string;
  brandProfile?: BrandProfile;
  onSaveBrand?: (patch: Partial<BrandProfile>) => void;
  loadingStage?: "classifying" | "generating" | "rendering";
  /** Chamado ao clicar em "Visualizar" numa mensagem com artefato */
  onViewArtifact?: (artifact: Artifact) => void;
}

export function ChatPanel({
  messages,
  onSend,
  onStop,
  isStreaming,
  streamingText,
  brandProfile,
  onSaveBrand,
  loadingStage,
  onViewArtifact,
}: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [messages.length, isStreaming]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming, streamingText]);

  function submit() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSend(text);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Barra de contexto de marca */}
      {(brandProfile?.companyName || onSaveBrand) && (
        <BrandContextBar profile={brandProfile} onEdit={onSaveBrand} />
      )}

      {/* Mensagens */}
      <div className="thin-scroll flex-1 overflow-y-auto px-5 py-6">
        {messages.length === 0 ? (
          <EmptyChat onPick={(p) => onSend(p)} />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} onViewArtifact={onViewArtifact} />
            ))}
            {isStreaming && <Typing stage={loadingStage} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background/60 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card/80 p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/40">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Peça um e-mail HTML, uma imagem para Instagram, uma ficha técnica…"
              rows={1}
              className="min-h-[44px] resize-none border-0 bg-transparent focus-visible:ring-0"
            />
            {isStreaming ? (
              <Button size="icon" variant="secondary" onClick={onStop} aria-label="Parar">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={submit} disabled={!input.trim()} aria-label="Enviar">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Enter para enviar · Shift+Enter para nova linha · Conectado ao Ollama local
          </p>
        </div>
      </div>
    </div>
  );
}

/** Barra superior com resumo do perfil de marca da conversa */
function BrandContextBar({
  profile,
  onEdit,
}: {
  profile?: BrandProfile;
  onEdit?: (patch: Partial<BrandProfile>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<BrandProfile>>(profile ?? {});

  if (!profile?.companyName && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted/50"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span>Configure o perfil de marca desta conversa para resultados mais precisos →</span>
      </button>
    );
  }

  if (editing) {
    return (
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <p className="mb-2 text-xs font-medium text-foreground">Perfil de marca — esta conversa</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {([
            ["companyName", "Empresa"],
            ["sector", "Setor"],
            ["primaryColor", "Cor principal"],
            ["toneOfVoice", "Tom de voz"],
            ["targetAudience", "Público-alvo"],
            ["extra", "Notas extras"],
          ] as [keyof BrandProfile, string][]).map(([key, label]) => (
            <div key={key} className={key === "extra" ? "col-span-2" : ""}>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">{label}</label>
              <input
                type="text"
                value={(form[key] as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              onEdit?.(form);
              setEditing(false);
            }}
            className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/80"
          >
            Salvar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-muted/20">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted/30"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="flex-1 font-medium text-foreground">{profile?.companyName}</span>
        {profile?.sector && <span className="text-muted-foreground">{profile.sector}</span>}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setForm(profile ?? {});
            setEditing(true);
          }}
          className="rounded px-2 py-0.5 hover:bg-muted"
        >
          Editar
        </button>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="grid grid-cols-2 gap-1 px-4 pb-2 text-[10px] text-muted-foreground">
          {profile?.toneOfVoice && <span>Tom: {profile.toneOfVoice}</span>}
          {profile?.primaryColor && <span>Cor: {profile.primaryColor}</span>}
          {profile?.targetAudience && (
            <span className="col-span-2">Público: {profile.targetAudience}</span>
          )}
        </div>
      )}
    </div>
  );
}

function MessageRow({
  message,
  onViewArtifact,
}: {
  message: Message;
  onViewArtifact?: (artifact: Artifact) => void;
}) {
  const isUser = message.role === "user";
  const hasArtifact = !isUser && !!message.artifact;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
        }`}
      >
        {isUser ? <User2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
            : "max-w-[85%] text-sm text-foreground"
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown>{message.content || "…"}</ReactMarkdown>
          </div>
        )}

        {/* Botão Visualizar — aparece apenas em mensagens do agente que têm artefato */}
        {hasArtifact && onViewArtifact && (
          <button
            onClick={() => onViewArtifact(message.artifact!)}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/60 hover:bg-card hover:text-primary"
          >
            <Eye className="h-3.5 w-3.5" />
            Visualizar
          </button>
        )}
      </div>
    </div>
  );
}

/** Indicador de carregamento com estágios detalhados */
function Typing({ stage }: { stage?: "classifying" | "generating" | "rendering" }) {
  const stageLabel =
    stage === "classifying"
      ? "Classificando pedido..."
      : stage === "rendering"
        ? "Renderizando..."
        : "Gerando conteúdo...";

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3 py-2.5">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </div>
        {stage && (
          <span className="px-1 text-[10px] text-muted-foreground">{stageLabel}</span>
        )}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
      style={{ animationDelay: delay }}
    />
  );
}

function EmptyChat({ onPick }: { onPick: (s: string) => void }) {
  const suggestions = [
    "Crie um e-mail HTML de Black Friday para um e-commerce de tênis",
    "Gere uma imagem de marketing para um café especial, estilo minimalista",
    "Monte uma ficha técnica de um fone bluetooth premium",
    "Escreva 3 legendas de Instagram para lançamento de SaaS",
  ];
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 pt-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Sparkles className="h-7 w-7" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agente de Marketing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Diga o que você precisa — texto, e-mail HTML, ficha técnica ou imagem — e veja o artefato renderizado ao lado.
        </p>
      </div>
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-border bg-card/60 px-4 py-3 text-left text-sm transition hover:border-primary/60 hover:bg-card"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
