import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUp,
  Eye,
  Sparkles,
  User2,
  Square,
  Building2,
  ChevronDown,
  ChevronUp,
  Brain,
  Target,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Message, Artifact } from "@/lib/chat-storage";
import type { BrandProfile } from "@/lib/brand-memory";

interface Props {
  messages?: Message[];
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  streamingText?: string;
  brandProfile?: BrandProfile;
  onSaveBrand?: (patch: Partial<BrandProfile>) => void;
  loadingStage?: "classifying" | "planning" | "generating" | "validating" | "rendering";
  onViewArtifact?: (artifact: Artifact) => void;
}

export function ChatPanel({
  messages,
  onSend,
  onStop,
  isStreaming = false,
  streamingText = "",
  brandProfile,
  onSaveBrand,
  loadingStage,
  onViewArtifact,
}: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const safeMessages = useMemo(() => messages ?? [], [messages]);
  const messageCount = safeMessages.length;

  useEffect(() => {
    textareaRef.current?.focus();
  }, [messageCount, isStreaming]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageCount, isStreaming, streamingText]);

  function submit() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSend(text);
  }

  return (
    <div className="flex h-full flex-col">
      {(brandProfile?.companyName || onSaveBrand) && (
        <BrandContextBar profile={brandProfile} onEdit={onSaveBrand} />
      )}

      <div className="thin-scroll flex-1 overflow-y-auto px-5 py-6">
        {messageCount === 0 ? (
          <EmptyChat onPick={onSend} />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {safeMessages.map((message, index) => (
              <MessageRow
                key={message?.id ?? `${message?.role ?? "message"}-${index}`}
                message={message}
                onViewArtifact={onViewArtifact}
              />
            ))}

            {isStreaming && <Typing stage={loadingStage} />}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

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
              <Button
                size="icon"
                variant="secondary"
                onClick={onStop}
                aria-label="Parar"
                disabled={!onStop}
              >
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

  useEffect(() => {
    setForm(profile ?? {});
  }, [profile]);

  if (!profile?.companyName && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted/50"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span>Configure o perfil de marca desta conversa para resultados mais precisos →</span>
      </button>
    );
  }

  if (editing) {
    const fields: [keyof BrandProfile, string][] = [
      ["companyName", "Empresa"],
      ["sector", "Setor"],
      ["primaryColor", "Cor principal"],
      ["toneOfVoice", "Tom de voz"],
      ["targetAudience", "Público-alvo"],
      ["extra", "Notas extras"],
    ];

    return (
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <p className="mb-2 text-xs font-medium text-foreground">Perfil de marca — esta conversa</p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {fields.map(([key, label]) => (
            <div key={String(key)} className={key === "extra" ? "col-span-2" : ""}>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">{label}</label>
              <input
                type="text"
                value={String(form?.[key] ?? "")}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onEdit?.(form);
              setEditing(false);
            }}
            className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/80"
          >
            Salvar
          </button>

          <button
            type="button"
            onClick={() => {
              setForm(profile ?? {});
              setEditing(false);
            }}
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
      <div className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition hover:text-foreground"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate font-medium text-foreground">
            {profile?.companyName ?? "Perfil de marca"}
          </span>
          {profile?.sector && <span className="truncate text-muted-foreground">{profile.sector}</span>}
          {expanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
        </button>

        <button
          type="button"
          onClick={() => {
            setForm(profile ?? {});
            setEditing(true);
          }}
          className="rounded px-2 py-0.5 hover:bg-muted"
        >
          Editar
        </button>
      </div>

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

function AgentReasoning({ reasoning }: { reasoning: NonNullable<Message["reasoning"]> }) {
  const [open, setOpen] = useState(false);

  const pills = [
    reasoning?.intent ? { icon: <Zap className="h-3 w-3" />, label: reasoning.intent } : null,
    reasoning?.objective ? { icon: <Target className="h-3 w-3" />, label: reasoning.objective } : null,
    reasoning?.tone ? { icon: <Brain className="h-3 w-3" />, label: reasoning.tone } : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  const questions = reasoning?.questions ?? [];

  return (
    <div className="mb-2">
      <div className="mb-1 flex flex-wrap gap-1.5">
        {pills.map((pill, index) => (
          <span
            key={`${pill.label}-${index}`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {pill.icon}
            {pill.label}
          </span>
        ))}

        {reasoning?.funnelStage && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary/70">
            funil: {reasoning.funnelStage}
          </span>
        )}
      </div>

      {reasoning?.summary && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground transition hover:text-foreground"
          >
            <Brain className="h-3 w-3" />
            {open ? "Ocultar raciocínio" : "Ver raciocínio estratégico"}
            {open ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          </button>

          {open && (
            <div className="mt-1.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              <ReactMarkdown>{reasoning.summary}</ReactMarkdown>
            </div>
          )}
        </>
      )}

      {questions.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="mb-1.5 text-[10px] font-medium text-amber-600">
            Para resultados mais precisos, informe:
          </p>
          <ul className="space-y-1">
            {questions.map((question, index) => (
              <li key={`${question}-${index}`} className="flex gap-1.5 text-[11px] text-muted-foreground">
                <span className="shrink-0 text-amber-500">{index + 1}.</span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
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
  const isUser = message?.role === "user";
  const artifact = message?.artifact;
  const reasoning = message?.reasoning;
  const content = message?.content ?? "";

  const hasArtifact = !isUser && !!artifact;
  const hasReasoning = !isUser && !!reasoning;

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
        {hasReasoning && reasoning && <AgentReasoning reasoning={reasoning} />}

        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown>{content || "…"}</ReactMarkdown>
          </div>
        )}

        {hasArtifact && onViewArtifact && artifact && (
          <button
            type="button"
            onClick={() => onViewArtifact(artifact)}
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

function Typing({
  stage,
}: {
  stage?: "classifying" | "planning" | "generating" | "validating" | "rendering";
}) {
  const stageLabel =
    stage === "classifying"
      ? "Classificando pedido e detectando intenção..."
      : stage === "planning"
        ? "Planejando estrutura do copy..."
        : stage === "validating"
          ? "Validando coerência com canal e objetivo..."
          : stage === "rendering"
            ? "Renderizando artefato..."
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

        {stage && <span className="px-1 text-[10px] text-muted-foreground">{stageLabel}</span>}
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

function EmptyChat({ onPick }: { onPick: (suggestion: string) => void }) {
  const suggestions = [
    "Crie um e-mail HTML de Black Friday para um e-commerce de tênis com foco em conversão",
    "Gere um banner Shimadzu com 3% de desconto em azul escuro e vermelho",
    "Monte uma ficha técnica de um fone bluetooth premium com especificações técnicas",
    "Escreva 3 legendas de Instagram para lançamento de SaaS de gestão financeira",
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
        <p className="mt-1 text-xs text-muted-foreground/70">
          O agente classifica seu pedido, planeja a estrutura e valida a saída antes de entregar.
        </p>
      </div>

      <div className="grid w-full gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-xl border border-border bg-card/60 px-4 py-3 text-left text-sm transition hover:border-primary/60 hover:bg-card"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}