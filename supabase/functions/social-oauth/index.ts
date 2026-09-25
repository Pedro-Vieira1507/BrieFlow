import {
  createServiceClient,
  json,
  preflight,
  readJson,
  requirePost,
} from "../_shared/http.ts";
import {
  activeOrganization,
  socialClient,
  socialContext,
  socialMessages,
} from "../_shared/socialContext.ts";
import {
  authorizationUrl,
  exchangeCode,
  socialKey,
  readiness,
} from "../_shared/socialProviders.ts";
import { randomSecret, seal, sha256, unseal } from "../_shared/socialCrypto.ts";
import { isChannel } from "../_shared/social.ts";

Deno.serve(async (req: Request) => {
  const cors = preflight(req);
  if (cors) return cors;
  if (req.method === "GET") {
    const destination = new URL(
      Deno.env.get("APP_URL") || "https://brieflow-ai.vercel.app",
    );
    destination.searchParams.set("social_connection", "error");
    try {
      const url = new URL(req.url),
        state = url.searchParams.get("state"),
        code = url.searchParams.get("code");
      if (!state || !/^[\w-]{43}$/.test(state))
        throw new Error("invalid_state");
      const db = socialClient(),
        hash = await sha256(state);
      // DELETE RETURNING is a single-use atomic consume, including denied authorization.
      const { data: pending, error } = await db
        .from("social_oauth_states")
        .delete()
        .eq("state_hash", hash)
        .gt("expires_at", new Date().toISOString())
        .select()
        .maybeSingle();
      if (error || !pending || !code || !isChannel(pending.channel))
        throw new Error("invalid_state");
      if (!readiness().find((c) => c.channel === pending.channel)?.configured)
        throw new Error("provider_not_configured");
      const service = createServiceClient();
      const { data: userData } = await service.auth.admin.getUserById(
        pending.user_id,
      );
      if (
        !userData.user ||
        (await activeOrganization({
          service,
          user: userData.user,
          token: "",
        })) !== pending.organization_id
      )
        throw new Error("membership_inactive");
      const verifier = await unseal(
        pending.verifier_ciphertext,
        socialKey(),
        hash,
      );
      const identities = await exchangeCode(pending.channel, code, verifier);
      if (!identities.length) throw new Error("no_eligible_accounts");
      for (const identity of identities) {
        if (!identity.externalId || !identity.token || !identity.label)
          throw new Error("invalid_identity");
        const { data: account, error: saveError } = await db
          .from("social_accounts")
          .upsert(
            {
              user_id: pending.user_id,
              organization_id: pending.organization_id,
              channel: pending.channel,
              external_id: identity.externalId,
              label: identity.label.slice(0, 200),
              expires_at: identity.expiresAt,
            },
            { onConflict: "user_id,organization_id,channel,external_id" },
          )
          .select()
          .single();
        if (saveError || !account) throw new Error("account_save_failed");
        const binding = `${pending.user_id}:${pending.organization_id}:${pending.channel}:${identity.externalId}`;
        const { error: credentialError } = await db
          .from("social_credentials")
          .upsert({
            account_id: account.id,
            ciphertext: await seal(identity.token, socialKey(), binding),
            updated_at: new Date().toISOString(),
          });
        if (credentialError) throw new Error("credential_save_failed");
      }
      destination.searchParams.set("social_connection", "connected");
    } catch {
      /* Callback URL intentionally contains no provider detail or credential. */
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: destination.toString(),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  const method = requirePost(req);
  if (method) return method;
  try {
    const context = await socialContext(req),
      body = await readJson<{ channel?: unknown }>(req, 1024);
    if (!isChannel(body.channel)) throw new Error("invalid_request");
    const { data: limited, error: limitError } = await context.service.rpc(
      "check_rate_limit",
      { p_user_id: context.user.id, p_scope: "social-oauth", p_limit: 6 },
    );
    if (limitError || !limited) throw new Error("rate_limit_exceeded");
    const state = randomSecret(),
      verifier = randomSecret(),
      hash = await sha256(state);
    const url = await authorizationUrl(
      body.channel,
      state,
      await sha256(verifier),
    );
    await context.db
      .from("social_oauth_states")
      .delete()
      .eq("user_id", context.user.id)
      .lt("expires_at", new Date().toISOString());
    const { error } = await context.db.from("social_oauth_states").insert({
      state_hash: hash,
      user_id: context.user.id,
      organization_id: context.org,
      channel: body.channel,
      verifier_ciphertext: await seal(verifier, socialKey(), hash),
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });
    if (error) throw new Error("state_save_failed");
    return json(req, 200, { url });
  } catch (error) {
    const code =
      error instanceof Error && socialMessages[error.message]
        ? error.message
        : "internal_error";
    return json(
      req,
      code === "unauthorized" ? 401 : code === "internal_error" ? 500 : 400,
      { error: code, message: socialMessages[code] },
    );
  }
});
