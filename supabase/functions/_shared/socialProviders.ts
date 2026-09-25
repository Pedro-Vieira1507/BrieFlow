import {
  CHANNELS,
  CHANNEL_IDS,
  emptyMetrics,
  type ChannelReadiness,
  type MetricKey,
  type PublishOptions,
  type SocialAccount,
  type SocialAttachment,
  type SocialChannel,
  type SocialCopy,
  type SocialMetrics,
  type TikTokCreator,
} from "./social.ts";

export const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const string = (v: unknown): string => (typeof v === "string" ? v : "");
const env = (key: string): string => Deno.env.get(key)?.trim() ?? "";
export function socialKey(): string {
  const value = env("SOCIAL_TOKEN_ENCRYPTION_KEY");
  if (!value) throw new Error("encryption_not_configured");
  return value;
}
const prefix = (channel: SocialChannel): string =>
  `SOCIAL_${channel.toUpperCase()}`;
const graphVersion = (): string => {
  const v = env("SOCIAL_META_API_VERSION");
  if (!/^v\d+\.\d+$/.test(v)) throw new Error("provider_not_configured");
  return v;
};
export const graph = (channel: "facebook" | "instagram"): string =>
  `https://graph.${channel}.com/${graphVersion()}`;
const linkedHeaders = (): Record<string, string> => ({
  "LinkedIn-Version": env("SOCIAL_LINKEDIN_API_VERSION") || "202607",
  "X-Restli-Protocol-Version": "2.0.0",
});
export function readiness(): ChannelReadiness[] {
  return CHANNEL_IDS.map((channel) => {
    const p = prefix(channel);
    const configured = Boolean(
      env("SOCIAL_TOKEN_ENCRYPTION_KEY") &&
      env("APP_URL") &&
      env(`${p}_CLIENT_ID`) &&
      env(`${p}_CLIENT_SECRET`) &&
      env(`${p}_ENABLED`) === "true" &&
      (!["facebook", "instagram"].includes(channel) ||
        /^v\d+\.\d+$/.test(env("SOCIAL_META_API_VERSION"))) &&
      (channel !== "reddit" || env("SOCIAL_REDDIT_USER_AGENT")) &&
      (channel !== "tiktok" || env("SOCIAL_TIKTOK_MEDIA_PREFIX")),
    );
    return {
      channel,
      configured,
      reason: configured
        ? CHANNELS[channel].requirement
        : "Ativação pendente: credenciais do aplicativo, permissões e validação da integração.",
    };
  });
}
export class ProviderError extends Error {
  readonly code: string;
  readonly uncertain: boolean;
  constructor(code: string, uncertain = false) {
    super(code);
    this.code = code;
    this.uncertain = uncertain;
  }
}
/** Provider bodies can contain tokens; never log or return them as errors. No automatic write retry. */
export async function api(
  url: string,
  token: string | null,
  init: RequestInit = {},
): Promise<{ body: Record<string, unknown>; response: Response }> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(25000),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ProviderError(
      "provider_network_uncertain",
      (init.method ?? "GET") !== "GET",
    );
  }
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? object(JSON.parse(raw)) : {};
  } catch {
    if (raw)
      throw new ProviderError(
        "provider_invalid_response",
        (init.method ?? "GET") !== "GET",
      );
  }
  if (!response.ok)
    throw new ProviderError(
      response.status === 401 || response.status === 403
        ? "provider_permission_required"
        : response.status === 429
          ? "provider_rate_limited"
          : "provider_rejected",
      response.status >= 500 && (init.method ?? "GET") !== "GET",
    );
  const error = object(body.error);
  if (error.code && error.code !== "ok")
    throw new ProviderError("provider_rejected");
  if (list(object(body.json).errors).length)
    throw new ProviderError("provider_rejected");
  return { body, response };
}
const jsonPost = (
  body: unknown,
  headers: Record<string, string> = {},
): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});
const formPost = (
  body: Record<string, string>,
  headers: Record<string, string> = {},
): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
  body: new URLSearchParams(body).toString(),
});
export function callbackUrl(): string {
  return `${env("SUPABASE_URL")}/functions/v1/social-oauth`;
}
export async function authorizationUrl(
  channel: SocialChannel,
  state: string,
  challenge: string,
): Promise<string> {
  if (!readiness().find((c) => c.channel === channel)?.configured)
    throw new Error("provider_not_configured");
  const id = env(`${prefix(channel)}_CLIENT_ID`);
  const endpoints: Record<SocialChannel, string> = {
    linkedin: "https://www.linkedin.com/oauth/v2/authorization",
    instagram: "https://www.instagram.com/oauth/authorize",
    facebook:
      channel === "facebook"
        ? `https://www.facebook.com/${graphVersion()}/dialog/oauth`
        : "",
    x: "https://x.com/i/oauth2/authorize",
    tiktok: "https://www.tiktok.com/v2/auth/authorize/",
    reddit: "https://www.reddit.com/api/v1/authorize",
  };
  const scopes: Record<SocialChannel, string> = {
    linkedin: `openid profile w_member_social${env("SOCIAL_LINKEDIN_ANALYTICS") === "true" ? " r_member_postAnalytics" : ""}`,
    instagram:
      "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights",
    facebook:
      "pages_show_list,pages_read_engagement,pages_manage_posts,read_insights",
    x: "tweet.read tweet.write users.read",
    tiktok: "user.info.basic,video.publish,video.list",
    reddit: "identity read submit",
  };
  const url = new URL(endpoints[channel]);
  url.search = new URLSearchParams({
    [channel === "tiktok" ? "client_key" : "client_id"]: id,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: scopes[channel],
    state,
  }).toString();
  if (channel === "x") {
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}
export interface ConnectedIdentity {
  externalId: string;
  label: string;
  token: string;
  expiresAt: string | null;
}
export async function exchangeCode(
  channel: SocialChannel,
  code: string,
  verifier: string,
): Promise<ConnectedIdentity[]> {
  const id = env(`${prefix(channel)}_CLIENT_ID`),
    secret = env(`${prefix(channel)}_CLIENT_SECRET`);
  const base = {
    client_id: id,
    client_secret: secret,
    redirect_uri: callbackUrl(),
    code,
    grant_type: "authorization_code",
  };
  let data: Record<string, unknown>;
  if (channel === "linkedin")
    data = (
      await api(
        "https://www.linkedin.com/oauth/v2/accessToken",
        null,
        formPost(base),
      )
    ).body;
  else if (channel === "instagram")
    data = (
      await api(
        "https://api.instagram.com/oauth/access_token",
        null,
        formPost(base),
      )
    ).body;
  else if (channel === "facebook")
    data = (
      await api(`${graph("facebook")}/oauth/access_token`, null, formPost(base))
    ).body;
  else if (channel === "x")
    data = (
      await api(
        "https://api.x.com/2/oauth2/token",
        null,
        formPost(
          {
            grant_type: "authorization_code",
            code,
            redirect_uri: callbackUrl(),
            code_verifier: verifier,
            client_id: id,
          },
          { Authorization: `Basic ${btoa(`${id}:${secret}`)}` },
        ),
      )
    ).body;
  else if (channel === "tiktok")
    data = (
      await api(
        "https://open.tiktokapis.com/v2/oauth/token/",
        null,
        formPost({
          client_key: id,
          client_secret: secret,
          code,
          grant_type: "authorization_code",
          redirect_uri: callbackUrl(),
        }),
      )
    ).body;
  else
    data = (
      await api(
        "https://www.reddit.com/api/v1/access_token",
        null,
        formPost(
          {
            grant_type: "authorization_code",
            code,
            redirect_uri: callbackUrl(),
          },
          {
            Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
            "User-Agent": env("SOCIAL_REDDIT_USER_AGENT"),
          },
        ),
      )
    ).body;
  if (!data.access_token && list(data.data).length)
    data = object(list(data.data)[0]);
  const token = string(data.access_token);
  if (!token) throw new ProviderError("provider_invalid_token");
  // Short-lived credentials deliberately reconnect instead of silently inventing refresh support.
  const ttl = Number(data.expires_in || (channel === "instagram" ? 3600 : 0));
  const expiresAt =
    ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null;
  if (channel === "linkedin") {
    const info = (await api("https://api.linkedin.com/v2/userinfo", token))
      .body;
    return [
      {
        externalId: `urn:li:person:${string(info.sub)}`,
        label: string(info.name),
        token,
        expiresAt,
      },
    ];
  }
  if (channel === "instagram") {
    const info = (
      await api(`${graph("instagram")}/me?fields=user_id,username`, token)
    ).body;
    return [
      {
        externalId: String(info.user_id || info.id || ""),
        label: string(info.username),
        token,
        expiresAt,
      },
    ];
  }
  if (channel === "facebook") {
    const info = (
      await api(
        `${graph("facebook")}/me/accounts?fields=id,name,access_token,tasks&limit=100`,
        token,
      )
    ).body;
    return list(info.data)
      .map(object)
      .filter(
        (p) =>
          list(p.tasks).includes("CREATE_CONTENT") ||
          list(p.tasks).includes("MANAGE"),
      )
      .map((p) => ({
        externalId: string(p.id),
        label: string(p.name),
        token: string(p.access_token),
        expiresAt,
      }));
  }
  if (channel === "x") {
    const info = object(
      (await api("https://api.x.com/2/users/me", token)).body.data,
    );
    return [
      {
        externalId: string(info.id),
        label: `@${string(info.username)}`,
        token,
        expiresAt,
      },
    ];
  }
  if (channel === "tiktok") {
    const info = object(
      object(
        (
          await api(
            "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
            token,
          )
        ).body.data,
      ).user,
    );
    return [
      {
        externalId: string(info.open_id),
        label: string(info.display_name),
        token,
        expiresAt,
      },
    ];
  }
  const info = (
    await api("https://oauth.reddit.com/api/v1/me", token, {
      headers: { "User-Agent": env("SOCIAL_REDDIT_USER_AGENT") },
    })
  ).body;
  return [
    {
      externalId: string(info.id),
      label: `u/${string(info.name)}`,
      token,
      expiresAt,
    },
  ];
}
export async function creatorInfo(token: string): Promise<TikTokCreator> {
  return object(
    (
      await api(
        "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
        token,
        jsonPost({}),
      )
    ).body.data,
  ) as unknown as TikTokCreator;
}
export interface PublicationResult {
  remoteId: string | null;
  remoteUrl: string | null;
  jobId: string | null;
  status: "processing" | "published";
}
export async function publishToProvider(
  account: SocialAccount,
  token: string,
  copy: SocialCopy,
  options: PublishOptions,
  media?: SocialAttachment,
  mediaBlob?: Blob,
): Promise<PublicationResult> {
  const channel = account.channel;
  let remoteId = "",
    remoteUrl: string | null = null;
  if (channel === "linkedin") {
    let content: unknown;
    if (media && mediaBlob) {
      const upload = object(
        (
          await api(
            "https://api.linkedin.com/rest/images?action=initializeUpload",
            token,
            jsonPost(
              { initializeUploadRequest: { owner: account.external_id } },
              linkedHeaders(),
            ),
          )
        ).body.value,
      );
      const url = new URL(string(upload.uploadUrl));
      if (
        url.protocol !== "https:" ||
        !["www.linkedin.com", "api.linkedin.com"].includes(url.hostname)
      )
        throw new ProviderError("provider_invalid_upload");
      await api(url.toString(), token, {
        method: "PUT",
        body: mediaBlob,
        headers: { "Content-Type": media.mime },
      });
      content = {
        media: {
          id: string(upload.image),
          altText: media.description.slice(0, 4086),
        },
      };
    }
    const result = await api(
      "https://api.linkedin.com/rest/posts",
      token,
      jsonPost(
        {
          author: account.external_id,
          commentary: copy.text,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
          ...(content ? { content } : {}),
        },
        linkedHeaders(),
      ),
    );
    remoteId = result.response.headers.get("x-restli-id") || "";
    remoteUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(remoteId)}/`;
  } else if (channel === "instagram") {
    const container = (
      await api(
        `${graph("instagram")}/${encodeURIComponent(account.external_id)}/media`,
        token,
        formPost({ image_url: media?.url || "", caption: copy.text }),
      )
    ).body;
    const containerId = string(container.id);
    if (!containerId) throw new ProviderError("provider_missing_id", true);
    // Persist before any media_publish call. The status action atomically claims that final write.
    return {
      remoteId: null,
      remoteUrl: null,
      jobId: containerId,
      status: "processing",
    };
  } else if (channel === "facebook") {
    const result = (
      await api(
        `${graph("facebook")}/${encodeURIComponent(account.external_id)}/${media ? "photos" : "feed"}`,
        token,
        formPost(
          media
            ? { url: media.url || "", caption: copy.text, published: "true" }
            : { message: copy.text },
        ),
      )
    ).body;
    remoteId = string(result.post_id || result.id);
    remoteUrl = `https://www.facebook.com/${remoteId}`;
  } else if (channel === "x") {
    const result = object(
      (
        await api(
          "https://api.x.com/2/tweets",
          token,
          jsonPost({ text: copy.text }),
        )
      ).body.data,
    );
    remoteId = string(result.id);
    remoteUrl = `https://x.com/i/status/${remoteId}`;
  } else if (channel === "tiktok") {
    const creator = await creatorInfo(token);
    if (!list(creator.privacy_level_options).includes(options.privacy))
      throw new ProviderError("privacy_required");
    if (
      !media?.duration ||
      media.duration > creator.max_video_post_duration_sec
    )
      throw new ProviderError("video_duration_invalid");
    if (
      !options.musicConsent ||
      (options.paidPartnership && options.privacy === "SELF_ONLY")
    )
      throw new ProviderError("tiktok_consent_required");
    const verifiedPrefix = env("SOCIAL_TIKTOK_MEDIA_PREFIX");
    if (
      !media.url?.startsWith(verifiedPrefix) ||
      !verifiedPrefix.startsWith("https://") ||
      !verifiedPrefix.endsWith("/")
    )
      throw new ProviderError("media_domain_not_verified");
    const result = object(
      (
        await api(
          "https://open.tiktokapis.com/v2/post/publish/video/init/",
          token,
          jsonPost({
            post_info: {
              title: copy.text,
              privacy_level: options.privacy,
              disable_comment:
                creator.comment_disabled || !options.allowComments,
              disable_duet: creator.duet_disabled || !options.allowDuet,
              disable_stitch: creator.stitch_disabled || !options.allowStitch,
              brand_organic_toggle: !!options.ownBrand,
              brand_content_toggle: !!options.paidPartnership,
              is_aigc: false,
            },
            source_info: { source: "PULL_FROM_URL", video_url: media.url },
          }),
        )
      ).body.data,
    );
    const id = string(result.publish_id);
    if (!id) throw new ProviderError("provider_missing_id", true);
    return { remoteId: null, remoteUrl: null, jobId: id, status: "processing" };
  } else {
    if (
      !options.rulesConfirmed ||
      !/^[a-zA-Z0-9_]{2,21}$/.test(options.subreddit || "")
    )
      throw new ProviderError("subreddit_required");
    const result = object(
      object(
        (
          await api(
            "https://oauth.reddit.com/api/submit",
            token,
            formPost(
              {
                api_type: "json",
                kind: "self",
                sr: options.subreddit!,
                title: copy.title,
                text: copy.text,
                resubmit: "false",
                sendreplies: "true",
              },
              { "User-Agent": env("SOCIAL_REDDIT_USER_AGENT") },
            ),
          )
        ).body.json,
      ).data,
    );
    remoteId = string(result.name);
    remoteUrl = string(result.url);
  }
  if (!remoteId) throw new ProviderError("provider_missing_id", true);
  return { remoteId, remoteUrl, jobId: null, status: "published" };
}
export async function readPublicationStatus(
  account: SocialAccount,
  token: string,
  jobId: string,
): Promise<{
  state: "ready" | "processing" | "published" | "failed";
  remoteId?: string;
  remoteUrl?: string;
}> {
  if (account.channel === "instagram") {
    const info = (
      await api(
        `${graph("instagram")}/${encodeURIComponent(jobId)}?fields=status_code`,
        token,
      )
    ).body;
    return {
      state:
        info.status_code === "FINISHED"
          ? "ready"
          : ["ERROR", "EXPIRED"].includes(string(info.status_code))
            ? "failed"
            : "processing",
    };
  }
  const info = object(
    (
      await api(
        "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
        token,
        jsonPost({ publish_id: jobId }),
      )
    ).body.data,
  );
  const id = String(list(info.publicaly_available_post_id)[0] || "");
  return {
    state:
      info.status === "PUBLISH_COMPLETE"
        ? "published"
        : info.status === "FAILED"
          ? "failed"
          : "processing",
    remoteId: id || undefined,
  };
}
export async function finishInstagram(
  account: SocialAccount,
  token: string,
  jobId: string,
): Promise<PublicationResult> {
  const result = (
    await api(
      `${graph("instagram")}/${encodeURIComponent(account.external_id)}/media_publish`,
      token,
      formPost({ creation_id: jobId }),
    )
  ).body;
  const id = string(result.id);
  if (!id) throw new ProviderError("provider_missing_id", true);
  let url: string | null = null;
  try {
    url =
      string(
        (await api(`${graph("instagram")}/${id}?fields=permalink`, token)).body
          .permalink,
      ) || null;
  } catch {
    /* Publication succeeded; URL enrichment must never mark it failed. */
  }
  return { remoteId: id, remoteUrl: url, jobId, status: "published" };
}
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export function xMetrics(
  raw: Record<string, unknown>,
): ReturnType<typeof emptyMetrics> {
  return {
    ...emptyMetrics(),
    impressions: count(raw.impression_count),
    likes: count(raw.like_count),
    comments: count(raw.reply_count),
    shares: count(raw.retweet_count),
    saves: count(raw.bookmark_count),
  };
}
export async function fetchMetrics(
  account: SocialAccount,
  token: string,
  postId: string,
  remoteId: string,
): Promise<SocialMetrics> {
  const values = emptyMetrics(),
    notes: string[] = [];
  if (account.channel === "x") {
    const result = object(
      (
        await api(
          `https://api.x.com/2/tweets/${encodeURIComponent(remoteId)}?tweet.fields=public_metrics`,
          token,
        )
      ).body.data,
    );
    Object.assign(values, xMetrics(object(result.public_metrics)));
    notes.push(
      "Compartilhamentos = reposts; não inclui citações. Impressões não são alcance único.",
    );
  } else if (account.channel === "tiktok") {
    const result = object(
      list(
        object(
          (
            await api(
              "https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count",
              token,
              jsonPost({ filters: { video_ids: [remoteId] } }),
            )
          ).body.data,
        ).videos,
      )[0],
    );
    values.views = count(result.view_count);
    values.likes = count(result.like_count);
    values.comments = count(result.comment_count);
    values.shares = count(result.share_count);
  } else if (account.channel === "reddit") {
    const result = object(
      object(
        list(
          object(
            (
              await api(
                `https://oauth.reddit.com/api/info?id=${encodeURIComponent(remoteId)}`,
                token,
                { headers: { "User-Agent": env("SOCIAL_REDDIT_USER_AGENT") } },
              )
            ).body.data,
          ).children,
        )[0],
      ).data,
    );
    values.score = count(result.score);
    values.comments = count(result.num_comments);
    notes.push(
      "Reddit fornece votos líquidos, não curtidas. Visualizações, alcance e compartilhamentos não são fornecidos por este endpoint.",
    );
  } else if (account.channel === "linkedin") {
    const mapping: Array<[MetricKey, string]> = [
      ["impressions", "IMPRESSION"],
      ["reach", "MEMBERS_REACHED"],
      ["likes", "REACTION"],
      ["comments", "COMMENT"],
      ["shares", "RESHARE"],
    ];
    for (const [key, metric] of mapping) {
      try {
        const info = (
          await api(
            `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${encodeURIComponent(remoteId)}&queryType=${metric}&aggregation=TOTAL`,
            token,
            { headers: linkedHeaders() },
          )
        ).body;
        values[key] = count(object(list(info.elements)[0]).count);
      } catch {
        notes.push(
          `${metric}: indisponível; verifique a permissão r_member_postAnalytics.`,
        );
      }
    }
  } else if (account.channel === "instagram") {
    for (const [key, metric] of [
      ["views", "views"],
      ["reach", "reach"],
      ["likes", "likes"],
      ["comments", "comments"],
      ["shares", "shares"],
      ["saves", "saved"],
    ] as Array<[MetricKey, string]>) {
      try {
        const info = (
          await api(
            `${graph("instagram")}/${encodeURIComponent(remoteId)}/insights?metric=${metric}`,
            token,
          )
        ).body;
        const item = object(list(info.data)[0]);
        values[key] = count(
          object(list(item.values)[0]).value ?? object(item.total_value).value,
        );
      } catch {
        notes.push(
          `${metric}: não fornecida para esta mídia, versão da API ou permissão.`,
        );
      }
    }
  } else {
    const info = (
      await api(
        `${graph("facebook")}/${encodeURIComponent(remoteId)}?fields=reactions.limit(0).summary(true),comments.limit(0).summary(true),shares`,
        token,
      )
    ).body;
    values.likes = count(object(object(info.reactions).summary).total_count);
    values.comments = count(object(object(info.comments).summary).total_count);
    values.shares = count(object(info.shares).count);
    notes.push(
      "Visualizações e alcance do Facebook não estão disponíveis neste conector. Reações incluem mais que curtidas.",
    );
  }
  return {
    post_id: postId,
    channel: account.channel,
    values,
    notes,
    fetched_at: new Date().toISOString(),
  };
}
