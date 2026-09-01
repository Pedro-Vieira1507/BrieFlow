import "jsr:@supabase/functions-js@2.112.4/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { json } from "../_shared/http.ts";
import { planForStripePrice, stripeRequest } from "../_shared/stripe.ts";

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
}

interface StripeSubscription extends Record<string, unknown> {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: {
    data?: Array<{
      current_period_start?: number;
      current_period_end?: number;
      price?: { id?: string };
    }>;
  };
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("backend_not_configured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function parseSignature(value: string | null): {
  timestamp: number;
  signatures: string[];
} {
  if (!value) throw new Error("missing_signature");
  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of value.split(",")) {
    const [key, content] = part.split("=", 2);
    if (key === "t") timestamp = Number(content);
    if (key === "v1" && content) signatures.push(content);
  }
  if (!timestamp || signatures.length === 0)
    throw new Error("invalid_signature");
  return { timestamp, signatures };
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/i.test(hex)) return new Uint8Array();
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
}

async function verifySignature(
  raw: string,
  header: string | null,
): Promise<void> {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();
  if (!secret) throw new Error("webhook_not_configured");
  const { timestamp, signatures } = parseSignature(header);
  if (Math.abs(Date.now() / 1000 - timestamp) > 300)
    throw new Error("signature_expired");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const payload = new TextEncoder().encode(`${timestamp}.${raw}`);
  for (const signature of signatures) {
    const bytes = hexToBytes(signature);
    if (
      bytes.byteLength === 32 &&
      (await crypto.subtle.verify("HMAC", key, bytes, payload))
    )
      return;
  }
  throw new Error("invalid_signature");
}

function normalizedStatus(value: string): string {
  if (
    ["active", "trialing", "past_due", "canceled", "incomplete"].includes(value)
  )
    return value;
  if (["unpaid", "paused"].includes(value)) return "past_due";
  return "incomplete";
}

function iso(timestamp: number | undefined, fallback: Date): string {
  return new Date(
    (timestamp ?? Math.floor(fallback.getTime() / 1000)) * 1000,
  ).toISOString();
}

function invoiceSubscriptionId(object: Record<string, unknown>): string {
  if (typeof object.subscription === "string") return object.subscription;
  const parent = object.parent as Record<string, unknown> | undefined;
  const details = parent?.subscription_details as
    Record<string, unknown> | undefined;
  return typeof details?.subscription === "string" ? details.subscription : "";
}

async function fetchSubscription(id: string): Promise<StripeSubscription> {
  if (!/^sub_[A-Za-z0-9]+$/.test(id)) {
    throw new Error("subscription_mapping_failed");
  }
  return stripeRequest<StripeSubscription>(
    `/subscriptions/${encodeURIComponent(id)}`,
  );
}

