import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  FileText,
  Layers,
  Link2,
  Loader2,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AuthModal } from "@/components/briefflow/AuthModal";
import { Toaster } from "@/components/ui/sonner";
import { useBriefflowStore } from "@/store/briefflow";
import { planLabel, useCredits } from "@/hooks/useCredits";
import { invokeEdgeFunction, supabase } from "@/lib/supabase";
import {
  CHANNEL_IDS,
  CHANNELS,
  emptyBrief,
  generateSocialCopy,
  scopeGuard,
  socialApi,
  uploadBriefMedia,
  validateBrief,
  type ChannelReadiness,
  type PublishOptions,
  type SocialAccount,
  type SocialAttachment,
  type SocialBrief,
  type SocialCampaign,
  type SocialChannel,
  type SocialCopy,
  type SocialMetrics,
  type SocialPost,
} from "@/lib/socialClient";
import { BriefEditor, ChannelIcon } from "./BriefEditor";
import { PostEditor } from "./PostEditor";
import { POST_LABELS } from "@/lib/socialClient";
import { PublishDialog } from "./PublishDialog";
import { SocialAnalytics } from "./SocialAnalytics";

type Page =
  "home" | "campaigns" | "brief" | "texts" | "connections" | "analytics";
interface Listing {
  campaigns: SocialCampaign[];
  accounts: SocialAccount[];
  readiness: ChannelReadiness[];
}
interface CampaignDetail {
  campaign: SocialCampaign;
  posts: SocialPost[];
  metrics: SocialMetrics[];
}
const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Não foi possível concluir. Tente novamente.";
export function SocialWorkspace() {
  const user = useBriefflowStore((s) => s.user),
    authOpen = useBriefflowStore((s) => s.authOpen),
    setAuthOpen = useBriefflowStore((s) => s.setAuthOpen);
  const credits = useCredits();
  const [guestBrief, setGuestBrief] = useState<SocialBrief | null>(null);
  useEffect(() => {
    if (user && credits.plan?.organizationId) setGuestBrief(null);
  }, [user, credits.plan?.organizationId]);
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return (
    <>
      <WorkspaceContent
        key={`${user?.id ?? "guest"}:${credits.plan?.organizationId ?? "loading"}`}
        userId={user?.id ?? null}
        email={user?.email ?? null}
        openAuth={() => setAuthOpen(true)}
        credits={credits}
        initialBrief={guestBrief}
        onGuestBrief={setGuestBrief}
      />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <Toaster
        richColors
        theme="light"
        position="top-right"
        offset={{ top: 80 }}
        mobileOffset={{ top: 80 }}
      />
    </>
  );
}
function WorkspaceContent({
  userId,
  email,
  openAuth,
  credits,
  initialBrief,
  onGuestBrief,
}: {
  userId: string | null;
  email: string | null;
  openAuth: () => void;
  credits: ReturnType<typeof useCredits>;
  initialBrief: SocialBrief | null;
  onGuestBrief: (brief: SocialBrief) => void;
}) {
  const [page, setPage] = useState<Page>(initialBrief ? "brief" : "home"),
    [navOpen, setNavOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]),
    [accounts, setAccounts] = useState<SocialAccount[]>([]),
    [connections, setConnections] = useState<ChannelReadiness[]>([]);
  const [campaign, setCampaign] = useState<SocialCampaign | null>(null),
    [brief, setBrief] = useState<SocialBrief>(initialBrief ?? emptyBrief()),
    [attachments, setAttachments] = useState<SocialAttachment[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]),
    [metrics, setMetrics] = useState<SocialMetrics[]>([]),
    [channel, setChannel] = useState<SocialChannel>("linkedin");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState("");
  const [publishPost, setPublishPost] = useState<SocialPost | null>(null),
    [accountOpen, setAccountOpen] = useState(false),
    [search, setSearch] = useState("");
  const mounted = useRef(true),
    work = useRef<AbortController | null>(null),
    busyRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      work.current?.abort();
    };
  }, []);
  const navigate = (next: Page) => {
    if (busyRef.current) return;
    setPage(next);
    setNavOpen(false);
    setError("");
  };
  const requireAccount = () => {
    if (!userId) {
      openAuth();
      return false;
    }
    if (!credits.plan?.organizationId) {
      toast.error("Aguarde seu workspace carregar.");
      return false;
    }
    return true;
  };
  const loadListing = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId || !credits.plan?.organizationId) return;
      const guard = scopeGuard();
      const result = await socialApi<Listing>({ action: "list" }, signal);
      guard();
      if (!mounted.current) return;
      setCampaigns(result.campaigns);
      setAccounts(result.accounts);
      setConnections(result.readiness);
    },
    [userId, credits.plan?.organizationId],
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(!!userId);
    loadListing(controller.signal)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadListing, userId]);
  useEffect(() => {
    const url = new URL(window.location.href),
      result = url.searchParams.get("social_connection");
    if (url.searchParams.get("view") === "connections") setPage("connections");
    if (result) {
      setPage("connections");
      toast[result === "connected" ? "success" : "error"](
        result === "connected"
          ? "Conta conectada. Confira os destinos disponíveis."
          : "A conexão não foi concluída. Confira as permissões do aplicativo.",
      );
      url.searchParams.delete("social_connection");
      url.searchParams.set("view", "connections");
      window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
    }
  }, []);
  const run = async (job: (signal: AbortSignal) => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    work.current = controller;
    try {
      await job(controller.signal);
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) {
        setError(errorText(e));
        toast.error(errorText(e));
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) {
        setBusy(false);
        setProgress("");
      }
      work.current = null;
    }
  };
  const updateCampaign = (saved: SocialCampaign) => {
    setCampaign(saved);
    setBrief(saved.brief);
    setAttachments(saved.attachments);
    setCampaigns((all) => [saved, ...all.filter((c) => c.id !== saved.id)]);
  };
  const saveBrief = async (signal?: AbortSignal): Promise<SocialCampaign> => {
    const issues = validateBrief(brief);
    if (issues.length) throw new Error(issues.join(" "));
    const guard = scopeGuard();
    const result = await socialApi<{ campaign: SocialCampaign }>(
      {
        action: "save_campaign",
        id: campaign?.id,
        version: campaign?.version,
        brief,
        attachments,
      },
      signal,
    );
    guard();
    if (!mounted.current) throw new Error("Sessão encerrada.");
    updateCampaign(result.campaign);
    return result.campaign;
  };
  const updatePost = (post: SocialPost) =>
    setPosts((all) => [...all.filter((p) => p.id !== post.id), post]);
  const openCampaign = (id: string, target: Page = "texts") => {
    if (!requireAccount()) return;
    void run(async (signal) => {
      const guard = scopeGuard();
      const result = await socialApi<CampaignDetail>(
        { action: "get", id },
        signal,
      );
      guard();
      updateCampaign(result.campaign);
      setPosts(result.posts);
      setMetrics(result.metrics);
      setChannel(result.posts[0]?.channel ?? result.campaign.brief.channels[0]);
      setPage(target);
    });
  };
  const newCampaign = () => {
    if (busy) return;
    if (
      campaign === null &&
      brief.name &&
      !window.confirm("Descartar o briefing não salvo e começar outro?")
    )
      return;
    setCampaign(null);
    setBrief(emptyBrief());
    setAttachments([]);
    setPosts([]);
    setMetrics([]);
    navigate("brief");
  };
  const generate = (only?: SocialChannel) => {
    if (!requireAccount()) return;
    if (
      only &&
      posts.some((p) => p.channel === only) &&
      !window.confirm(
        `Substituir o rascunho de ${CHANNELS[only].name}? Isso usa 2 créditos.`,
      )
    )
      return;
    void run(async (signal) => {
      const guard = scopeGuard(),
        saved = await saveBrief(signal),
        targets = only
          ? [only]
          : saved.brief.channels.filter(
              (c) => !posts.some((p) => p.channel === c),
            );
      if (!targets.length) {
        setPage("texts");
        toast.info(
          "Os textos já foram gerados. Use Reescrever para criar uma nova versão.",
        );
        return;
      }
      setPage("texts");
      setChannel(targets[0]);
      let count = 0;
      for (const target of targets) {
        guard();
        if (signal.aborted) break;
        const existing = posts.find((p) => p.channel === target);
        if (existing && existing.status !== "draft") continue;
        setProgress(
          `Escrevendo para ${CHANNELS[target].name} · ${count + 1}/${targets.length}`,
        );
        const copy = await generateSocialCopy(
          saved.brief,
          target,
          saved.attachments,
          signal,
        );
        guard();
        if (signal.aborted) break;
        const defaultMedia = saved.attachments.find((m) =>
          target === "instagram"
            ? m.mime === "image/jpeg"
            : target === "tiktok"
              ? m.mime === "video/mp4"
              : false,
        );
        const result = await socialApi<{ post: SocialPost }>(
          {
            action: "save_post",
            campaignId: saved.id,
            channel: target,
            copy,
            id: existing?.id,
            version: existing?.version,
            attachmentId: existing?.attachment_id ?? defaultMedia?.id ?? null,
          },
          signal,
        );
        guard();
        updatePost(result.post);
        count++;
        void credits.refresh();
      }
      if (count)
        toast.success(
          `${count} texto${count > 1 ? "s" : ""} salvo${count > 1 ? "s" : ""}. Revise antes de publicar.`,
        );
    });
  };
  const saveCopy = async (
    post: SocialPost,
    copy: SocialCopy,
    mediaId: string | null,
  ) => {
    await run(async (signal) => {
      const guard = scopeGuard();
      const result = await socialApi<{ post: SocialPost }>(
        {
          action: "save_post",
          campaignId: post.campaign_id,
          id: post.id,
          version: post.version,
          channel: post.channel,
          copy,
          attachmentId: mediaId,
        },
        signal,
      );
      guard();
      updatePost(result.post);
      toast.success("Texto salvo.");
    });
  };
  const upload = (files: FileList) => {
    if (!requireAccount()) return;
    void run(async (signal) => {
      if (files.length + attachments.length > 12)
        throw new Error("O briefing aceita até 12 anexos.");
      const guard = scopeGuard();
      let saved = await saveBrief(signal);
      for (const file of Array.from(files)) {
        setProgress(`Anexando ${file.name}…`);
        const media = await uploadBriefMedia(file, saved.id);
        guard();
        const result = await socialApi<{ campaign: SocialCampaign }>(
          {
            action: "save_campaign",
            id: saved.id,
            version: saved.version,
            brief: saved.brief,
            attachments: [...saved.attachments, media],
          },
          signal,
        );
        guard();
        saved = result.campaign;
        updateCampaign(saved);
      }
      toast.success(
        "Anexos salvos. Adicione uma descrição para orientar os textos.",
      );
    });
  };
  const publish = async (options: PublishOptions) => {
    if (!publishPost) return;
    await run(async (signal) => {
      const guard = scopeGuard();
      try {
        const result = await socialApi<{ post: SocialPost }>(
          { action: "publish", postId: publishPost.id, options },
          signal,
        );
        guard();
        updatePost(result.post);
        setPublishPost(null);
        toast.success(
          result.post.status === "published"
            ? "A rede confirmou a publicação."
            : "Mídia enviada. Consulte o processamento para concluir.",
        );
      } catch (e) {
        guard();
        const detail = await socialApi<CampaignDetail>(
          { action: "get", id: publishPost.campaign_id },
          signal,
        );
        guard();
        setPosts(detail.posts);
        setPublishPost(null);
        throw e;
      }
    });
  };
  const pollPost = (post: SocialPost) => {
    void run(async (signal) => {
      const guard = scopeGuard();
      const result = await socialApi<{ post: SocialPost }>(
        { action: "status", postId: post.id },
        signal,
      );
      guard();
      updatePost(result.post);
      toast.info(POST_LABELS[result.post.status]);
    });
  };
  const refreshMetrics = (post: SocialPost) => {
    void run(async (signal) => {
      const guard = scopeGuard();
      const result = await socialApi<{
        metrics: SocialMetrics;
        cached: boolean;
      }>({ action: "metrics", postId: post.id }, signal);
      guard();
      setMetrics((all) => [
        result.metrics,
        ...all.filter((m) => m.post_id !== post.id),
      ]);
      toast.success(
        result.cached
          ? "Consulta recente reutilizada (cache de 15 minutos)."
          : "Métricas consultadas na rede.",
      );
    });
  };
  const connect = (c: SocialChannel) => {
    if (!requireAccount()) return;
    void run(async () => {
      const guard = scopeGuard();
      const result = await invokeEdgeFunction<{ url: string }>("social-oauth", {
        channel: c,
      });
      guard();
      window.location.assign(result.url);
    });
  };
  const exportText = () => {
    const content = posts
      .map(
        (p) =>
          `# ${CHANNELS[p.channel].name}\n${p.copy.title}\n\n${p.copy.text}\n\nNotas de produção (não publicar):\n${p.copy.productionNotes}`,
      )
      .join("\n\n---\n\n");
    const url = URL.createObjectURL(
        new Blob([content], { type: "text/plain;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "brieflow-textos.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const activePost = posts.find((p) => p.channel === channel),
    connectedCount = accounts.filter((a) => a.status === "connected").length;
  const navigation = [
    { id: "home" as Page, label: "Visão geral", icon: Layers },
    { id: "campaigns" as Page, label: "Campanhas", icon: FileText },
    { id: "analytics" as Page, label: "Desempenho", icon: BarChart3 },
    { id: "connections" as Page, label: "Conexões", icon: Link2 },
  ];
  const title =
    page === "home"
      ? "Visão geral"
      : page === "campaigns"
        ? "Suas campanhas"
        : page === "connections"
          ? "Conexões"
          : page === "analytics"
            ? "Desempenho"
            : campaign
              ? campaign.brief.name
              : "Nova campanha";
  return (
    <main className="social-app">
      <aside className={`social-sidebar ${navOpen ? "open" : ""}`}>
        <button
          className="social-logo"
          onClick={() => navigate("home")}
          aria-label="BrieFlow início"
        >
          <span className="social-logo-mark">
            <Layers size={22} />
          </span>
          <span>
            brieflow<span className="social-logo-dot">.</span>
          </span>
        </button>
        <span className="social-sidebar-label">SEU WORKSPACE</span>
        <nav aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              disabled={busy}
              className={
                page === id ||
                (id === "campaigns" && ["brief", "texts"].includes(page))
                  ? "active"
                  : ""
              }
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "campaigns" && campaigns.length > 0 && (
                <small>{campaigns.length}</small>
              )}
              {id === "connections" && (
                <span
                  className={`social-nav-dot ${connectedCount ? "connected" : ""}`}
                />
              )}
            </button>
          ))}
        </nav>
        <button
          className="social-button sidebar-create"
          disabled={busy}
          onClick={newCampaign}
        >
          <Plus size={17} />
          Nova campanha
        </button>
        <div className="social-sidebar-bottom">
          <div className="social-credit-box">
            <div>
              <Sparkles size={15} />
              <span>Seu espaço de criação</span>
            </div>
            <strong>
              {userId
                ? credits.plan
                  ? `${credits.plan.creditsRemaining} créditos`
                  : "Carregando…"
                : "Uma ideia, seis vozes."}
            </strong>
            <p>
              {userId
                ? `${planLabel(credits.plan?.plan ?? "free")} · 2 créditos por texto`
                : "Texto com intenção. Conteúdo com contexto."}
            </p>
          </div>
          <button
            className="social-user"
            onClick={() => (userId ? setAccountOpen(!accountOpen) : openAuth())}
          >
            <span>{email?.slice(0, 1).toUpperCase() || "B"}</span>
            <div>
              <strong>{email?.split("@")[0] || "Seu workspace"}</strong>
              <small>
                {userId ? "Gerenciar conta" : "Entrar ou criar conta"}
              </small>
            </div>
            <Settings2 size={16} />
          </button>
          {accountOpen && (
            <div className="social-account-menu">
              <p>{email}</p>
              <p>Plano: {planLabel(credits.plan?.plan ?? "free")}</p>
              <button
                onClick={() => {
                  void supabase?.auth.signOut();
                }}
              >
                <LogOut size={15} />
                Sair da conta
              </button>
            </div>
          )}
        </div>
      </aside>
      {navOpen && (
        <button
          className="social-nav-backdrop"
          aria-label="Fechar menu"
          onClick={() => setNavOpen(false)}
        />
      )}
      <section className="social-main">
        <header className="social-topbar">
          <div>
            <button
              className="social-icon-button social-mobile-menu"
              aria-label={navOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setNavOpen(!navOpen)}
            >
              {navOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="social-breadcrumb">
              Workspace <ChevronRight size={13} />
            </span>
            <strong>{title}</strong>
          </div>
          <div>
            <span className="social-text-only">
              <span />
              IA de texto
            </span>
            {userId ? (
              <span className="social-top-avatar">
                {email?.[0].toUpperCase() || "B"}
              </span>
            ) : (
              <button
                className="social-button secondary small"
                onClick={openAuth}
              >
                Entrar
              </button>
            )}
          </div>
        </header>
        <div className="social-content">
          {error && (
            <div className="social-error-banner" role="alert">
              <p>{error}</p>
              <button
                className="social-text-button"
                onClick={() => void run(() => loadListing())}
              >
                <RefreshCw size={14} />
                Recarregar
              </button>
            </div>
          )}
          {progress && (
            <div className="social-progress" role="status">
              <Loader2 className="animate-spin" size={16} />
              {progress}
              <span>Você pode continuar assim que terminar.</span>
            </div>
          )}
          {page === "home" && (
            <>
              <div className="social-welcome">
                <div>
                  <span className="social-eyebrow">
                    CONTEÚDO CERTO. NO LUGAR CERTO.
                  </span>
                  <h1>
                    Uma ideia.
                    <br />
                    Seis boas <em>conversas.</em>
                  </h1>
                  <p>
                    Do briefing ao post, com uma voz para cada rede.
                    <br className="social-desktop-break" /> Crie os textos,
                    publique com intenção e acompanhe os resultados.
                  </p>
                  <button
                    className="social-button primary"
                    onClick={newCampaign}
                  >
                    <Plus size={17} />
                    Criar minha campanha
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="social-hero-composition" aria-hidden="true">
                  <div className="social-hero-label">
                    <Sparkles size={13} /> SUA IDEIA, BEM CONTADA
                  </div>
                  <div className="social-hero-card">
                    <div>
                      <span className="social-hero-avatar">b.</span>
                      <strong>Um briefing que conecta</strong>
                      <span>↗</span>
                    </div>
                    <p>
                      A sua mensagem merece
                      <br />
                      <em>o contexto certo.</em>
                    </p>
                    <div className="social-hero-lines">
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="social-hero-tag">
                      100% texto. 100% da sua marca.
                    </span>
                  </div>
                  <div className="social-hero-channels">
                    {CHANNEL_IDS.map((c) => (
                      <ChannelIcon channel={c} key={c} />
                    ))}
                  </div>
                  <span className="social-hero-caption">
                    Cada plataforma, uma nova perspectiva.
                  </span>
                </div>
              </div>
              <div className="social-overview-stats">
                <div>
                  <span>
                    <FileText size={16} />
                    Campanhas salvas
                  </span>
                  <strong>{userId ? campaigns.length : "—"}</strong>
                  <small>Seus briefings em um só lugar</small>
                </div>
                <div>
                  <span>
                    <Link2 size={16} />
                    Contas conectadas
                  </span>
                  <strong>
                    {userId ? connectedCount : "—"}
                    <small> em 6 redes</small>
                  </strong>
                  <small>Publicação com autorização</small>
                </div>
                <div>
                  <span>
                    <ShieldCheck size={16} />
                    Você tem a palavra final
                  </span>
                  <strong className="social-stat-text">
                    Revisão antes do envio
                  </strong>
                  <small>Nenhum post é publicado sem confirmar</small>
                </div>
              </div>
              <div className="social-section-title">
                <div>
                  <h2>Seu próximo post começa aqui</h2>
                  <p>
                    Um fluxo simples para manter a sua mensagem em movimento.
                  </p>
                </div>
                <span className="social-muted-tag">
                  FEITO PARA A SUA ROTINA
                </span>
              </div>
              <div className="social-workflow-cards">
                {[
                  {
                    n: "01",
                    title: "Dê contexto à ideia",
                    text: "Objetivo, público, fatos e mídia. Tudo o que a marca tem a dizer.",
                    icon: FileText,
                  },
                  {
                    n: "02",
                    title: "Encontre a voz de cada rede",
                    text: "Textos, legendas e roteiros que respeitam a cultura de cada canal.",
                    icon: Sparkles,
                  },
                  {
                    n: "03",
                    title: "Publique. Aprenda. Evolua.",
                    text: "Confirme o conteúdo e acompanhe os indicadores que cada rede oferece.",
                    icon: BarChart3,
                  },
                ].map(({ n, title, text, icon: Icon }) => (
                  <div key={n}>
                    <div>
                      <Icon size={20} />
                      <span>{n}</span>
                    </div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
              <div className="social-section-title">
                <h2>Campanhas recentes</h2>
                <button
                  className="social-text-button"
                  onClick={() => navigate("campaigns")}
                >
                  Ver todas
                  <ArrowRight size={14} />
                </button>
              </div>
              {campaigns.length ? (
                <CampaignList
                  campaigns={campaigns.slice(0, 3)}
                  onOpen={openCampaign}
                />
              ) : (
                <div className="social-recent-empty">
                  <span>
                    <FileText size={20} />
                  </span>
                  <div>
                    <strong>
                      {loading
                        ? "Carregando suas campanhas…"
                        : "Um espaço esperando a sua primeira ideia."}
                    </strong>
                    <p>Seu primeiro briefing vai aparecer aqui.</p>
                  </div>
                  <button className="social-text-button" onClick={newCampaign}>
                    Começar
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}
          {page === "campaigns" && (
            <>
              <PageHeading
                eyebrow="DA IDEIA À PUBLICAÇÃO"
                title="Campanhas com propósito."
                description="Briefings, textos e resultados organizados por campanha."
                action={
                  <button
                    className="social-button primary"
                    onClick={newCampaign}
                  >
                    <Plus size={17} />
                    Nova campanha
                  </button>
                }
              />
              <label className="social-field social-search">
                <span className="sr-only">Buscar campanhas</span>
                <input
                  placeholder="Buscar por campanha ou marca…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {campaigns.length ? (
                <CampaignList
                  campaigns={campaigns.filter((c) =>
                    `${c.brief.name} ${c.brief.brand}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )}
                  onOpen={openCampaign}
                />
              ) : (
                <div className="social-empty">
                  <FileText size={34} />
                  <h2>A próxima boa conversa começa com você.</h2>
                  <p>
                    Crie um briefing para transformar a sua ideia em conteúdo
                    específico para cada rede.
                  </p>
                  <button
                    className="social-button primary"
                    onClick={newCampaign}
                  >
                    Criar campanha
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <p className="social-help">
                Exibindo até 100 campanhas recentes deste workspace. Campanhas
                da antiga versão gráfica permanecem preservadas e não são
                convertidas automaticamente.
              </p>
            </>
          )}
          {(page === "brief" || page === "texts") && (
            <>
              <div className="social-campaign-title">
                <button
                  className="social-text-button"
                  disabled={busy}
                  onClick={() => navigate("campaigns")}
                >
                  <ArrowLeft size={15} />
                  Campanhas
                </button>
                <h1>
                  {campaign
                    ? campaign.brief.name
                    : "Vamos dar contexto à sua ideia."}
                </h1>
                <p>
                  {campaign
                    ? `${campaign.brief.brand} · ${campaign.brief.objective}`
                    : "O BrieFlow escreve. A estratégia e a palavra final são suas."}
                </p>
              </div>
              <div className="social-campaign-tabs">
                <button
                  disabled={busy}
                  className={page === "brief" ? "active" : ""}
                  onClick={() => setPage("brief")}
                >
                  01 <span>Briefing</span>
                </button>
                <button
                  disabled={busy || !campaign}
                  className={page === "texts" ? "active" : ""}
                  onClick={() => setPage("texts")}
                >
                  02 <span>Textos por rede</span>
                  <small>{posts.length}</small>
                </button>
                <button
                  disabled={busy || !campaign}
                  onClick={() => setPage("analytics")}
                >
                  03 <span>Desempenho</span>
                </button>
              </div>
              {page === "brief" ? (
                <BriefEditor
                  brief={brief}
                  attachments={attachments}
                  onChange={(value) => {
                    setBrief(value);
                    if (!userId) onGuestBrief(value);
                  }}
                  onAttachments={setAttachments}
                  onUpload={upload}
                  busy={busy}
                  onGenerate={() => generate()}
                  onSave={() => {
                    if (requireAccount())
                      void run(async (signal) => {
                        await saveBrief(signal);
                        toast.success("Briefing salvo.");
                      });
                  }}
                />
              ) : (
                <>
                  <div className="social-texts-toolbar">
                    <p>
                      Uma ideia comum, narrativas próprias.{" "}
                      <strong>Revise os fatos.</strong>
                    </p>
                    <button
                      className="social-button secondary small"
                      disabled={!posts.length}
                      onClick={exportText}
                    >
                      <ArrowDownToLine size={15} />
                      Exportar textos
                    </button>
                  </div>
                  <div
                    className="social-channel-tabs"
                    role="tablist"
                    aria-label="Rede social"
                  >
                    {brief.channels.map((c) => (
                      <button
                        role="tab"
                        aria-selected={channel === c}
                        className={channel === c ? "active" : ""}
                        key={c}
                        onClick={() => setChannel(c)}
                      >
                        <ChannelIcon channel={c} />
                        {CHANNELS[c].name}
                        {posts.some((p) => p.channel === c) && (
                          <Check size={12} />
                        )}
                      </button>
                    ))}
                  </div>
                  {activePost ? (
                    <PostEditor
                      key={activePost.id}
                      post={activePost}
                      attachments={attachments}
                      busy={busy}
                      onSave={(copy, id) => saveCopy(activePost, copy, id)}
                      onRegenerate={() => generate(channel)}
                      onPublish={() => setPublishPost(activePost)}
                      onStatus={() => pollPost(activePost)}
                    />
                  ) : (
                    <div className="social-empty">
                      <Sparkles size={34} />
                      <h2>
                        {busy
                          ? "Encontrando o melhor jeito de contar."
                          : `Uma conversa para o ${CHANNELS[channel].name}.`}
                      </h2>
                      <p>{CHANNELS[channel].instruction}</p>
                      <button
                        className="social-button primary"
                        disabled={busy}
                        onClick={() => generate(channel)}
                      >
                        <Sparkles size={16} />
                        Gerar texto · 2 créditos
                      </button>
                    </div>
                  )}
                  {!busy &&
                    brief.channels.some(
                      (c) => !posts.some((p) => p.channel === c),
                    ) && (
                      <button
                        className="social-button secondary social-generate-remaining"
                        onClick={() => generate()}
                      >
                        Gerar redes restantes
                        <Sparkles size={15} />
                      </button>
                    )}
                </>
              )}
            </>
          )}
          {page === "connections" && (
            <>
              <PageHeading
                eyebrow="SUA MARCA, CONECTADA"
                title="O próximo passo é a conversa."
                description="Autorize as contas onde você quer publicar. Cada rede tem suas permissões e seus formatos."
              />
              <div className="social-info-banner">
                <ShieldCheck size={20} />
                <p>
                  Conectar uma conta não publica conteúdo. A senha fica na rede
                  social; o BrieFlow recebe uma autorização criptografada, que
                  você pode desconectar.
                </p>
              </div>
              <div className="social-connections-grid">
                {CHANNEL_IDS.map((c) => {
                  const state = connections.find((v) => v.channel === c),
                    connected = accounts.filter((a) => a.channel === c);
                  return (
                    <article className="social-panel" key={c}>
                      <div className="social-connection-title">
                        <ChannelIcon channel={c} />
                        <h2>{CHANNELS[c].name}</h2>
                        <span
                          className={`social-status ${connected.some((a) => a.status === "connected") ? "status-published" : "status-draft"}`}
                        >
                          {connected.some((a) => a.status === "connected")
                            ? "Conectada"
                            : state?.configured
                              ? "Não conectada"
                              : "Ativação pendente"}
                        </span>
                      </div>
                      <p>{CHANNELS[c].requirement}</p>
                      {connected.map((a) => (
                        <div className="social-connected-account" key={a.id}>
                          <div>
                            <strong>{a.label}</strong>
                            <small>
                              {a.status === "expired"
                                ? "Expirada — reconecte"
                                : a.expires_at
                                  ? `Válida até ${new Date(a.expires_at).toLocaleString("pt-BR")}`
                                  : "Autorização recebida"}
                            </small>
                          </div>
                          {a.status === "connected" && (
                            <button
                              className="social-text-button"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Desconectar ${a.label}? Posts já publicados não serão apagados.`,
                                  )
                                )
                                  void run(async () => {
                                    await socialApi({
                                      action: "disconnect",
                                      accountId: a.id,
                                    });
                                    await loadListing();
                                  });
                              }}
                            >
                              Desconectar
                            </button>
                          )}
                        </div>
                      ))}
                      <p className="social-help">
                        {state?.reason ??
                          "A integração será liberada após configurar o aplicativo oficial e suas permissões. Não há conexão demonstrativa."}
                      </p>
                      <button
                        className="social-button secondary"
                        disabled={busy || (!!userId && !state?.configured)}
                        onClick={() => connect(c)}
                      >
                        <Link2 size={16} />
                        {!userId
                          ? "Entrar para conectar"
                          : state?.configured
                            ? "Conectar conta"
                            : "Aguardando configuração"}
                      </button>
                    </article>
                  );
                })}
              </div>
              <p className="social-help">
                As autorizações podem expirar ou ser revogadas pela plataforma.
                Nesta versão, a renovação é feita reconectando a conta. A API do
                X e outras plataformas podem exigir acesso comercial próprio;
                nenhum serviço pago foi contratado.
              </p>
            </>
          )}
          {page === "analytics" && (
            <>
              <PageHeading
                eyebrow="DESEMPENHO, SEM ACHISMOS"
                title="Entenda cada conversa."
                description="Compare as redes no contexto certo, com os dados realmente fornecidos por elas."
              />
              <label className="social-field social-campaign-select">
                <span>Campanha</span>
                <select
                  value={campaign?.id ?? ""}
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.value)
                      openCampaign(e.target.value, "analytics");
                  }}
                >
                  <option value="">Selecione uma campanha</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.brief.name}
                    </option>
                  ))}
                </select>
              </label>
              <SocialAnalytics
                posts={posts}
                metrics={metrics}
                onRefresh={refreshMetrics}
                busy={busy}
              />
            </>
          )}
        </div>
        <footer className="social-footer">
          <span>
            brieflow<span> · </span>Conteúdo com contexto.
          </span>
          <span>Você cria a intenção. A IA encontra as palavras.</span>
        </footer>
      </section>
      {publishPost && (
        <PublishDialog
          key={publishPost.id}
          post={publishPost}
          accounts={accounts}
          attachments={attachments}
          onClose={() => setPublishPost(null)}
          onPublish={publish}
          busy={busy}
        />
      )}
    </main>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="social-page-heading">
      <div>
        <span className="social-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function CampaignList({
  campaigns,
  onOpen,
}: {
  campaigns: SocialCampaign[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="social-campaign-list">
      {campaigns.map((c) => (
        <button
          key={c.id}
          className="social-campaign-row"
          onClick={() => onOpen(c.id)}
        >
          <span className="social-campaign-initial">
            {c.brief.brand.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{c.brief.name}</strong>
            <span>
              {c.brief.brand} <i>·</i>{" "}
              {new Date(c.updated_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <span className="social-campaign-networks">
            {c.brief.channels.map((channel) => (
              <ChannelIcon key={channel} channel={channel} />
            ))}
          </span>
          <ArrowRight size={18} />
        </button>
      ))}
    </div>
  );
}
