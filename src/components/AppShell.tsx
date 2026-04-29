import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Settings,
  FlaskConical,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/nova-campanha", label: "Nova campanha", icon: PlusCircle },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Forlab</div>
            <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/70">Agente de Conteúdo</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="rounded-md bg-sidebar-accent/60 p-3 text-xs">
            <div className="flex items-center gap-2 text-sidebar-primary font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              Modelo de IA
            </div>
            <div className="mt-1 text-sidebar-foreground/80">Gemini 2.5 Flash · pronto</div>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden border-b border-border bg-card px-4 py-3 flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <div className="font-semibold">Agente de Conteúdo Forlab</div>
        </header>
        <div className="flex-1 min-w-0">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</div>;
}
