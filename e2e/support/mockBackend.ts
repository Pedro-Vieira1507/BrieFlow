import type { Page, Route } from "@playwright/test";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_EMAIL = "qa@brieflow.local";
const AUTH_STORAGE_KEY = "sb-test-auth-token";

const allowedFormats = [
  "banner",
  "social",
  "email",
  "reel",
  "video",
  "podcast",
  "slides",
  "technical_sheet",
  "blog",
  "whatsapp",
];

const testUser = {
  id: TEST_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: TEST_EMAIL,
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const session = {
  access_token: "e2e-access-token",
  refresh_token: "e2e-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: testUser,
};

const tinyImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='675'%3E%3Crect width='1200' height='675' fill='%23111627'/%3E%3Ccircle cx='910' cy='340' r='180' fill='%236d5dfc' fill-opacity='.32'/%3E%3C/svg%3E";

function discoveryResponse() {
  return {
    chat: "Briefing organizado. A campanha vai transformar perda de tempo procurando contexto em uma tensão concreta e convidar o público para uma demonstração.",
    action: "discovery_continue",
    targetKeys: ["all"],
    detectedContext: {
      brandName: "Atlas",
      productSku: null,
      productUrl: null,
      productName: "Painel Atlas",
      offer: null,
      audience: "Gestores de operações B2B",
      tone: "Claro, direto e confiante",
      objective: "Agendar uma demonstração",
    },
    builder: {
      type: "discovery_plan",
      discoveryPlan: {
        detectedContext:
          "Marca Atlas; produto Painel Atlas; público gestores de operações B2B; objetivo agendar uma demonstração.",
        missingInfo: "",
        proposedStrategy:
          "Tornar a perda de tempo procurando informação uma tensão concreta: decisões começam quando os dados deixam de ser caça.",
        brandName: "Atlas",
        product: "Painel de gestão operacional",
        audience: "Gestores de operações B2B",
        offer: "",
        objective: "Agendar uma demonstração",
        tone: "Claro, direto e confiante",
      },
    },
    scores: { persuasion: 88, clarity: 94, seo: 80 },
  };
}

function materialResponse(action: string) {
  if (action === "banner") {
    return {
      headline: "Decidir sem caça ao dado",
      subheadline: "Operação visível, decisão mais rápida",
      body: "Centralize o contexto que sua equipe precisa para agir.",
      footerInfo: "",
      ctaText: "Ver demonstração",
      ctaVariant: "primary",
      keyBenefits: ["Contexto em um lugar"],
      objectionsHandled: [],
      layoutStyle: "split",
      badgePrimary: "",
      badgeSecondary: "",
      backgroundShape: "curve",
      imagePrompt:
        "premium B2B operations environment, clear focal area, editorial lighting, no text",
      themeColor: "#6d5dfc",
      secondaryColor: "#111827",
    };
  }

  if (action === "email") {
    return {
      subject: "Quanto tempo sua operação perde procurando contexto?",
      preheader: "Um convite para tornar decisão e informação parte do mesmo fluxo.",
      headline: "Decisão começa com contexto",
      subtitle: "Menos procura. Mais ação.",
      body: "Quando a equipe precisa abrir planilhas, mensagens e sistemas diferentes para entender o que está acontecendo, a decisão começa atrasada. O Painel Atlas organiza o contexto operacional em um só fluxo para que gestores encontrem o que precisam antes de agir. A proposta não é adicionar mais uma tela à rotina, mas reduzir a caça à informação que acontece antes de cada decisão. Veja a demonstração e avalie como esse fluxo se encaixa na sua operação.",
      ctaText: "Agendar demonstração",
      ctaVariant: "primary",
      keyBenefits: ["Contexto centralizado", "Leitura operacional clara"],
      objectionsHandled: [],
      heroBadge: "",
      benefitTitle: "",
      secondaryCta: "",
      urgencyText: "",
      testimonials: [],
      footerInfo: "",
      layoutStyle: "editorial",
      backgroundShape: "square",
      imagePrompt:
        "refined B2B editorial environment with operational depth, no text",
      themeColor: "#6d5dfc",
      secondaryColor: "#111827",
    };
  }

  return {
    hook: "Sua equipe encontra o dado ou caça o dado?",
    body: "Quando cada decisão começa procurando contexto em lugares diferentes, o custo aparece antes mesmo da ação. O Painel Atlas organiza a leitura operacional para que gestores cheguem ao próximo passo com mais clareza. A ideia é simples: a informação precisa estar no fluxo da decisão, não espalhada ao redor dele.",
    cta: "Veja uma demonstração",
    hashtags: ["#Operações", "#GestãoB2B", "#Produtividade"],
    imagePrompt:
      "editorial B2B social visual about finding operational context, no text",
    themeColor: "#6d5dfc",
    secondaryColor: "#111827",
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
    },
  });
}

