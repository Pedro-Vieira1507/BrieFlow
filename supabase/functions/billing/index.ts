import {
  authenticate,
  json,
  preflight,
  readJson,
  requirePost,
} from "../_shared/http.ts";
import { stripePriceForPlan, stripeRequest } from "../_shared/stripe.ts";

interface BillingRequest {
  action?: "checkout" | "portal" | "status";
  plan?: string;
  request_id?: string;
}

const SELLABLE_PLANS = ["basic", "pro", "agency"] as const;
type SellablePlan = (typeof SELLABLE_PLANS)[number];

interface BillingAvailability {
  portal_available: boolean;
  checkout_plans: Record<SellablePlan, boolean>;
  prices: Record<SellablePlan, PublicRecurringPrice | null>;
}

interface PublicRecurringPrice {
  currency: string;
  interval: "day" | "week" | "month" | "year";
  interval_count: number;
  unit_amount: number;
}

interface StripeResource {
  id: string;
  url?: string;
}

interface StripePrice extends StripeResource {
  active?: boolean;
  currency?: string;
  livemode?: boolean;
  type?: string;
  unit_amount?: number | null;
  recurring?: {
    interval?: string;
    interval_count?: number;
    usage_type?: string;
  } | null;
}

let availabilityCache:
  | { expiresAt: number; fingerprint: string; value: BillingAvailability }
  | undefined;

function applicationUrl(): URL {
  const raw = Deno.env.get("APP_URL")?.trim();
  if (!raw) throw new Error("app_url_not_configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("app_url_not_secure");
  }
  return url;
}

function configuredBillingAvailability(): BillingAvailability {
  const environment = Deno.env.get("ENVIRONMENT")?.trim().toLowerCase();
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim() ?? "";
  const validStripeKey = /^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+$/.test(
    stripeKey,
  );
  const productionMode = environment === "production";
  const nonProductionMode = ["development", "test", "staging"].includes(
    environment ?? "",
  );
  const correctStripeMode =
    (productionMode && /^(?:sk|rk)_live_/.test(stripeKey)) ||
    (nonProductionMode && /^(?:sk|rk)_test_/.test(stripeKey));
  const validWebhookSecret = /^whsec_[A-Za-z0-9]+$/.test(webhookSecret);

  let validAppUrl = false;
  try {
    applicationUrl();
    validAppUrl = true;
  } catch {
    validAppUrl = false;
  }

  const portalAvailable = validStripeKey && correctStripeMode && validAppUrl;
  const checkoutFoundation = portalAvailable && validWebhookSecret;
  const checkoutPlans = Object.fromEntries(
    SELLABLE_PLANS.map((plan) => [
      plan,
      checkoutFoundation &&
        /^price_[A-Za-z0-9]+$/.test(stripePriceForPlan(plan) ?? ""),
    ]),
  ) as Record<SellablePlan, boolean>;

  return {
    portal_available: portalAvailable,
    checkout_plans: checkoutPlans,
    prices: { basic: null, pro: null, agency: null },
  };
}

function billingFingerprint(availability: BillingAvailability): string {
  return JSON.stringify({
    environment: Deno.env.get("ENVIRONMENT")?.trim().toLowerCase() ?? "",
    app_url: Deno.env.get("APP_URL")?.trim() ?? "",
    portal: availability.portal_available,
    prices: SELLABLE_PLANS.map((plan) => stripePriceForPlan(plan)),
    plans: availability.checkout_plans,
  });
}

