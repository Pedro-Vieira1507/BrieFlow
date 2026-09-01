export async function stripeRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    form?: URLSearchParams;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  if (!secretKey) throw new Error("stripe_not_configured");
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(options.form
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...(options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {}),
    },
    body: options.form?.toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json()) as T & {
    error?: { code?: string; type?: string };
  };
  if (!response.ok) {
    const code =
      payload.error?.code ??
      payload.error?.type ??
      `stripe_http_${response.status}`;
    console.error(
      JSON.stringify({
        event: "stripe_api_error",
        path,
        status: response.status,
        code,
      }),
    );
    throw new Error("stripe_request_failed");
  }
  return payload;
}

export function stripePriceForPlan(plan: string): string | null {
  const variable = {
    basic: "STRIPE_PRICE_BASIC",
    pro: "STRIPE_PRICE_PRO",
    agency: "STRIPE_PRICE_AGENCY",
  }[plan];
  return variable ? Deno.env.get(variable)?.trim() || null : null;
}

export function planForStripePrice(
  priceId: string | null | undefined,
): string | null {
  if (!priceId) return null;
  for (const plan of ["basic", "pro", "agency"] as const) {
    if (stripePriceForPlan(plan) === priceId) return plan;
  }
  return null;
}
