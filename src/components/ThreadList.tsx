import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Trash2, Sparkles } from "lucide-react";
import type { Thread } from "@/lib/chat-storage";

interface Props {
  threads: Thread[];
  activeId?: string;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ThreadList({ threads, activeId, onNew, onDelete }: Props) {
  const navigate = useNavigate();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">Marketing AI</p>
          <p className="mt-1 text-xs text-muted-foreground">Studio de artefatos</p>
        </div>
      </div>

      <div className="px-3">
        <Button onClick={onNew} className="w-full justify-start gap-2" variant="secondary">
          <MessageSquarePlus className="h-4 w-4" />
          Nova conversa
        </Button>
      </div>

      <nav className="thin-scroll mt-4 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
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
                className="flex-1 truncate px-3 py-2 text-sm"
              >
                {t.title || "Sem título"}
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

      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Ollama local · Pollinations.ai · Histórico salvo no navegador
      </div>
    </aside>
  );
}
