import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CHANNELS,
  publicationIssues,
  socialApi,
  type PublishOptions,
  type SocialAccount,
  type SocialAttachment,
  type SocialPost,
  type TikTokCreator,
} from "@/lib/socialClient";
export function PublishDialog({
  post,
  accounts,
  attachments,
  onClose,
  onPublish,
  busy,
}: {
  post: SocialPost;
  accounts: SocialAccount[];
  attachments: SocialAttachment[];
  onClose: () => void;
  onPublish: (options: PublishOptions) => Promise<void>;
  busy: boolean;
}) {
  const eligible = accounts.filter(
    (a) => a.channel === post.channel && a.status === "connected",
  );
  const [accountId, setAccountId] = useState(
    eligible.length === 1 ? eligible[0].id : "",
  );
  const [consent, setConsent] = useState(false),
    [rules, setRules] = useState(false),
    [subreddit, setSubreddit] = useState("");
  const [creator, setCreator] = useState<TikTokCreator | null>(null),
    [creatorError, setCreatorError] = useState("");
  const [privacy, setPrivacy] = useState(""),
    [comments, setComments] = useState(false),
    [duet, setDuet] = useState(false),
    [stitch, setStitch] = useState(false);
  const [ownBrand, setOwnBrand] = useState(false),
    [paid, setPaid] = useState(false),
    [music, setMusic] = useState(false);
  const media = attachments.find((m) => m.id === post.attachment_id),
    issues = publicationIssues(post.channel, post.copy, media);
  useEffect(() => {
    if (post.channel !== "tiktok" || !accountId) return;
    const controller = new AbortController();
    setCreator(null);
    setCreatorError("");
    setPrivacy("");
    socialApi<{ creator: TikTokCreator }>(
      { action: "creator", accountId },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setCreator(result.creator);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setCreatorError(e.message);
      });
    return () => controller.abort();
  }, [accountId, post.channel]);
  const canPublish =
    !!accountId &&
    consent &&
    !issues.length &&
    (post.channel !== "reddit" ||
      (rules && /^[a-zA-Z0-9_]{2,21}$/.test(subreddit))) &&
    (post.channel !== "tiktok" ||
      (!!creator && !!privacy && music && !(paid && privacy === "SELF_ONLY")));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="social-dialog">
        <DialogHeader>
          <DialogTitle>Publicar no {CHANNELS[post.channel].name}</DialogTitle>
          <DialogDescription>
            Confira exatamente o que será enviado. Essa ação publica na conta
            selecionada.
          </DialogDescription>
        </DialogHeader>
        <div className="social-dialog-body">
          <label className="social-field">
            <span>Conta de destino</span>
            <select
              disabled={busy}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setConsent(false);
              }}
            >
              <option value="">Selecione uma conta</option>
              {eligible.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          {!eligible.length && (
            <div className="social-warning">
              Nenhuma conta conectada. Ative a integração em Conexões antes de
              publicar.
            </div>
          )}
          {post.channel === "reddit" && (
            <>
              <label className="social-field">
                <span>Subreddit (sem r/)</span>
                <input
                  value={subreddit}
                  onChange={(e) => setSubreddit(e.target.value)}
                  maxLength={21}
                />
              </label>
              <label className="social-checkbox">
                <input
                  type="checkbox"
                  checked={rules}
                  onChange={(e) => setRules(e.target.checked)}
                />
                Li as regras da comunidade e deixei transparente o vínculo com a
                marca.
              </label>
            </>
          )}
          {post.channel === "tiktok" && (
            <div className="social-publish-settings">
              {creatorError && <p role="alert">{creatorError}</p>}
              {creator ? (
                <>
                  <p>
                    Publicando como <strong>{creator.creator_nickname}</strong>{" "}
                    (@{creator.creator_username}). Limite atual:{" "}
                    {creator.max_video_post_duration_sec}s.
                  </p>
                  <label className="social-field">
                    <span>Quem pode assistir?</span>
                    <select
                      value={privacy}
                      onChange={(e) => setPrivacy(e.target.value)}
                    >
                      <option value="">Escolha a privacidade</option>
                      {creator.privacy_level_options.map((v) => (
                        <option value={v} key={v}>
                          {(
                            {
                              PUBLIC_TO_EVERYONE: "Todos",
                              MUTUAL_FOLLOW_FRIENDS: "Amigos",
                              FOLLOWER_OF_CREATOR: "Seguidores",
                              SELF_ONLY: "Somente eu",
                            } as Record<string, string>
                          )[v] ?? v}
                        </option>
                      ))}
                    </select>
                  </label>
                  {[
                    [
                      "Permitir comentários",
                      comments,
                      setComments,
                      creator.comment_disabled,
                    ],
                    ["Permitir Dueto", duet, setDuet, creator.duet_disabled],
                    [
                      "Permitir Costura",
                      stitch,
                      setStitch,
                      creator.stitch_disabled,
                    ],
                  ].map(([label, value, setter, disabled]) => (
                    <label className="social-checkbox" key={String(label)}>
                      <input
                        type="checkbox"
                        checked={Boolean(value) && !disabled}
                        disabled={Boolean(disabled)}
                        onChange={(e) =>
                          (setter as (v: boolean) => void)(e.target.checked)
                        }
                      />
                      {String(label)}
                    </label>
                  ))}
                  <label className="social-checkbox">
                    <input
                      type="checkbox"
                      checked={ownBrand}
                      onChange={(e) => setOwnBrand(e.target.checked)}
                    />
                    Promove a minha própria marca
                  </label>
                  <label className="social-checkbox">
                    <input
                      type="checkbox"
                      checked={paid}
                      onChange={(e) => setPaid(e.target.checked)}
                    />
                    Parceria paga / promoção de outra marca
                  </label>
                  {(ownBrand || paid) && (
                    <p className="social-help">
                      A publicação será identificada como conteúdo promocional
                      {paid ? " / parceria paga" : ""}.
                    </p>
                  )}
                  {paid && privacy === "SELF_ONLY" && (
                    <p role="alert">
                      Parceria paga não pode usar “Somente eu”.
                    </p>
                  )}
                  <label className="social-checkbox">
                    <input
                      type="checkbox"
                      checked={music}
                      onChange={(e) => setMusic(e.target.checked)}
                    />
                    <span>
                      Li e aceito a{" "}
                      <a
                        href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                        target="_blank"
                        rel="noreferrer"
                      >
                        confirmação de uso de música
                      </a>
                      {paid && (
                        <>
                          {" "}
                          e a{" "}
                          <a
                            href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                            target="_blank"
                            rel="noreferrer"
                          >
                            política de conteúdo de marca
                          </a>
                        </>
                      )}
                    </span>
                  </label>
                </>
              ) : accountId && !creatorError ? (
                <p>Consultando as configurações atuais do criador…</p>
              ) : null}
            </div>
          )}
          <div className="social-publish-preview">
            {post.channel === "reddit" && <strong>{post.copy.title}</strong>}
            <p>{post.copy.text}</p>
            <small>
              {media ? `Mídia: ${media.name}` : "Publicação somente em texto"}
            </small>
          </div>
          {issues.map((issue) => (
            <p className="social-warning" key={issue}>
              {issue}
            </p>
          ))}
          <label className="social-checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Revisei os fatos, tenho os direitos da mídia e autorizo publicar
              este conteúdo nesta conta.
            </span>
          </label>
          <p className="social-help">
            Notas de produção e os demais anexos do briefing não serão
            publicados. Não há reenvio automático em caso de resposta incerta.
          </p>
        </div>
        <div className="social-form-actions">
          <button
            className="social-button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="social-button primary"
            disabled={!canPublish || busy}
            onClick={() =>
              void onPublish({
                accountId,
                expectedVersion: post.version,
                consent,
                subreddit,
                rulesConfirmed: rules,
                privacy,
                allowComments: comments,
                allowDuet: duet,
                allowStitch: stitch,
                ownBrand,
                paidPartnership: paid,
                musicConsent: music,
              })
            }
          >
            <Send size={16} />
            {busy ? "Enviando…" : "Confirmar publicação"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
