import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckCircle2, FlaskConical, Lightbulb, Lock, RefreshCw, Sparkles } from "lucide-react";
import { z } from "zod";
import { AuthModal } from "@/components/briefflow/AuthModal";
import { Toaster } from "@/components/ui/sonner";
import { useBriefflowStore } from "@/store/briefflow";
import { generateCompletion } from "@/lib/aiClient";
import { socialApi, type SocialCampaign, type SocialMetrics, type SocialPost } from "@/lib/socialClient";
import { useCredits } from "@/hooks/useCredits";

const LearningSchema = z.object({
  summary: z.string().min(1).max(1200),
  evidence: z.array(z.object({
    signal: z.string().min(1).max(500),
    evidence: z.string().min(1).max(800),
    limitation: z.string().min(1).max(500),
  })).max(6),
  experiments: z.array(z.object({
    name: z.string().min(1).max(160),
    change: z.string().min(1).max(700),
    hypothesis: z.string().min(1).max(700),
    primaryMetric: z.string().min(1).max(120),
    guardrail: z.string().min(1).max(500),
    learningValue: z.enum(["alta", "média", "baixa"]),
  })).max(5),
  memoryRules: z.array(z.string().min(1).max(500)).max(6),
  limitations: z.array(z.string().min(1).max(500)).max(6),
});
type Learning = z.infer<typeof LearningSchema>;

function metricsFor(post: SocialPost, metrics: SocialMetrics[]) {
  return metrics.find((metric) => metric.post_id === post.id)?.values ?? {};
}

