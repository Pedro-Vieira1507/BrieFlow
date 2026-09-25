import { json, preflight, readJson, requirePost } from "../_shared/http.ts";
import {
  socialContext,
  socialMessages,
  uuid,
} from "../_shared/socialContext.ts";
import { unseal } from "../_shared/socialCrypto.ts";
import {
  creatorInfo,
  fetchMetrics,
  finishInstagram,
  object,
  ProviderError,
  publishToProvider,
  readiness,
  readPublicationStatus,
  socialKey,
  string,
} from "../_shared/socialProviders.ts";
import {
  isChannel,
  publicationIssues,
  validateBrief,
  validateCopy,
  type PublishOptions,
  type SocialAccount,
  type SocialAttachment,
  type SocialBrief,
  type SocialCopy,
} from "../_shared/social.ts";
import type { AccountRow, PostRow } from "../_shared/socialDatabase.ts";

type Context = Awaited<ReturnType<typeof socialContext>>;
const must = (error: unknown) => {
  if (error) throw new Error("internal_error");
};
async function loadCampaign(ctx: Context, id: unknown) {
  if (!uuid(id)) throw new Error("invalid_request");
  const { data, error } = await ctx.db
    .from("social_campaigns")
    .select()
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .eq("organization_id", ctx.org)
    .maybeSingle();
  must(error);
  if (!data) throw new Error("not_found");
  return data;
}
async function loadPost(ctx: Context, id: unknown): Promise<PostRow> {
  if (!uuid(id)) throw new Error("invalid_request");
  const { data, error } = await ctx.db
    .from("social_posts")
    .select()
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .eq("organization_id", ctx.org)
    .maybeSingle();
  must(error);
  if (!data) throw new Error("not_found");
  return data;
}
async function loadAccount(
  ctx: Context,
  id: unknown,
  channel?: string,
): Promise<{ account: SocialAccount; token: string }> {
  if (!uuid(id)) throw new Error("account_invalid");
  const { data, error } = await ctx.db
    .from("social_accounts")
    .select()
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .eq("organization_id", ctx.org)
    .maybeSingle();
  must(error);
  if (!data || (channel && data.channel !== channel))
    throw new Error("account_invalid");
  if (data.expires_at && Date.parse(data.expires_at) <= Date.now())
    throw new Error("account_expired");
  if (!readiness().find((c) => c.channel === data.channel)?.configured)
    throw new Error("provider_not_configured");
  const { data: credential, error: secretError } = await ctx.db
    .from("social_credentials")
    .select("ciphertext")
    .eq("account_id", id)
    .single();
  must(secretError);
  if (!credential) throw new Error("account_invalid");
  return {
    account: { ...data, status: "connected" },
    token: await unseal(
      credential.ciphertext,
      socialKey(),
      `${ctx.user.id}:${ctx.org}:${data.channel}:${data.external_id}`,
    ),
  };
}
async function updateResult(
  ctx: Context,
  post: PostRow,
  result: {
    status: string;
    remoteId: string | null;
    remoteUrl: string | null;
    jobId: string | null;
  },
) {
  const { error } = await ctx.db
    .from("social_posts")
    .update({
      status: result.status as PostRow["status"],
      remote_id: result.remoteId,
      remote_url: result.remoteUrl,
      provider_job_id: result.jobId,
      error: null,
      published_at:
        result.status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id)
    .eq("user_id", ctx.user.id);
  if (error) throw new ProviderError("provider_network_uncertain", true);
}
async function markFailure(ctx: Context, post: PostRow, error: unknown) {
  const code =
    error instanceof Error && socialMessages[error.message]
      ? error.message
      : "internal_error";
  // Unknown exceptions after the claim are uncertain, never safe-to-retry by assumption.
  const uncertain = !(error instanceof ProviderError) || error.uncertain;
  await ctx.db
    .from("social_posts")
    .update({
      status: uncertain ? "uncertain" : "failed",
      error: socialMessages[code],
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id)
    .eq("user_id", ctx.user.id);
}
async function validateAttachments(
  ctx: Context,
  campaignId: string,
  input: unknown,
): Promise<SocialAttachment[]> {
  if (!Array.isArray(input) || input.length > 12)
    throw new Error("media_invalid");
  const out: SocialAttachment[] = [];
  for (const raw of input) {
    const m = object(raw),
      path = string(m.path),
      filename = path.split("/").at(-1)!;
    if (
      !uuid(m.id) ||
      !path.startsWith(`${ctx.user.id}/${campaignId}/`) ||
      path.split("/").length !== 3 ||
      !/^[\w-]+\.(jpg|jpeg|png|webp|mp4)$/.test(filename)
    )
      throw new Error("media_invalid");
    const { data, error } = await ctx.db.storage
      .from("social-briefs")
      .list(`${ctx.user.id}/${campaignId}`, { search: filename, limit: 1 });
    const file = data?.find((v) => v.name === filename),
      metadata = object(file?.metadata);
    if (
      error ||
      !file ||
      !["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(
        string(metadata.mimetype),
      ) ||
      Number(metadata.size) > 26214400
    )
      throw new Error("media_invalid");
    out.push({
      id: m.id,
      path,
      name: string(m.name).slice(0, 200),
      mime: string(metadata.mimetype),
      size: Number(metadata.size),
      description: string(m.description).slice(0, 2000),
      ...(typeof m.duration === "number" && m.duration > 0 && m.duration <= 3600
        ? { duration: m.duration }
        : {}),
    });
  }
  if (
    new Set(out.map((m) => m.id)).size !== out.length ||
    new Set(out.map((m) => m.path)).size !== out.length
  )
    throw new Error("media_invalid");
  return out;
}
Deno.serve(async (req: Request) => {
  const cors = preflight(req);
  if (cors) return cors;
  const method = requirePost(req);
  if (method) return method;
  try {
    const ctx = await socialContext(req),
      body = await readJson<Record<string, unknown>>(req, 100000),
      action = string(body.action);
    const { data: rate, error: rateError } = await ctx.service.rpc(
      "check_rate_limit",
      { p_user_id: ctx.user.id, p_scope: "social-workspace", p_limit: 60 },
    );
    if (rateError || !rate) throw new Error("rate_limit_exceeded");
    if (action === "list") {
      const [campaigns, accounts] = await Promise.all([
        ctx.db
          .from("social_campaigns")
          .select()
          .eq("user_id", ctx.user.id)
          .eq("organization_id", ctx.org)
          .order("updated_at", { ascending: false })
          .limit(100),
        ctx.db
          .from("social_accounts")
          .select()
          .eq("user_id", ctx.user.id)
          .eq("organization_id", ctx.org)
          .order("created_at", { ascending: false }),
      ]);
      must(campaigns.error);
      must(accounts.error);
      const safeAccounts = (accounts.data ?? []).map((a: AccountRow) => ({
        ...a,
        status:
          a.expires_at && Date.parse(a.expires_at) <= Date.now()
            ? "expired"
            : "connected",
      }));
      return json(req, 200, {
        campaigns: campaigns.data,
        accounts: safeAccounts,
        readiness: readiness(),
      });
    }
    if (action === "get") {
      const campaign = await loadCampaign(ctx, body.id);
      const { data: posts, error } = await ctx.db
        .from("social_posts")
        .select()
        .eq("campaign_id", campaign.id)
        .eq("user_id", ctx.user.id);
      must(error);
      const postIds = (posts ?? []).map((p) => p.id);
      const metrics = postIds.length
        ? await ctx.db
            .from("social_metric_snapshots")
            .select()
            .in("post_id", postIds)
            .eq("user_id", ctx.user.id)
            .order("fetched_at", { ascending: false })
            .limit(300)
        : { data: [], error: null };
      must(metrics.error);
      return json(req, 200, { campaign, posts, metrics: metrics.data });
    }
    if (action === "save_campaign") {
      const brief = body.brief as SocialBrief;
      if (!brief || validateBrief(brief).length)
        throw new Error("invalid_request");
      if (!body.id) {
        const { data, error } = await ctx.db.rpc("social_create_campaign", {
          p_user_id: ctx.user.id,
          p_brief: brief,
        });
        if (error)
          throw new Error(
            socialMessages[error.message] ? error.message : "internal_error",
          );
        return json(req, 200, {
          campaign: Array.isArray(data) ? data[0] : data,
        });
      }
      const existing = await loadCampaign(ctx, body.id),
        attachments = await validateAttachments(
          ctx,
          existing.id,
          body.attachments,
        );
      const { data, error } = await ctx.db
        .from("social_campaigns")
        .update({
          brief,
          attachments,
          version: existing.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("version", Number(body.version))
        .eq("user_id", ctx.user.id)
        .select()
        .maybeSingle();
      must(error);
      if (!data) throw new Error("conflict");
      return json(req, 200, { campaign: data });
    }
    if (action === "save_post") {
      const campaign = await loadCampaign(ctx, body.campaignId),
        channel = body.channel,
        copy = body.copy as SocialCopy;
      if (
        !isChannel(channel) ||
        !campaign.brief.channels.includes(channel) ||
        !copy ||
        validateCopy(channel, copy).length
      )
        throw new Error("invalid_request");
      const mediaId = body.attachmentId || null;
      if (mediaId && !campaign.attachments.some((m) => m.id === mediaId))
        throw new Error("media_invalid");
      if (body.id) {
        const post = await loadPost(ctx, body.id);
        if (post.campaign_id !== campaign.id || post.channel !== channel)
          throw new Error("invalid_request");
        const { data, error } = await ctx.db
          .from("social_posts")
          .update({
            copy,
            attachment_id: mediaId as string | null,
            version: post.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id)
          .eq("status", "draft")
          .eq("version", Number(body.version))
          .select()
          .maybeSingle();
        must(error);
        if (!data) throw new Error("post_conflict");
        return json(req, 200, { post: data });
      }
      const { data, error } = await ctx.db
        .from("social_posts")
        .insert({
          campaign_id: campaign.id,
          user_id: ctx.user.id,
          organization_id: ctx.org,
          channel,
          copy,
          attachment_id: mediaId as string | null,
        })
        .select()
        .single();
      if (error?.code === "23505") throw new Error("post_conflict");
      must(error);
      return json(req, 200, { post: data });
    }
    if (action === "disconnect") {
      if (!uuid(body.accountId)) throw new Error("account_invalid");
      const { data: account, error: lookupError } = await ctx.db
        .from("social_accounts")
        .select()
        .eq("id", body.accountId)
        .eq("user_id", ctx.user.id)
        .eq("organization_id", ctx.org)
        .maybeSingle();
      must(lookupError);
      if (!account) throw new Error("account_invalid");
      const { error } = await ctx.db
        .from("social_credentials")
        .delete()
        .eq("account_id", account.id);
      must(error);
      const result = await ctx.db
        .from("social_accounts")
        .update({ expires_at: new Date(0).toISOString() })
        .eq("id", account.id)
        .eq("user_id", ctx.user.id);
      must(result.error);
      return json(req, 200, { ok: true });
    }
    if (action === "creator") {
      const { token } = await loadAccount(ctx, body.accountId, "tiktok");
      return json(req, 200, { creator: await creatorInfo(token) });
    }
    const post = await loadPost(ctx, body.postId);
    if (action === "publish") {
      const options = body.options as PublishOptions;
      if (!options?.consent) throw new Error("consent_required");
      const { data: subscription } = await ctx.service
        .from("subscriptions")
        .select("status")
        .eq("organization_id", ctx.org)
        .in("status", ["active", "trialing"])
        .maybeSingle();
      if (!subscription) throw new Error("subscription_inactive");
      const { account, token } = await loadAccount(
          ctx,
          options.accountId,
          post.channel,
        ),
        campaign = await loadCampaign(ctx, post.campaign_id);
      const media = campaign.attachments.find(
        (m) => m.id === post.attachment_id,
      );
      const issues = publicationIssues(post.channel, post.copy, media);
      if (issues.length)
        return json(req, 400, {
          error: "invalid_request",
          message: issues.join(" "),
        });
      let blob: Blob | undefined;
      if (media) {
        const { data: signed, error } = await ctx.db.storage
          .from("social-briefs")
          .createSignedUrl(media.path, 3600);
        must(error);
        if (!signed) throw new Error("media_invalid");
        media.url = signed.signedUrl;
        if (post.channel === "linkedin") {
          const download = await ctx.db.storage
            .from("social-briefs")
            .download(media.path);
          must(download.error);
          blob = download.data ?? undefined;
        }
      }
      const { data: claimData, error: claimError } = await ctx.db.rpc(
        "social_claim_publish",
        {
          p_user_id: ctx.user.id,
          p_post_id: post.id,
          p_version: options.expectedVersion,
          p_account_id: account.id,
          p_options: { ...options, attachmentId: post.attachment_id },
        },
      );
      const claimed = Array.isArray(claimData)
        ? (claimData[0] as PostRow | undefined)
        : claimData;
      if (claimError || !claimed) throw new Error("post_conflict");
      try {
        await updateResult(
          ctx,
          claimed,
          await publishToProvider(
            account,
            token,
            claimed.copy,
            options,
            media,
            blob,
          ),
        );
      } catch (error) {
        await markFailure(ctx, claimed, error);
        throw error;
      }
      return json(req, 200, { post: await loadPost(ctx, post.id) });
    }
    if (action === "status") {
      if (
        post.status === "publishing" &&
        Date.now() - Date.parse(post.updated_at) > 120000
      ) {
        // A terminated invocation must never remain a misleading endless spinner.
        await ctx.db
          .from("social_posts")
          .update({
            status: "uncertain",
            error: socialMessages.provider_network_uncertain,
          })
          .eq("id", post.id)
          .eq("status", "publishing")
          .eq("updated_at", post.updated_at);
      } else if (post.status === "processing" && post.provider_job_id) {
        const { account, token } = await loadAccount(
            ctx,
            post.account_id,
            post.channel,
          ),
          result = await readPublicationStatus(
            account,
            token,
            post.provider_job_id,
          );
        if (result.state === "ready") {
          const { data: locked, error } = await ctx.db
            .from("social_posts")
            .update({
              status: "publishing",
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id)
            .eq("status", "processing")
            .select()
            .maybeSingle();
          must(error);
          if (locked) {
            try {
              await updateResult(
                ctx,
                locked,
                await finishInstagram(account, token, post.provider_job_id),
              );
            } catch (error) {
              await markFailure(ctx, locked, error);
              throw error;
            }
          }
        } else if (result.state === "published")
          await updateResult(ctx, post, {
            status: "published",
            remoteId: result.remoteId ?? null,
            remoteUrl: result.remoteUrl ?? null,
            jobId: post.provider_job_id,
          });
        else if (result.state === "failed")
          await ctx.db
            .from("social_posts")
            .update({
              status: "failed",
              error: socialMessages.provider_rejected,
            })
            .eq("id", post.id)
            .eq("status", "processing");
      }
      return json(req, 200, { post: await loadPost(ctx, post.id) });
    }
    if (action === "metrics") {
      if (post.status !== "published" || !post.remote_id)
        throw new Error("invalid_request");
      const { data: cached } = await ctx.db
        .from("social_metric_snapshots")
        .select()
        .eq("post_id", post.id)
        .gt("fetched_at", new Date(Date.now() - 900000).toISOString())
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached) return json(req, 200, { metrics: cached, cached: true });
      const { account, token } = await loadAccount(
          ctx,
          post.account_id,
          post.channel,
        ),
        metrics = await fetchMetrics(account, token, post.id, post.remote_id);
      const { error } = await ctx.db
        .from("social_metric_snapshots")
        .insert({ ...metrics, user_id: ctx.user.id, organization_id: ctx.org });
      must(error);
      return json(req, 200, { metrics, cached: false });
    }
    throw new Error("invalid_request");
  } catch (error) {
    const code =
      error instanceof Error && socialMessages[error.message]
        ? error.message
        : "internal_error";
    return json(
      req,
      code === "unauthorized"
        ? 401
        : code === "internal_error"
          ? 500
          : ["conflict", "post_conflict"].includes(code)
            ? 409
            : code === "rate_limit_exceeded"
              ? 429
              : 400,
      { error: code, message: socialMessages[code] },
    );
  }
});
