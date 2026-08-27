// src/routes/__root.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { ArrowLeft, RefreshCw, TriangleAlert } from "lucide-react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

// --> Imports adicionados para autenticação global
import { supabase } from "../lib/supabase";
import { useBriefflowStore } from "../store/briefflow";

function NotFoundComponent() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-0 px-4 text-fg-primary">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(124,105,255,0.14),transparent_48%)]"
      />
      <div className="relative max-w-md text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl border border-brand/20 bg-brand-muted text-2xl font-bold text-brand">
          404
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Página não encontrada
        </h1>
        <p className="mt-3 text-sm leading-6 text-fg-tertiary">
          Este endereço não existe ou foi movido. Volte ao estúdio para
          continuar sua campanha.
        </p>
        <div className="mt-7">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-fg shadow-[var(--shadow-brand)] transition hover:-translate-y-px hover:brightness-110"
          >
            <ArrowLeft className="mr-2 size-4" /> Voltar ao estúdio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-0 px-4 text-fg-primary">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(251,113,133,0.1),transparent_48%)]"
      />
      <div className="relative max-w-md text-center">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-rose-300">
          <TriangleAlert className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Não foi possível abrir esta tela
        </h1>
        <p className="mt-3 text-sm leading-6 text-fg-tertiary">
          O BrieFlow encontrou um erro inesperado. Tente carregar novamente; sua
          sessão permanece preservada.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg transition hover:brightness-110"
          >
            <RefreshCw className="mr-2 size-4" /> Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border-strong bg-surface-1 px-4 text-sm font-semibold text-fg-secondary transition hover:bg-surface-2 hover:text-fg-primary"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "BrieFlow - Agente de Peças de Marketing com IA" },
        {
          name: "description",
          content:
            "Agente conversacional que analisa seu site e gera banners, posts e e-mails marketing premium no painel lateral.",
        },
        { property: "og:title", content: "BrieFlow Creative" },
        {
          property: "og:description",
          content:
            "Agente conversacional que analisa seu site e gera banners, posts e e-mails marketing premium no painel lateral.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        {
          rel: "icon",
          href: "/assets/icone-brieflow.png?v=3",
          type: "image/png",
          sizes: "any",
        },
        { rel: "apple-touch-icon", href: "/assets/icone-brieflow.png?v=3" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Geist:wght@400;500;600;700;800;900&display=swap",
          crossOrigin: "anonymous",
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" translate="no" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const setUser = useBriefflowStore((state) => state.setUser);

  // Sincronização Global de Sessão
  useEffect(() => {
    if (!supabase) return;

    // 1. Carrega a sessão inicial para persistência após F5/Refresh
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 2. Escuta mudanças globais de estado (Login concluído, Logout, Token expirado)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Limpeza de memória
    return () => subscription.unsubscribe();
  }, [setUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
