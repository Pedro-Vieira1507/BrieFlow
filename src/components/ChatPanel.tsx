import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Sparkles, User2, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Message } from "@/lib/chat-storage";

interface Props {
  messages: Message[];
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
}

export function ChatPanel({ messages, onSend, onStop, isStreaming }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [messages.length, isStreaming]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming]);

  function submit() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSend(text);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="thin-scroll flex-1 overflow-y-auto px-5 py-6">
        {messages.length === 0 ? (
          <EmptyChat onPick={(p) => onSend(p)} />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
            {isStreaming && <Typing />}
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

function MessageRow({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
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
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3 py-2.5">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
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