export async function installMockBackend(
  page: Page,
  options: { dismissOnboarding?: boolean } = { dismissOnboarding: true },
) {
  const assets: Array<Record<string, unknown>> = [];

  await page.addInitScript(
    ({ authKey, authSession, dismissOnboarding }) => {
      window.localStorage.setItem(authKey, JSON.stringify(authSession));
      if (dismissOnboarding) {
        window.localStorage.setItem(
          "brieflow:onboarding:creative-studio:v2",
          "done",
        );
      } else {
        window.localStorage.removeItem(
          "brieflow:onboarding:creative-studio:v2",
        );
      }
    },
    {
      authKey: AUTH_STORAGE_KEY,
      authSession: session,
      dismissOnboarding: options.dismissOnboarding ?? true,
    },
  );

  await page.route("https://test.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.startsWith("/auth/v1/user")) {
      return json(route, testUser);
    }

    if (url.pathname.startsWith("/auth/v1/token")) {
      return json(route, session);
    }

    if (url.pathname === "/rest/v1/rpc/get_user_plan") {
      return json(route, [
        {
          plan: "agency",
          credits_monthly: 100,
          credits_remaining: 99,
          monthly_credit_cap: 1000,
          monthly_credits_used: 1,
          subscription_status: "active",
          allowed_formats: allowedFormats,
          max_members: 10,
          max_saved_assets: 100,
          organization_id: null,
        },
      ]);
    }

    if (url.pathname === "/functions/v1/ai-proxy") {
      const payload = (request.postDataJSON() ?? {}) as { action?: string };
      const action = payload.action ?? "discovery";
      const raw =
        action === "discovery"
          ? discoveryResponse()
          : materialResponse(action);
      return json(route, {
        model: "brieflow-e2e",
        choices: [{ message: { content: JSON.stringify(raw) } }],
        _meta: {
          request_id: `e2e-${action}`,
          provider: "mock",
          model: "brieflow-e2e",
          used_fallback: false,
          latency_ms: 2,
          credits_remaining: 99,
        },
      });
    }

    if (url.pathname === "/functions/v1/image-render") {
      return json(route, {
        url: tinyImage,
        path: "e2e/visual.svg",
        model: "mock-image",
        aspect_ratio: "16:9",
      });
    }

    if (url.pathname === "/rest/v1/assets") {
      if (method === "GET") return json(route, assets);

      if (method === "POST") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const created = {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          user_id: TEST_USER_ID,
          organization_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...payload,
        };
        assets.unshift(created);
        return json(route, created, 201);
      }

      if (method === "PATCH") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const current = assets[0] ?? {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          user_id: TEST_USER_ID,
          organization_id: null,
          created_at: new Date().toISOString(),
        };
        const updated = {
          ...current,
          ...payload,
          updated_at: new Date().toISOString(),
        };
        assets.splice(0, assets.length, updated);
        return json(route, updated);
      }

      if (method === "DELETE") {
        assets.splice(0, assets.length);
        return route.fulfill({ status: 204, body: "" });
      }
    }

    if (url.pathname.includes("/storage/v1/object/sign/campaign-assets")) {
      return json(route, []);
    }

    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
      });
    }

    return json(route, {});
  });

  return { assets };
}
