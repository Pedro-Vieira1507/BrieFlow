import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import {
  CHANNELS,
  POST_LABELS,
  copyLength,
  publicationIssues,
  safeHttpUrl,
  type SocialAttachment,
  type SocialCopy,
  type SocialPost,
} from "@/lib/socialClient";
import { supabase } from "@/lib/supabase";
import { ChannelIcon } from "./BriefEditor";
export function MediaPreview({ media }: { media: SocialAttachment }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    setUrl("");
    supabase?.storage
      .from("social-briefs")
      .createSignedUrl(media.path, 900)
      .then(({ data }) => {
        if (active && data) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [media.path]);
  if (!url) return <div className="social-media-placeholder">{media.name}</div>;
  return media.mime === "video/mp4" ? (
    <video
      className="social-media-preview"
      src={url}
      controls
      preload="metadata"
    />
  ) : (
    <img
      className="social-media-preview"
      src={url}
      alt={media.description || media.name}
    />
  );
}
export function PostEditor({
  post,
  attachments,
  onSave,
  onRegenerate,
  onPublish,
  onStatus,
  busy,
}: {
  post: SocialPost;
  attachments: SocialAttachment[];
  onSave: (copy: SocialCopy, mediaId: string | null) => Promise<void>;
  onRegenerate: () => void;
  onPublish: () => void;
  onStatus: () => void;
  busy: boolean;
}) {
  const [copy, setCopy] = useState(post.copy),
    [mediaId, setMediaId] = useState(post.attachment_id),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    setCopy(post.copy);
    setMediaId(post.attachment_id);
  }, [post.id, post.version, post.copy, post.attachment_id]);
  const channel = CHANNELS[post.channel],
    locked = post.status !== "draft",
    dirty =
      JSON.stringify(copy) !== JSON.stringify(post.copy) ||
      mediaId !== post.attachment_id;
  const media = attachments.find((m) => m.id === mediaId),
    issues = publicationIssues(post.channel, copy, media),
    length = copyLength(post.channel, copy.text);
  return (
    <article className="social-post-editor">
      <div className="social-post-heading">
        <div>
          <ChannelIcon channel={post.channel} />
          <div>
            <h2>{channel.name}</h2>
            <p>{channel.voice}</p>
          </div>
        </div>
        <span className={`social-status status-${post.status}`}>
          {POST_LABELS[post.status]}
        </span>
      </div>
      <div className="social-post-columns">
        <div>
          {post.channel === "reddit" && (
            <label className="social-field">
              <span>Título da discussão</span>
              <input
                value={copy.title}
                maxLength={300}
                disabled={locked || busy}
                onChange={(e) => setCopy({ ...copy, title: e.target.value })}
              />
            </label>
          )}
          <label className="social-field">
            <span>
              {post.channel === "tiktok" || post.channel === "instagram"
                ? "Legenda para publicação"
                : "Texto para publicação"}
            </span>
            <textarea
              className="social-copy-textarea"
              value={copy.text}
              disabled={locked || busy}
              onChange={(e) => setCopy({ ...copy, text: e.target.value })}
              rows={14}
            />
          </label>
          <div className="social-text-toolbar">
            <span
              className={length > channel.maxLength ? "social-error-text" : ""}
            >
              {length.toLocaleString("pt-BR")} /{" "}
              {channel.maxLength.toLocaleString("pt-BR")}
              {post.channel === "x"
                ? " · contagem conservadora"
                : " caracteres"}
            </span>
            <button
              className="social-text-button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(copy.text)
                  .then(() => setCopied(true));
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}Copiar texto
            </button>
          </div>
          <label className="social-field">
            <span>Mídia deste post</span>
            <select
              value={mediaId || ""}
              disabled={locked || busy}
              onChange={(e) => setMediaId(e.target.value || null)}
            >
              <option value="">Sem mídia</option>
              {attachments.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <p className="social-help">{channel.requirement}</p>
          <details className="social-details" open={post.channel === "tiktok"}>
            <summary>
              Roteiro e notas de produção <span>Não serão publicados</span>
            </summary>
            <label className="social-field">
              <span className="sr-only">Notas de produção</span>
              <textarea
                value={copy.productionNotes}
                disabled={locked || busy}
                rows={7}
                onChange={(e) =>
                  setCopy({ ...copy, productionNotes: e.target.value })
                }
              />
            </label>
          </details>
          {post.error && (
            <div className="social-warning" role="alert">
              {post.error}
            </div>
          )}
          {!locked && issues.length > 0 && (
            <div className="social-warning">
              <strong>Antes de publicar</strong>
              {issues.map((v) => (
                <p key={v}>{v}</p>
              ))}
            </div>
          )}
          <div className="social-post-actions">
            {!locked ? (
              <>
                <button
                  className="social-button secondary"
                  disabled={busy}
                  onClick={onRegenerate}
                >
                  <RefreshCw size={15} />
                  Reescrever
                </button>
                <button
                  className="social-button secondary"
                  disabled={busy || !dirty}
                  onClick={() => void onSave(copy, mediaId)}
                >
                  Salvar edição
                </button>
                <button
                  className="social-button primary"
                  disabled={busy || dirty || !!issues.length}
                  onClick={onPublish}
                >
                  <Send size={15} />
                  Revisar e publicar
                </button>
              </>
            ) : (
              <>
                {["publishing", "processing"].includes(post.status) && (
                  <button
                    className="social-button primary"
                    disabled={busy}
                    onClick={onStatus}
                  >
                    <RefreshCw size={15} />
                    Consultar publicação
                  </button>
                )}
                {post.remote_url && safeHttpUrl(post.remote_url) && (
                  <a
                    className="social-button secondary"
                    href={post.remote_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={15} />
                    Abrir na rede
                  </a>
                )}
              </>
            )}
          </div>
          {dirty && (
            <p className="social-help">
              Salve suas edições para liberar a revisão de publicação.
            </p>
          )}
        </div>
        <aside className="social-post-preview">
          <span className="social-eyebrow">PRÉVIA DO CONTEÚDO</span>
          <div className="social-preview-card">
            <div className="social-preview-account">
              <ChannelIcon channel={post.channel} />
              <div>
                <strong>Sua marca</strong>
                <span>Prévia ilustrativa · {channel.name}</span>
              </div>
            </div>
            {media && <MediaPreview media={media} />}
            <div className="social-preview-text">
              {post.channel === "reddit" && <h3>{copy.title}</h3>}
              <p>{copy.text}</p>
            </div>
          </div>
          <div className="social-note">
            <Sparkles size={17} />
            <p>
              Uma mensagem feita para esta rede. A aparência final depende do
              aplicativo e do formato aceito pela plataforma.
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}
