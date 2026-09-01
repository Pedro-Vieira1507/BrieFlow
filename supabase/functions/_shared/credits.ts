import type { RequestContext } from "./http.ts";
import type { Json } from "./database.ts";

export interface AuthorizationResult {
  ok: boolean;
  code: string;
  credits_remaining: number;
  credit_cost: number;
  plan: string;
  allowed_formats: string[];
  organization_id: string;
}

export async function authorize(
  context: RequestContext,
  action: string,
  requestId: string,
  metadata: Record<string, Json | undefined> = {},
): Promise<AuthorizationResult> {
  const { data, error } = await context.service.rpc("authorize_generation", {
    p_user_id: context.user.id,
    p_action: action,
    p_request_id: requestId,
    p_metadata: metadata,
  });
  if (error) throw new Error("authorization_failed");
  const result = (
    Array.isArray(data) ? data[0] : data
  ) as AuthorizationResult | null;
  if (!result) throw new Error("authorization_failed");
  return result;
}

export async function refund(
  context: RequestContext,
  requestId: string,
  reason: string,
): Promise<void> {
  await context.service.rpc("refund_generation", {
    p_user_id: context.user.id,
    p_request_id: requestId,
    p_reason: reason.slice(0, 200),
  });
}

export function authorizationStatus(code: string): number {
  if (code === "duplicate_request") return 409;
  if (code === "rate_limit_exceeded") return 429;
  if (code === "insufficient_credits") return 402;
  if (
    [
      "format_not_allowed",
      "subscription_inactive",
      "membership_inactive",
    ].includes(code)
  )
    return 403;
  return 500;
}