async function verifiedBillingAvailability(): Promise<BillingAvailability> {
  const availability = configuredBillingAvailability();
  const fingerprint = billingFingerprint(availability);
  if (
    availabilityCache &&
    availabilityCache.expiresAt > Date.now() &&
    availabilityCache.fingerprint === fingerprint
  ) {
    return availabilityCache.value;
  }

  const expectsLivePrices =
    Deno.env.get("ENVIRONMENT")?.trim().toLowerCase() === "production";
  await Promise.all(
    SELLABLE_PLANS.map(async (plan) => {
      if (!availability.checkout_plans[plan]) return;
      const priceId = stripePriceForPlan(plan);
      if (!priceId) {
        availability.checkout_plans[plan] = false;
        return;
      }

      try {
        const price = await stripeRequest<StripePrice>(
          `/prices/${encodeURIComponent(priceId)}`,
        );
        const interval = price.recurring?.interval;
        const validInterval = ["day", "week", "month", "year"].includes(
          interval ?? "",
        );
        const validPrice =
          price.id === priceId &&
          price.active === true &&
          price.type === "recurring" &&
          price.recurring?.usage_type === "licensed" &&
          validInterval &&
          Number.isInteger(price.recurring?.interval_count) &&
          Number(price.recurring?.interval_count) > 0 &&
          Number.isInteger(price.unit_amount) &&
          Number(price.unit_amount) > 0 &&
          /^[a-z]{3}$/.test(price.currency ?? "") &&
          price.livemode === expectsLivePrices;
        if (!validPrice) {
          availability.checkout_plans[plan] = false;
          return;
        }
        availability.prices[plan] = {
          currency: price.currency!,
          interval: interval as PublicRecurringPrice["interval"],
          interval_count: price.recurring!.interval_count!,
          unit_amount: price.unit_amount!,
        };
      } catch {
        availability.checkout_plans[plan] = false;
      }
    }),
  );

  availabilityCache = {
    expiresAt: Date.now() + 60_000,
    fingerprint,
    value: availability,
  };
  return availability;
}

async function createPortalSession(
  customerId: string,
  organizationId: string,
  requestId: string,
  appUrl: URL,
): Promise<StripeResource> {
  const form = new URLSearchParams();
  form.set("customer", customerId);
  form.set("return_url", new URL("/app", appUrl).toString());
  const session = await stripeRequest<StripeResource>(
    "/billing_portal/sessions",
    {
      method: "POST",
      form,
      idempotencyKey: `brieflow_portal_${organizationId}_${requestId}`,
    },
  );
  if (!session.url) throw new Error("stripe_missing_url");
  return session;
}

async function integrationIdentifier(requestId: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(requestId)),
  );
  const suffix = Array.from(digest.slice(0, 8), (byte) =>
    String.fromCharCode(97 + (byte % 26)),
  ).join("");
  return `brieflow_${suffix}`;
}

