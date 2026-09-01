import {
  authenticate,
  json,
  preflight,
  readJson,
  requirePost,
} from "../_shared/http.ts";
import { stripePriceForPlan, stripeRequest } from "../_shared/stripe.ts";

interface BillingRequest {
  action?: "checkout" | "portal";
  plan?: string;
  request_id?: string;
}

interface StripeResource {
  id: string;
  url?: string;
}

function applicationUrl(): URL {
  const raw = Deno.env.get("APP_URL")?.trim();
  if (!raw) throw new Error("app_url_not_configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("app_url_not_secure");
  }
  return url;
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
    if (!body.action || !["checkout", "portal"].includes(body.action)) {
      return json(req, 400, { error: "invalid_billing_action" });
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
      return json(req, 200, { url: session.url });
    }

    const selectedPlan = body.plan?.toLowerCase() ?? "";
    if (!["basic", "pro", "agency"].includes(selectedPlan)) {
      return json(req, 400, { error: "invalid_plan" });
    }
    const priceId = stripePriceForPlan(selectedPlan);
    if (!priceId) return json(req, 503, { error: "plan_price_not_configured" });
    if (
      subscription.stripe_subscription_id &&
      ["active", "trialing", "past_due"].includes(subscription.status)
    ) {
      return json(req, 409, {
        error: "subscription_already_exists",
        message: "Use o portal de cobrança para alterar seu plano.",
      });
    }

    const form = new URLSearchParams();
    form.set("mode", "subscription");
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
    ].includes(code);
    return json(req, configurationError ? 503 : 502, {
      error: configurationError ? code : "billing_failed",
      message: "Não foi possível iniciar o faturamento.",
    });
  }
});