export function CampaignIntelligence() {
  const user = useBriefflowStore((s) => s.user);
  const setAuthOpen = useBriefflowStore((s) => s.setAuthOpen);
  const credits = useCredits();
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<{ campaign: SocialCampaign; posts: SocialPost[]; metrics: SocialMetrics[] } | null>(null);
  const [learning, setLearning] = useState<Learning | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) ?? null,
    [campaigns, selectedId],
  );

  useEffect(() => {
    if (!user || !credits.plan?.organizationId) return;
    setLoading(true);
    void socialApi<{ campaigns: SocialCampaign[] }>({ action: "list" })
      .then((result) => {
        setCampaigns(result.campaigns);
        if (result.campaigns[0]) setSelectedId((current) => current || result.campaigns[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar as campanhas."))
      .finally(() => setLoading(false));
  }, [user, credits.plan?.organizationId]);

  useEffect(() => {
    if (!selectedId || !user) return;
    setLoading(true);
    void socialApi<{ campaign: SocialCampaign; posts: SocialPost[]; metrics: SocialMetrics[] }>({
      action: "get",
      id: selectedId,
    })
      .then((result) => {
        setSelected(result);
        const saved = (result.campaign.brief as SocialCampaign["brief"] & { learning?: Learning }).learning;
        setLearning(saved ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível abrir a campanha."))
      .finally(() => setLoading(false));
  }, [selectedId, user]);

  const analyze = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const evidence = selected.posts.map((post) => ({
        channel: post.channel,
        status: post.status,
        title: post.copy.title,
        text: post.copy.text,
        productionNotes: post.copy.productionNotes,
        metrics: metricsFor(post, selected.metrics),
      }));
      const result = await generateCompletion({
        action: "discovery",
        stage: "discovery",
        temperature: 0.25,
        maxTokens: 5000,
        schema: LearningSchema,
        system: [
          "Você é o estrategista de aprendizagem do BrieFlow.",
          "Sua função NÃO é prever quem vai ganhar, prometer resultados ou inventar causalidade.",
          "Transforme evidência disponível em hipóteses de marketing testáveis.",
          "Separe explicitamente observação de interpretação. Se houver poucos dados, diga isso.",
          "Nunca trate correlação como causalidade.",
          "Priorize experimentos que mudem uma variável por vez quando isso for possível.",
          "A memória deve ser formulada como regra editorial provisória, nunca como verdade universal.",
          "Responda em português do Brasil.",
        ].join("\n"),
        user: JSON.stringify({
          campaign: selected.campaign.brief,
          publications: evidence,
          request: "Produza um Learning Record: resumo, sinais observados, experimentos seguintes, regras de memória e limitações.",
        }),
      });
      setLearning(result.data);

      const nextBrief = {
        ...selected.campaign.brief,
        learning: {
          ...result.data,
          generatedAt: new Date().toISOString(),
          model: result.meta.model,
        },
      };
      const saved = await socialApi<{ campaign: SocialCampaign }>({
        action: "save_campaign",
        id: selected.campaign.id,
        version: selected.campaign.version,
        brief: nextBrief,
        attachments: selected.campaign.attachments,
      });
      setSelected({ ...selected, campaign: saved.campaign });
      setCampaigns((all) => all.map((campaign) => campaign.id === saved.campaign.id ? saved.campaign : campaign));
      void credits.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "A análise não pôde ser concluída.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <>
        <main className="social-app">
          <section className="social-main">
            <div className="social-content">
              <div className="social-page-heading">
                <div>
                  <span className="social-eyebrow">LEARNING ENGINE</span>
                  <h1>Faça o BrieFlow aprender.</h1>
                  <p>O diferencial não é gerar mais textos. É transformar o que aconteceu depois da publicação em memória para a próxima campanha.</p>
                </div>
                <button className="social-button" onClick={() => setAuthOpen(true)}>
                  Entrar para começar
                </button>
              </div>
              <LearningConcept />
            </div>
          </section>
        </main>
        <AuthModal open={false} onOpenChange={() => setAuthOpen(true)} />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <>
      <main className="social-app">
        <section className="social-main">
          <div className="social-content">
            <div className="social-page-heading">
              <div>
                <span className="social-eyebrow">LEARNING ENGINE</span>
                <h1>O conteúdo que aprende com o mercado.</h1>
                <p>Cada publicação vira evidência. Cada evidência vira uma hipótese. A próxima campanha começa com o que a anterior ensinou.</p>
              </div>
              <button className="social-button" disabled={!selected || busy || loading} onClick={analyze}>
                {busy ? <RefreshCw size={17} className="animate-spin" /> : <BrainCircuit size={17} />}
                {busy ? "Extraindo aprendizados…" : "Analisar campanha"}
              </button>
            </div>

            <div className="social-panel" style={{ marginBottom: 20 }}>
              <label className="social-field social-campaign-select">
                <span>Campanha analisada</span>
                <select value={selectedId} disabled={busy || loading} onChange={(event) => setSelectedId(event.target.value)}>
                  <option value="">Selecione uma campanha</option>
                  {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.brief.name}</option>)}
                </select>
              </label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
                <span className="social-status status-published"><CheckCircle2 size={14} /> {selected?.posts.length ?? 0} publicações</span>
                <span className="social-status status-draft"><FlaskConical size={14} /> {selected?.metrics.length ?? 0} sinais de performance</span>
                <span className="social-status status-draft"><Sparkles size={14} /> Memória persistente</span>
              </div>
            </div>

            {!selected && !loading && <LearningConcept />}
            {learning && (
              <div style={{ display: "grid", gap: 18 }}>
                <article className="social-panel">
                  <div className="social-metric-heading"><BrainCircuit size={20} /><div><h2>O que aprendemos</h2><span>Registro gerado a partir das evidências disponíveis</span></div></div>
                  <p style={{ fontSize: 17, lineHeight: 1.7 }}>{learning.summary}</p>
                </article>

                <div className="social-analytics-grid">
                  {learning.evidence.map((item, index) => (
                    <article className="social-panel" key={index}>
                      <span className="social-eyebrow">SINAL {index + 1}</span>
                      <h2>{item.signal}</h2>
                      <p><strong>Evidência:</strong> {item.evidence}</p>
                      <p className="social-help"><strong>Limitação:</strong> {item.limitation}</p>
                    </article>
                  ))}
                </div>

                <article className="social-panel">
                  <div className="social-metric-heading"><FlaskConical size={20} /><div><h2>Próximos experimentos</h2><span>Hipóteses, não previsões</span></div></div>
                  <div className="social-analytics-grid">
                    {learning.experiments.map((experiment, index) => (
                      <div className="social-panel" key={index}>
                        <span className="social-eyebrow">EXPERIMENTO {index + 1} · VALOR DE APRENDIZADO {experiment.learningValue.toUpperCase()}</span>
                        <h3>{experiment.name}</h3>
                        <p><strong>Mudar:</strong> {experiment.change}</p>
                        <p><strong>Hipótese:</strong> {experiment.hypothesis}</p>
                        <p><strong>Métrica primária:</strong> {experiment.primaryMetric}</p>
                        <p className="social-help"><strong>Guardrail:</strong> {experiment.guardrail}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="social-panel">
                  <div className="social-metric-heading"><Lightbulb size={20} /><div><h2>Memória da marca</h2><span>Regras provisórias que podem orientar a próxima geração</span></div></div>
                  <ul>
                    {learning.memoryRules.map((rule, index) => <li key={index} style={{ marginBottom: 10 }}>{rule}</li>)}
                  </ul>
                  <p className="social-help">A memória nunca substitui revisão humana. Ela deve ser confirmada ou descartada quando novas evidências aparecerem.</p>
                </article>

                <article className="social-panel">
                  <div className="social-metric-heading"><Lock size={20} /><div><h2>Limites da análise</h2><span>O BrieFlow não transforma correlação em certeza</span></div></div>
                  <ul>
                    {learning.limitations.map((limitation, index) => <li key={index} style={{ marginBottom: 10 }}>{limitation}</li>)}
                  </ul>
                </article>
              </div>
            )}
            {error && <p className="social-help" role="alert">{error}</p>}
          </div>
        </section>
      </main>
      <Toaster richColors position="top-right" />
    </>
  );
}

function LearningConcept() {
  return (
    <div className="social-analytics-grid">
      {[
        ["1", "Hipótese", "Antes de gerar, o BrieFlow registra o que a campanha está tentando mudar."],
        ["2", "Evidência", "Depois da publicação, métricas reais são ligadas ao conteúdo que as produziu."],
        ["3", "Aprendizado", "A IA separa sinais, limitações e interpretações — sem fingir causalidade."],
        ["4", "Próximo teste", "O resultado vira um experimento controlado para a próxima campanha."],
      ].map(([number, title, text]) => (
        <article className="social-panel" key={number}>
          <span className="social-eyebrow">0{number}</span>
          <h2>{title}</h2>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}