Deno.serve(async (req: Request) => {
  const optionsResponse = preflight(req);
  if (optionsResponse) return optionsResponse;
  const methodResponse = requirePost(req);
  if (methodResponse) return methodResponse;

  const context = await authenticate(req).catch(() => null);
  if (!context) return json(req, 401, { error: "unauthorized" });

  try {
    const body = await readJson<BillingRequest>(req, 4_096);
    if (
      !body.action ||
      !["checkout", "portal", "status"].includes(body.action)
    ) {
      return json(req, 400, { error: "invalid_billing_action" });
    }
    if (body.action === "status") {
      const { data: statusAllowed, error: statusRateError } =
        await context.service.rpc("check_rate_limit", {
          p_user_id: context.user.id,
          p_scope: "billing_status",
          p_limit: 30,
        });
      if (statusRateError) throw new Error("billing_rate_limit_failed");
      if (!statusAllowed) {
        return json(req, 429, {
          error: "rate_limit_exceeded",
          message: "Muitas consultas de cobrança. Aguarde um minuto.",
        });
      }
      return json(req, 200, await verifiedBillingAvailability());
    }
    const requestId = body.request_id?.trim() || crypto.randomUUID();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) {
      return json(req, 400, { error: "invalid_request_id" });
    }
    const { data: rateAllowed, error: rateError } = await context.service.rpc(
      "check_rate_limit",
      {
        p_user_id: context.user.id,
        p_scope: "billing",
        p_limit: 10,
      },
    );
    if (rateError) throw new Error("billing_rate_limit_failed");
    if (!rateAllowed) {
      return json(req, 429, {
        error: "rate_limit_exceeded",
        message: "Muitas solicitações de cobrança. Aguarde um minuto.",
      });
    }

    const { data: profile, error: profileError } = await context.service
      .from("profiles")
      .select("default_organization_id")
      .eq("user_id", context.user.id)
      .single();
    if (profileError || !profile?.default_organization_id) {
      return json(req, 409, { error: "account_not_provisioned" });
    }
    const organizationId = profile.default_organization_id as string;

    const { data: membership } = await context.service
      .from("organization_members")
      .select("role,status")
      .eq("organization_id", organizationId)
      .eq("user_id", context.user.id)
      .single();
    if (
      !membership ||
      membership.status !== "active" ||
      !["owner", "admin"].includes(membership.role)
    ) {
      return json(req, 403, { error: "billing_permission_denied" });
    }

    const { data: subscription, error: subscriptionError } =
      await context.service
        .from("subscriptions")
        .select("plan_id,status,stripe_customer_id,stripe_subscription_id")
        .eq("organization_id", organizationId)
        .single();
    if (subscriptionError || !subscription)
      throw new Error("subscription_not_found");

    const configuredAvailability = configuredBillingAvailability();
    if (body.action === "portal" && !configuredAvailability.portal_available) {
      return json(req, 503, { error: "billing_not_configured" });
    }

    const selectedPlan = body.plan?.toLowerCase() ?? "";
    if (
      body.action === "checkout" &&
      !SELLABLE_PLANS.includes(selectedPlan as SellablePlan)
    ) {
      return json(req, 400, { error: "invalid_plan" });
    }
    if (
      body.action === "checkout" &&
      !(await verifiedBillingAvailability()).checkout_plans[
        selectedPlan as SellablePlan
      ]
    ) {
      return json(req, 503, { error: "billing_not_configured" });
    }

    const appUrl = applicationUrl();
    let customerId = subscription.stripe_customer_id as string | null;
    if (!customerId) {
      const customerForm = new URLSearchParams();
      if (context.user.email) customerForm.set("email", context.user.email);
      customerForm.set("metadata[organization_id]", organizationId);
      customerForm.set("metadata[user_id]", context.user.id);
      const customer = await stripeRequest<StripeResource>("/customers", {
        method: "POST",
        form: customerForm,
        idempotencyKey: `brieflow_customer_${organizationId}`,
      });
      customerId = customer.id;
      const { error: customerUpdateError } = await context.service
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("organization_id", organizationId);
      if (customerUpdateError) throw new Error("customer_sync_failed");
    }

    if (body.action === "portal") {
      const session = await createPortalSession(
        customerId,
        organizationId,
        requestId,
        appUrl,
      );
      return json(req, 200, { url: session.url });
    }

    if (
      subscription.stripe_subscription_id &&
      ["active", "trialing", "past_due"].includes(subscription.status)
    ) {
      const session = await createPortalSession(
        customerId,
        organizationId,
        requestId,
        appUrl,
      );
      return json(req, 200, {
        url: session.url,
        mode: "portal",
      });
    }
    const priceId = stripePriceForPlan(selectedPlan);
    if (!priceId) return json(req, 503, { error: "billing_not_configured" });

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("integration_identifier", await integrationIdentifier(requestId));
    form.set("customer", customerId);
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", "1");
    form.set("allow_promotion_codes", "true");
    form.set("client_reference_id", context.user.id);
    form.set("metadata[organization_id]", organizationId);
    form.set("metadata[plan_id]", selectedPlan);
    form.set("subscription_data[metadata][organization_id]", organizationId);
    form.set("subscription_data[metadata][plan_id]", selectedPlan);
    form.set("success_url", new URL("/app?billing=success", appUrl).toString());
    form.set("cancel_url", new URL("/app?billing=canceled", appUrl).toString());

    const session = await stripeRequest<StripeResource>("/checkout/sessions", {
      method: "POST",
      form,
      idempotencyKey: `brieflow_checkout_${organizationId}_${selectedPlan}_${requestId}`,
    });
    if (!session.url) throw new Error("stripe_missing_url");
    return json(req, 200, { url: session.url });
  } catch (error) {
    const code = error instanceof Error ? error.message : "billing_failed";
    const configurationError = [
      "stripe_not_configured",
      "app_url_not_configured",
      "app_url_not_secure",
      "billing_not_configured",
    ].includes(code);
    return json(req, configurationError ? 503 : 502, {
      error: configurationError ? code : "billing_failed",
      message: "Não foi possível iniciar o faturamento.",
    });
  }
});