async function syncSubscription(
  service: ReturnType<typeof createClient>,
  subscription: StripeSubscription,
  options: {
    resetCredits?: boolean;
    organizationId?: string;
    planId?: string;
    eventCreated: number;
  },
): Promise<void> {
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const planId =
    options.planId ??
    subscription.metadata?.plan_id ??
    planForStripePrice(priceId);
  let organizationId =
    options.organizationId ?? subscription.metadata?.organization_id;

  if (!organizationId) {
    const { data } = await service
      .from("subscriptions")
      .select("organization_id")
      .or(
        `stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${subscription.customer}`,
      )
      .maybeSingle();
    organizationId = data?.organization_id;
  }
  if (!organizationId || !planId)
    throw new Error("subscription_mapping_failed");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      organizationId,
    ) ||
    !/^sub_[A-Za-z0-9]+$/.test(subscription.id) ||
    !/^cus_[A-Za-z0-9]+$/.test(subscription.customer)
  ) {
    throw new Error("subscription_mapping_failed");
  }
  const periodStart =
    subscription.current_period_start ?? item?.current_period_start;
  const periodEnd = subscription.current_period_end ?? item?.current_period_end;
  if (
    !Number.isInteger(periodStart) ||
    !Number.isInteger(periodEnd) ||
    Number(periodStart) <= 0 ||
    Number(periodEnd) <= Number(periodStart)
  ) {
    throw new Error("subscription_period_invalid");
  }

  const { error } = await service.rpc("sync_stripe_subscription", {
    p_organization_id: organizationId,
    p_plan_id: planId,
    p_status: normalizedStatus(subscription.status),
    p_period_start: iso(periodStart, new Date()),
    p_period_end: iso(periodEnd, new Date()),
    p_stripe_customer_id: subscription.customer,
    p_stripe_subscription_id: subscription.id,
    p_stripe_price_id: priceId,
    p_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    p_event_created: options.eventCreated,
    p_reset_credits: Boolean(options.resetCredits),
  });
  if (error) throw new Error("subscription_sync_failed");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return json(req, 405, { error: "method_not_allowed" }, { Allow: "POST" });

  try {
    const declaredLength = Number(req.headers.get("Content-Length") ?? 0);
    if (declaredLength > 512_000)
      return json(req, 413, { error: "request_too_large" });
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 512_000) {
      return json(req, 413, { error: "request_too_large" });
    }
    await verifySignature(raw, req.headers.get("Stripe-Signature"));
    const event = JSON.parse(raw) as StripeEvent;
    if (
      !/^evt_[A-Za-z0-9]{8,250}$/.test(event.id ?? "") ||
      !event.type ||
      !Number.isInteger(event.created) ||
      event.created <= 0 ||
      event.created > Math.floor(Date.now() / 1000) + 300 ||
      !event.data?.object
    )
      throw new Error("invalid_event");

    const service = serviceClient();
    const { data: claimData, error: claimError } = await service.rpc(
      "claim_stripe_webhook",
      {
        p_event_id: event.id,
        p_event_type: event.type,
      },
    );
    if (claimError) throw new Error("webhook_claim_failed");
    const claimed = Array.isArray(claimData) ? claimData[0] : claimData;
    if (!claimed) {
      const { data: existing, error: existingError } = await service
        .from("stripe_webhook_events")
        .select("status")
        .eq("id", event.id)
        .maybeSingle();
      if (existingError) throw new Error("webhook_claim_failed");
      if (existing?.status === "completed") {
        return json(req, 200, {
          received: true,
          duplicate: true,
        });
      }
      return json(req, 409, { error: "event_processing" });
    }
    try {
      const object = event.data.object;
      if (event.type === "checkout.session.completed") {
        const subscriptionId = String(object.subscription ?? "");
        if (!subscriptionId) throw new Error("subscription_missing");
        const subscription = await fetchSubscription(subscriptionId);
        await syncSubscription(service, subscription, {
          resetCredits: true,
          eventCreated: event.created,
          organizationId: (
            object.metadata as Record<string, string> | undefined
          )?.organization_id,
          planId: (object.metadata as Record<string, string> | undefined)
            ?.plan_id,
        });
      } else if (
        [
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted",
        ].includes(event.type)
      ) {
        const subscription = await fetchSubscription(String(object.id ?? ""));
        await syncSubscription(service, subscription, {
          eventCreated: event.created,
        });
      } else if (event.type === "invoice.paid") {
        const subscriptionId = invoiceSubscriptionId(object);
        if (subscriptionId) {
          const subscription = await fetchSubscription(subscriptionId);
          await syncSubscription(service, subscription, {
            resetCredits: true,
            eventCreated: event.created,
          });
        }
      } else if (event.type === "invoice.payment_failed") {
        const subscriptionId = invoiceSubscriptionId(object);
        if (subscriptionId) {
          const subscription = await fetchSubscription(subscriptionId);
          await syncSubscription(service, subscription, {
            eventCreated: event.created,
          });
        } else {
          const customerId = String(object.customer ?? "");
          if (!/^cus_[A-Za-z0-9]+$/.test(customerId)) {
            throw new Error("subscription_mapping_failed");
          }
          const { error: paymentError } = await service
            .from("subscriptions")
            .update({
              status: "past_due",
              stripe_event_created: event.created,
            })
            .eq("stripe_customer_id", customerId)
            .lte("stripe_event_created", event.created);
          if (paymentError) throw new Error("subscription_sync_failed");
        }
      }

      const { error: completeError } = await service
        .from("stripe_webhook_events")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      if (completeError) throw new Error("webhook_completion_failed");
      return json(req, 200, { received: true });
    } catch (error) {
      const code = error instanceof Error ? error.message : "processing_failed";
      await service
        .from("stripe_webhook_events")
        .update({
          status: "failed",
          error_code: code.slice(0, 120),
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      throw error;
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "webhook_failed";
    const unauthorized = [
      "missing_signature",
      "invalid_signature",
      "signature_expired",
    ].includes(code);
    return json(req, unauthorized ? 401 : 400, {
      error: unauthorized ? "invalid_signature" : "webhook_processing_failed",
    });
  }
});
