import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  MessageSquarePlus,
  Trash2,
  Zap,
  Mail,
  Image,
  LayoutTemplate,
  Instagram,
  FileText,
  MessageSquare,
} from "lucide-react";
import type { Thread, ContentType } from "@/lib/chat-storage";

interface Props {
  threads: Thread[];
  activeId?: string;
  onNew: () => void;
  onDelete: (id: string) => void;
}

const CONTENT_ICONS: Record<ContentType, React.ReactNode> = {
  email: <Mail className="h-3 w-3" />,
  image: <Image className="h-3 w-3" />,
  banner: <LayoutTemplate className="h-3 w-3" />,
  instagram: <Instagram className="h-3 w-3" />,
  datasheet: <FileText className="h-3 w-3" />,
  text: <MessageSquare className="h-3 w-3" />,
};

const CONTENT_LABELS: Record<ContentType, string> = {
  email: "E-mail",
  image: "Imagem",
  banner: "Banner",
  instagram: "Instagram",
  datasheet: "Ficha técnica",
  text: "Texto",
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function ThreadList({ threads, activeId, onNew, onDelete }: Props) {
  const navigate = useNavigate();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">BrieFlow</p>
          <p className="mt-1 text-xs text-muted-foreground">Criação de conteúdo com IA</p>
        </div>
      </div>

      {/* Nova conversa */}
      <div className="px-3">
        <Button onClick={onNew} className="w-full justify-start gap-2" variant="secondary">
          <MessageSquarePlus className="h-4 w-4" />
          Nova conversa
        </Button>
      </div>

      {/* Lista de threads */}
      <nav className="thin-scroll mt-4 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {threads.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhuma conversa ainda.
          </p>
        )}
        {threads.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
                active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"
              }`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex min-w-0 flex-1 flex-col px-3 py-2"
              >
                {/* Título */}
                <span className="truncate text-sm leading-tight">
                  {t.title || "Sem título"}
                </span>
                {/* Meta: data + tipo de conteúdo */}
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{formatDate(t.updatedAt)}</span>
                  {t.lastContentType && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="flex items-center gap-0.5">
                        {CONTENT_ICONS[t.lastContentType]}
                        <span>{CONTENT_LABELS[t.lastContentType]}</span>
                      </span>
                    </>
                  )}
                </span>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!confirm("Excluir esta conversa?")) return;
                  onDelete(t.id);
                  if (active) navigate({ to: "/" });
                }}
                className="invisible rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive group-hover:visible"
                aria-label="Excluir conversa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Ollama local · Pollinations.ai · Histórico salvo no navegador
      </div>
    </aside>
  );
}
