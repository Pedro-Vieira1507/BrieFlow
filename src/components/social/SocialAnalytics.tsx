import { BarChart3, RefreshCw } from "lucide-react";
import {
  CHANNELS,
  METRIC_KEYS,
  METRIC_LABELS,
  type SocialMetrics,
  type SocialPost,
} from "@/lib/socialClient";
import { ChannelIcon } from "./BriefEditor";
import { POST_LABELS } from "@/lib/socialClient";
export function SocialAnalytics({
  posts,
  metrics,
  onRefresh,
  busy,
}: {
  posts: SocialPost[];
  metrics: SocialMetrics[];
  onRefresh: (post: SocialPost) => void;
  busy: boolean;
}) {
  return (
    <div>
      <div className="social-info-banner">
        <BarChart3 size={19} />
        <p>
          Resultados reais, por publicação e por rede.{" "}
          <strong>“—” significa não disponível, não zero.</strong> Alcance não é
          somado entre redes: a mesma pessoa pode aparecer em mais de uma.
        </p>
      </div>
      {!posts.length ? (
        <div className="social-empty">
          <BarChart3 size={35} />
          <h2>A história dos resultados começa com um post.</h2>
          <p>
            Gere os textos, conecte uma conta e publique. Os indicadores
            disponíveis aparecerão aqui, com a data da consulta.
          </p>
        </div>
      ) : (
        <div className="social-analytics-grid">
          {posts.map((post) => {
            const snapshot = metrics.find((m) => m.post_id === post.id),
              hasData =
                !!snapshot &&
                Object.values(snapshot.values).some((v) => v !== null);
            return (
              <article className="social-panel" key={post.id}>
                <div className="social-metric-heading">
                  <ChannelIcon channel={post.channel} />
                  <div>
                    <h2>{CHANNELS[post.channel].name}</h2>
                    <span className={`social-status status-${post.status}`}>
                      {POST_LABELS[post.status]}
                    </span>
                  </div>
                  <button
                    className="social-icon-button"
                    aria-label={`Atualizar métricas do ${CHANNELS[post.channel].name}`}
                    disabled={
                      busy || post.status !== "published" || !post.remote_id
                    }
                    onClick={() => onRefresh(post)}
                  >
                    <RefreshCw size={17} />
                  </button>
                </div>
                <div className="social-metrics">
                  {METRIC_KEYS.filter(
                    (key) => key !== "score" || post.channel === "reddit",
                  )
                    .filter(
                      (key) =>
                        post.channel !== "reddit" ||
                        [
                          "score",
                          "comments",
                          "views",
                          "reach",
                          "shares",
                        ].includes(key),
                    )
                    .map((key) => (
                      <div key={key}>
                        <span>{METRIC_LABELS[key]}</span>
                        <strong>
                          {snapshot?.values[key] != null
                            ? snapshot.values[key]!.toLocaleString("pt-BR")
                            : "—"}
                        </strong>
                      </div>
                    ))}
                </div>
                {snapshot ? (
                  <>
                    <p className="social-help">
                      Última consulta:{" "}
                      {new Date(snapshot.fetched_at).toLocaleString("pt-BR")}
                    </p>
                    {snapshot.notes.map((note) => (
                      <p className="social-help" key={note}>
                        {note}
                      </p>
                    ))}
                    {!hasData && (
                      <p className="social-help">
                        A consulta não retornou métricas acessíveis para esta
                        publicação.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="social-help">
                    {post.status === "published"
                      ? post.remote_id
                        ? "Atualize para consultar a rede. Requer permissão de leitura de métricas."
                        : "Publicado sem ID público disponível. As métricas ainda não podem ser consultadas."
                      : "As métricas ficam disponíveis depois que a rede confirmar a publicação."}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      <p className="social-help">
        Atualização sob demanda, com cache de 15 minutos. Não há números
        demonstrativos. Os indicadores têm definições diferentes por plataforma
        e podem chegar com atraso.
      </p>
    </div>
  );
}
