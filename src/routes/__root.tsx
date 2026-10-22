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

import { supabase } from "../lib/supabase";
import { useBriefflowStore } from "../store/briefflow";

const SITE_URL = "https://brieflow-ai.vercel.app";
const SITE_TITLE = "BrieFlow — Estúdio criativo de marketing com IA";
const SITE_DESCRIPTION =
  "Transforme um briefing em campanhas, banners, e-mails, posts, apresentações e documentos com IA, revisão humana e exportação em um único estúdio.";
const SOCIAL_IMAGE = `${SITE_URL}/app-preview.jpg`;

const SOFTWARE_APPLICATION_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BrieFlow",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  image: SOCIAL_IMAGE,
  description: SITE_DESCRIPTION,
  inLanguage: "pt-BR",
  offers: {
    "@type": "Offer",
    category: "SaaS",
  },
  featureList: [
    "Briefing guiado por IA",
    "Direção criativa multiformato",
    "Geração de banner, social e e-mail",
    "Apresentações e documentos exportáveis",
    "Biblioteca privada de campanhas",
    "Revisão e edição antes da exportação",
  ],
});

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
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-fg shadow-[var(--shadow-brand)] transition hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ArrowLeft className="mr-2 size-4" /> Voltar ao estúdio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
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
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RefreshCw className="mr-2 size-4" /> Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border-strong bg-surface-1 px-4 text-sm font-semibold text-fg-secondary transition hover:bg-surface-2 hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
        { title: SITE_TITLE },
        { name: "description", content: SITE_DESCRIPTION },
        { name: "application-name", content: "BrieFlow" },
        { name: "apple-mobile-web-app-title", content: "BrieFlow" },
        { name: "theme-color", content: "#07080c" },
        { name: "color-scheme", content: "dark" },
        { name: "robots", content: "index,follow,max-image-preview:large" },
        { name: "format-detection", content: "telephone=no" },
        { property: "og:title", content: SITE_TITLE },
        { property: "og:description", content: SITE_DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:site_name", content: "BrieFlow" },
        { property: "og:url", content: SITE_URL },
        { property: "og:image", content: SOCIAL_IMAGE },
        {
          property: "og:image:alt",
          content: "Prévia do estúdio criativo BrieFlow",
        },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: SITE_TITLE },
        { name: "twitter:description", content: SITE_DESCRIPTION },
        { name: "twitter:image", content: SOCIAL_IMAGE },
        {
          name: "twitter:image:alt",
          content: "Prévia do estúdio criativo BrieFlow",
        },
      ],
      links: [
        { rel: "canonical", href: SITE_URL },
        { rel: "stylesheet", href: appCss },
        {
          rel: "icon",
          href: "/assets/icone-brieflow.png?v=3",
          type: "image/png",
          sizes: "any",
        },
        { rel: "apple-touch-icon", href: "/assets/icone-brieflow.png?v=3" },
        { rel: "manifest", href: "/site.webmanifest" },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: SOFTWARE_APPLICATION_SCHEMA }}
        />
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

  useEffect(() => {
    if (!supabase) return;
    let observedAuthEvent = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!observedAuthEvent) setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      observedAuthEvent = true;
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
