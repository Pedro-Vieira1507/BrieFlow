import { createFileRoute, Link } from "@tanstack/react-router";
import { useCampaign, MATERIAL_META, type MaterialKey, store } from "@/lib/store";
import { generateAllMaterials, generatePodcastAudio, type GenerationProgress } from "@/lib/generateMaterials";
import { generateSlidesWithAI, generatePptx } from "@/lib/generatePptx";
import { generateFolhetoData, renderFolhetoCanvas, downloadFolhetoPng } from "@/lib/generateFolheto";
import { generateFichaTecnicaData, generateFichaTecnicaPDF, downloadFichaTecnicaPDF } from "@/lib/generateFichaTecnica";
import { generateEmailSequencia, downloadEmailHtml } from "@/lib/generateEmail";
import { generateLinkedInPosts, generateFacebookPosts, generateInstagramData, generateVideoRoteiro } from "@/lib/generateSocialPosts";
import type { LinkedInPost, FacebookPost, InstagramData, VideoRoteiro, EmailSequencia } from "@/lib/generateSocialPosts";
import { getActiveKey, loadAIConfig } from "@/lib/aiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Copy, Download, Sparkles, Loader2, Zap, Mic,
  Presentation, ImageIcon, FileText, Mail, Facebook,
  Instagram, Linkedin, Video, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/campanha/$id/materiais")({ component: Page });

// ─── Componentes de Preview ────────────────────────────────────────────────────

function EmailPreview({ emails, tipo, campanha }: { emails: EmailSequencia["emails"]; tipo: string; campanha: string }) {
  const [idx, setIdx] = useState(0);
  const cur = emails[idx];
  if (!cur) return null;
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
      {/* Header */}
      <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            E-mail {idx + 1} de {emails.length} · {tipo === "revendedores" ? "Revendedores" : "Cliente Final"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          {emails.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-2 w-2 rounded-full transition-all ${ i === idx ? "bg-amber-500 w-4" : "bg-amber-200" }`}
            />
          ))}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIdx(Math.min(emails.length - 1, idx + 1))} disabled={idx === emails.length - 1}>
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-600" onClick={() => downloadEmailHtml(cur.html, idx, campanha, tipo)}>
            <Download className="h-3 w-3 mr-1" /> .html
          </Button>
        </div>
      </div>
      {/* Assunto */}
      <div className="bg-white dark:bg-slate-900 px-4 py-2 border-b border-amber-100 dark:border-amber-900">
        <p className="text-xs text-muted-foreground">Assunto:</p>
        <p className="text-sm font-semibold">{cur.assunto}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{cur.preheader}</p>
      </div>
      {/* Preview iframe */}
      <div className="bg-gray-100 dark:bg-gray-900 p-3">
        <iframe
          srcDoc={cur.html}
          title={`E-mail ${idx + 1}`}
          className="w-full rounded border border-amber-100 dark:border-amber-900 bg-white"
          style={{ height: 480 }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}

function LinkedInPreview({ posts }: { posts: LinkedInPost[] }) {
  const [idx, setIdx] = useState(0);
  const p = posts[idx];
  if (!p) return null;
  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 overflow-hidden">
      <div className="bg-sky-50 dark:bg-sky-950/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Linkedin className="h-3.5 w-3.5 text-sky-600" />
          <span className="text-xs font-medium text-sky-700 dark:text-sky-300">Post {idx + 1} de {posts.length} · {p.tipo === "autoridade" ? "Autoridade" : "Oferta"}</span>
        </div>
        <div className="flex gap-1">
          {posts.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${ i === idx ? "bg-sky-500 w-6" : "bg-sky-200 w-2" }`} />
          ))}
        </div>
      </div>
      {/* Card estilo LinkedIn */}
      <div className="bg-white dark:bg-slate-900 p-4">
        <div className="max-w-lg mx-auto border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
          {/* Top bar */}
          <div className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">B</div>
            <div>
              <p className="text-sm font-semibold">BriefFlow</p>
              <p className="text-xs text-muted-foreground">Empresa · Agora</p>
            </div>
          </div>
          {/* Content */}
          <div className="p-3 space-y-2">
            <p className="text-sm font-bold leading-snug">{p.titulo}</p>
            <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">{p.corpo}</p>
            <p className="text-sm font-medium text-sky-600">{p.cta}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {p.hashtags.map((h, i) => (
                <span key={i} className="text-xs text-sky-500">#{h}</span>
              ))}
            </div>
          </div>
          {/* Reactions bar */}
          <div className="flex gap-4 px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground">
            <span>👍 Curtir</span><span>💬 Comentar</span><span>🔁 Compartilhar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacebookPreview({ posts }: { posts: FacebookPost[] }) {
  const [idx, setIdx] = useState(0);
  const p = posts[idx];
  if (!p) return null;
  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
      <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Facebook className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Post {idx + 1} de {posts.length} · {p.tipo === "apresentacao" ? "Apresentação" : "Oferta"}</span>
        </div>
        <div className="flex gap-1">
          {posts.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${ i === idx ? "bg-blue-500 w-6" : "bg-blue-200 w-2" }`} />
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 p-4">
        <div className="max-w-lg mx-auto border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">B</div>
            <div>
              <p className="text-sm font-semibold">BriefFlow</p>
              <p className="text-xs text-muted-foreground">🌐 Página · Agora</p>
            </div>
          </div>
          <div className="p-3">
            <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">{p.texto}</p>
            <p className="text-sm font-semibold text-blue-600 mt-2">{p.cta}</p>
          </div>
          {/* Imagem placeholder */}
          <div className="h-40 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center">
            <div className="text-center">
              <span className="text-3xl">{p.emojis}</span>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">Imagem do post</p>
            </div>
          </div>
          <div className="flex gap-4 px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground">
            <span>👍 Curtir</span><span>💬 Comentar</span><span>🔄 Compartilhar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstagramPreview({ data }: { data: InstagramData }) {
  const [tab, setTab] = useState<"carrossel" | "reels">("carrossel");
  const [slideIdx, setSlideIdx] = useState(0);
  const slides = data.carrossel.slides;
  const cur = slides[slideIdx];

  return (
    <div className="rounded-xl border border-rose-200 dark:border-rose-800 overflow-hidden">
      <div className="bg-rose-50 dark:bg-rose-950/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Instagram className="h-3.5 w-3.5 text-rose-500" />
          <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Instagram Preview</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTab("carrossel")}
            className={`text-xs px-2 py-0.5 rounded-full transition-all ${ tab === "carrossel" ? "bg-rose-500 text-white" : "text-rose-400" }`}>Carrossel</button>
          <button onClick={() => setTab("reels")}
            className={`text-xs px-2 py-0.5 rounded-full transition-all ${ tab === "reels" ? "bg-rose-500 text-white" : "text-rose-400" }`}>Reels</button>
        </div>
      </div>

      {tab === "carrossel" && (
        <div className="bg-white dark:bg-slate-900 p-4">
          <div className="max-w-xs mx-auto">
            {/* Slide visual */}
            <div className="aspect-square rounded-lg flex flex-col items-center justify-center p-4 text-white relative overflow-hidden"
              style={{ background: cur?.cor ?? "#6C63FF" }}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 30%, white 0%, transparent 60%)" }} />
              <p className="text-lg font-bold text-center leading-tight">{cur?.texto}</p>
              <p className="text-xs mt-2 opacity-75 text-center">{cur?.visual}</p>
            </div>
            {/* Dots */}
            <div className="flex justify-center gap-1 mt-2">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setSlideIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${ i === slideIdx ? "bg-rose-500 w-4" : "bg-gray-300 w-1.5" }`} />
              ))}
            </div>
            <div className="flex gap-1 justify-center mt-1">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSlideIdx(Math.max(0, slideIdx - 1))} disabled={slideIdx === 0}><ChevronLeft className="h-3 w-3" /></Button>
              <span className="text-xs text-muted-foreground self-center">{slideIdx + 1}/{slides.length}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSlideIdx(Math.min(slides.length - 1, slideIdx + 1))} disabled={slideIdx === slides.length - 1}><ChevronRight className="h-3 w-3" /></Button>
            </div>
            {/* Legenda */}
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300">{data.carrossel.legenda}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.carrossel.hashtags.slice(0, 5).map((h, i) => (
                  <span key={i} className="text-xs text-rose-400">#{h}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "reels" && (
        <div className="bg-white dark:bg-slate-900 p-4">
          <div className="max-w-lg mx-auto space-y-2">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="text-xs border-rose-300 text-rose-600">⏱ {data.reels.duracao}</Badge>
              <span className="text-xs text-muted-foreground">🎵 {data.reels.musica}</span>
            </div>
            {data.reels.cenas.map((cena, i) => (
              <div key={i} className="flex gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border-l-4 border-rose-400">
                <div className="shrink-0 w-10 h-10 rounded bg-gradient-to-br from-rose-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">{cena.tempo}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{cena.visual}</p>
                  <p className="text-xs text-rose-600 font-semibold mt-0.5">"{cena.texto}"</p>
                  <p className="text-xs text-muted-foreground italic mt-0.5">{cena.locucao}</p>
                </div>
              </div>
            ))}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mt-2">
              <p className="text-xs text-gray-700 dark:text-gray-300">{data.reels.legenda}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoRoteiroPreview({ roteiro }: { roteiro: VideoRoteiro }) {
  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
      <div className="bg-orange-50 dark:bg-orange-950/30 px-4 py-2 flex items-center gap-2">
        <Video className="h-3.5 w-3.5 text-orange-600" />
        <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
          {roteiro.titulo} · {roteiro.duracao} · {roteiro.formato}
        </span>
      </div>
      <div className="bg-white dark:bg-slate-900 p-4 space-y-3">
        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-orange-200 dark:bg-orange-800" />
          <div className="space-y-3">
            {roteiro.cenas.map((cena) => (
              <div key={cena.numero} className="flex gap-3 relative">
                {/* Bolinha da timeline */}
                <div className="shrink-0 h-14 w-14 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 flex flex-col items-center justify-center text-white shadow-sm z-10">
                  <span className="text-xs font-bold">C{cena.numero}</span>
                  <span className="text-xs opacity-90">{cena.tempo}</span>
                </div>
                <div className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-relaxed">{cena.visual}</p>
                    {cena.musica && (
                      <span className="text-xs text-orange-500 shrink-0">🎵 {cena.musica}</span>
                    )}
                  </div>
                  {cena.textTela && (
                    <p className="text-xs font-bold text-orange-600 mt-1">"{cena.textTela}"</p>
                  )}
                  {cena.locucao && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">{cena.locucao}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* CTA + Legenda */}
        <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <p className="text-xs font-bold text-orange-700 dark:text-orange-300">CTA: {roteiro.cta}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{roteiro.legenda}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers de Banner ─────────────────────────────────────────────────────

const BANNER_CFG: Record<string, { border: string; bg: string; text: string; icon: React.ReactNode; msg: string; btn: string }> = {
  emails_revendedores: { border: "border-amber-200 dark:border-amber-800", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", icon: <Mail className="h-3.5 w-3.5 shrink-0" />, msg: "A IA gera e-mails HTML responsivos prontos para disparar.", btn: "📧 Gerar E-mails HTML" },
  emails_cliente_final: { border: "border-amber-200 dark:border-amber-800", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", icon: <Mail className="h-3.5 w-3.5 shrink-0" />, msg: "A IA gera 3 e-mails HTML para sequência de nurturing completa.", btn: "📧 Gerar E-mails HTML" },
  posts_linkedin: { border: "border-sky-200 dark:border-sky-800", bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-300", icon: <Linkedin className="h-3.5 w-3.5 shrink-0" />, msg: "A IA gera posts otimizados para o algoritmo do LinkedIn.", btn: "💼 Gerar Posts LinkedIn" },
  posts_facebook: { border: "border-blue-200 dark:border-blue-800", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", icon: <Facebook className="h-3.5 w-3.5 shrink-0" />, msg: "A IA gera posts com emojis e CTAs para o Facebook.", btn: "🟦 Gerar Posts Facebook" },
  posts_instagram: { border: "border-rose-200 dark:border-rose-800", bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", icon: <Instagram className="h-3.5 w-3.5 shrink-0" />, msg: "A IA gera carrossel de slides e roteiro de Reels.", btn: "📸 Gerar Carrossel + Reels" },
  roteiro_video_curto: { border: "border-orange-200 dark:border-orange-800", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300", icon: <Video className="h-3.5 w-3.5 shrink-0" />, msg: "A IA cria roteiro cena a cena com timeline visual para vídeos curtos.", btn: "🎥 Gerar Roteiro de Vídeo" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────────

function Page() {
  const { id } = Route.useParams();
  const c = useCampaign(id);
  const [active, setActive] = useState<MaterialKey | "">("");
  const [edited, setEdited] = useState<Partial<Record<MaterialKey, string>>>({});
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  // Podcast
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // PPTX
  const [pptxLoading, setPptxLoading] = useState(false);
  const [pptxProgress, setPptxProgress] = useState<{ current: number; total: number } | null>(null);

  // Folheto
  const [folhetoLoading, setFolhetoLoading] = useState(false);
  const [folhetoPreview, setFolhetoPreview] = useState<string | null>(null);
  const folhetoCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Ficha
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaPreviewUrl, setFichaPreviewUrl] = useState<string | null>(null);
  const fichaDocRef = useRef<import("jspdf").jsPDF | null>(null);

  // Emails
  const [emailRevLoading, setEmailRevLoading] = useState(false);
  const [emailRevData, setEmailRevData] = useState<EmailSequencia | null>(null);
  const [emailCfLoading, setEmailCfLoading] = useState(false);
  const [emailCfData, setEmailCfData] = useState<EmailSequencia | null>(null);

  // Social
  const [liLoading, setLiLoading] = useState(false);
  const [liData, setLiData] = useState<LinkedInPost[] | null>(null);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbData, setFbData] = useState<FacebookPost[] | null>(null);
  const [igLoading, setIgLoading] = useState(false);
  const [igData, setIgData] = useState<InstagramData | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoData, setVideoData] = useState<VideoRoteiro | null>(null);

  const keys = c?.materiais ? (Object.keys(c.materiais) as MaterialKey[]) : [];

  useEffect(() => { if (keys.length && !active) setActive(keys[0]); }, [keys, active]);
  useEffect(() => {
    setAudioSrc(null); setFolhetoPreview(null); setFichaPreviewUrl(null);
    setEmailRevData(null); setEmailCfData(null);
    setLiData(null); setFbData(null); setIgData(null); setVideoData(null);
  }, [id]);

  if (!c) return null;
  const hasKey = !!getActiveKey();
  const activeModel = loadAIConfig().model;

  function getText(k: MaterialKey) { return edited[k] ?? c?.materiais?.[k] ?? ""; }

  // ── Handlers principais ──────────────────────────────────────────────────────

  async function gerarComIA() {
    if (!c?.brief) return toast.error("Configure o brief antes de gerar materiais.");
    if (!hasKey) return toast.error("Configure sua chave de API em Configurações.");
    setGenerating(true); setProgress(null);
    try {
      const materiais = await generateAllMaterials(c.brief, (p) => setProgress(p));
      store.update(id, { materiais, status: "materiais_gerados" });
      toast.success("Todos os materiais gerados!");
      setActive("");
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setGenerating(false); setProgress(null); }
  }

  function gerarMock() {
    store.generateMockMaterials(id);
    toast.success("Materiais de exemplo gerados."); setActive("");
  }

  async function gerarAudio() {
    const script = getText("podcast_revendedores");
    if (!script) { toast.error("Gere o roteiro primeiro."); return; }
    setTtsLoading(true);
    try {
      const url = await generatePodcastAudio(script);
      setAudioSrc(url); toast.success("Áudio gerado! 🎙️");
      setTimeout(() => audioRef.current?.play(), 300);
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setTtsLoading(false); }
  }

  async function gerarPptx() {
    const texto = getText("apresentacao_slides");
    if (!texto || !c?.brief || !hasKey) { toast.error("Verifique o conteúdo e a chave de API."); return; }
    setPptxLoading(true); setPptxProgress(null);
    try {
      toast.info("🤖 Analisando com IA...");
      const slides = await generateSlidesWithAI(texto, c.brief, c.nome);
      await generatePptx(slides, c.brief, c.nome, (cur, tot) => setPptxProgress({ current: cur, total: tot }));
      toast.success(`✅ PPTX com ${slides.length} slides!`);
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setPptxLoading(false); setPptxProgress(null); }
  }

  async function gerarFolheto() {
    const texto = getText("folheto_a4");
    if (!texto || !c?.brief || !hasKey) { toast.error("Verifique o conteúdo e a chave de API."); return; }
    setFolhetoLoading(true); setFolhetoPreview(null);
    try {
      const data = await generateFolhetoData(texto, c.brief, c.nome);
      const canvas = renderFolhetoCanvas(data, c.brief.marca || c.nome);
      folhetoCanvasRef.current = canvas;
      setFolhetoPreview(canvas.toDataURL("image/png"));
      toast.success("Folheto gerado! 🖼️");
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setFolhetoLoading(false); }
  }

  async function gerarFicha() {
    const texto = getText("ficha_tecnica");
    if (!texto || !c?.brief || !hasKey) { toast.error("Verifique o conteúdo e a chave de API."); return; }
    setFichaLoading(true); setFichaPreviewUrl(null);
    try {
      toast.info("🤖 Identificando produto...");
      const data = await generateFichaTecnicaData(texto, c.brief, c.nome);
      const doc = generateFichaTecnicaPDF(data, c.brief.marca || c.nome);
      fichaDocRef.current = doc;
      setFichaPreviewUrl(URL.createObjectURL(doc.output("blob")));
      toast.success("Ficha PDF gerada! 📄");
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setFichaLoading(false); }
  }

  async function gerarEmailRev() {
    const texto = getText("emails_revendedores");
    if (!texto || !c?.brief || !hasKey) { toast.error("Verifique o conteúdo e a chave de API."); return; }
    setEmailRevLoading(true); setEmailRevData(null);
    try {
      toast.info("🤖 IA criando e-mails HTML...");
      const data = await generateEmailSequencia(texto, c.brief, c.nome, "revendedores");
      setEmailRevData(data);
      toast.success(`✅ ${data.emails.length} e-mails gerados!`);
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setEmailRevLoading(false); }
  }

  async function gerarEmailCf() {
    const texto = getText("emails_cliente_final");
    if (!texto || !c?.brief || !hasKey) { toast.error("Verifique o conteúdo e a chave de API."); return; }
    setEmailCfLoading(true); setEmailCfData(null);
    try {
      toast.info("🤖 IA criando sequência de nurturing...");
      const data = await generateEmailSequencia(texto, c.brief, c.nome, "cliente_final");
      setEmailCfData(data);
      toast.success(`✅ ${data.emails.length} e-mails gerados!`);
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setEmailCfLoading(false); }
  }

  async function gerarLinkedIn() {
    const texto = getText("posts_linkedin");
    if (!texto || !c?.brief || !hasKey) { toast.error("Verifique o conteúdo e a chave de API."); return; }
    setLiLoading(true); setLiData(null);
    try {
      const posts = await generateLinkedInPosts(texto, c.brief, c.nome);
      setLiData(posts); toast.success("✅ Posts LinkedIn gerados!");
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setLiLoading(false); }
  }

  async function gerarFacebook() {
    const texto = getText("posts_facebook");
    if (!texto || !c?.brief || !hasKey) { toast.error("Verifique o conteúdo e a chave de API."); return; }
    setFbLoading(true); setFbData(null);
    try {
      const posts = await generateFacebookPosts(texto, c.brief, c.nome);
      setFbData(posts); toast.success("✅ Posts Facebook gerados!");
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setFbLoading(false); }
  }

  async function gerarInstagram() {
    const texto = getText("posts_instagram");
    if (!texto || !c?.brief || !hasKey) { toast.error("Verifique o conteúdo e a chave de API."); return; }
    setIgLoading(true); setIgData(null);
    try {
      toast.info("🤖 IA criando carrossel + reels...");
      const data = await generateInstagramData(texto, c.brief, c.nome);
      setIgData(data); toast.success("✅ Instagram gerado!");
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setIgLoading(false); }
  }

  async function gerarVideo() {
    const texto = getText("roteiro_video_curto");
    if (!texto || !c?.brief || !hasKey) { toast.error("Verifique o conteúdo e a chave de API."); return; }
    setVideoLoading(true); setVideoData(null);
    try {
      const data = await generateVideoRoteiro(texto, c.brief, c.nome);
      setVideoData(data); toast.success("✅ Roteiro de vídeo gerado!");
    } catch (err) { toast.error(`Erro: ${(err as Error).message}`); }
    finally { setVideoLoading(false); }
  }

  // ── Configuração por material key ───────────────────────────────────────────────

  const EXTRA_BTN: Partial<Record<MaterialKey, { label: string; loading: boolean; fn: () => void; cls: string; icon: React.ReactNode }>> = {
    podcast_revendedores:  { label: "🎙️ Gerar Áudio",         loading: ttsLoading,       fn: gerarAudio,    cls: "border-violet-500/40 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950",   icon: <Mic className="h-4 w-4" /> },
    apresentacao_slides:   { label: "📊 Baixar PPTX",          loading: pptxLoading,      fn: gerarPptx,     cls: "border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950", icon: <Presentation className="h-4 w-4" /> },
    folheto_a4:            { label: "🖼️ Gerar Folheto PNG",    loading: folhetoLoading,   fn: gerarFolheto,  cls: "border-pink-500/40 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950",           icon: <ImageIcon className="h-4 w-4" /> },
    ficha_tecnica:         { label: "📄 Gerar Ficha PDF",       loading: fichaLoading,     fn: gerarFicha,    cls: "border-blue-500/40 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950",           icon: <FileText className="h-4 w-4" /> },
    emails_revendedores:   { label: "📧 Gerar E-mails HTML",   loading: emailRevLoading,  fn: gerarEmailRev, cls: "border-amber-500/40 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950",       icon: <Mail className="h-4 w-4" /> },
    emails_cliente_final:  { label: "📧 Gerar E-mails HTML",   loading: emailCfLoading,   fn: gerarEmailCf,  cls: "border-amber-500/40 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950",       icon: <Mail className="h-4 w-4" /> },
    posts_linkedin:        { label: "💼 Gerar Posts LinkedIn", loading: liLoading,        fn: gerarLinkedIn, cls: "border-sky-500/40 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950",               icon: <Linkedin className="h-4 w-4" /> },
    posts_facebook:        { label: "🟦 Gerar Posts Facebook", loading: fbLoading,        fn: gerarFacebook, cls: "border-blue-500/40 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950",           icon: <Facebook className="h-4 w-4" /> },
    posts_instagram:       { label: "📸 Gerar Carrossel+Reels",loading: igLoading,        fn: gerarInstagram,cls: "border-rose-500/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950",             icon: <Instagram className="h-4 w-4" /> },
    roteiro_video_curto:   { label: "🎥 Gerar Roteiro",        loading: videoLoading,     fn: gerarVideo,    cls: "border-orange-500/40 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950",   icon: <Video className="h-4 w-4" /> },
  };

  // ── Empty state ───────────────────────────────────────────────────────────

  if (keys.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Nenhum material gerado ainda.</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button asChild variant="outline"><Link to="/campanha/$id/brief" params={{ id }}>Abrir brief</Link></Button>
            {hasKey ? (
              <Button onClick={gerarComIA} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar com IA ({activeModel})
              </Button>
            ) : (
              <Button variant="outline" onClick={gerarMock}><Zap className="h-4 w-4" /> Usar exemplo</Button>
            )}
          </div>
          {!hasKey && <p className="text-xs text-muted-foreground"><a href="/configuracoes" className="underline">Configure sua chave de API</a> para gerar materiais reais.</p>}
        </CardContent>
      </Card>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  const currentKey = (active || keys[0]) as MaterialKey;
  const content = edited[currentKey] ?? c.materiais?.[currentKey] ?? "";

  function copy() { navigator.clipboard.writeText(content); toast.success("Conteúdo copiado"); }
  function downloadTxt() {
    const ext = MATERIAL_META[currentKey].ext;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${c!.nome.replace(/[^a-z0-9]+/gi, "_")}_${currentKey}.${ext}`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Download iniciado");
  }

  return (
    <div className="space-y-4">
      {generating && progress && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Gerando: {progress.label}
              <span className="ml-auto text-xs text-muted-foreground">{progress.current}/{progress.total}</span>
            </div>
            <Progress value={Math.round((progress.current / progress.total) * 100)} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        {hasKey
          ? <Button size="sm" onClick={gerarComIA} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar com IA</Button>
          : <Button size="sm" variant="outline" onClick={gerarMock}><Zap className="h-4 w-4" /> Regerar mock</Button>}
      </div>

      <Tabs value={currentKey} onValueChange={(v) => setActive(v as MaterialKey)}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex w-max">
            {keys.map((k) => <TabsTrigger key={k} value={k} className="whitespace-nowrap">{MATERIAL_META[k].label}</TabsTrigger>)}
          </TabsList>
        </div>

        {keys.map((k) => {
          const btn = EXTRA_BTN[k];
          const bannerCfg = BANNER_CFG[k];

          // Dados de preview por tipo
          const emailData = k === "emails_revendedores" ? emailRevData : k === "emails_cliente_final" ? emailCfData : null;
          const emailLoading = k === "emails_revendedores" ? emailRevLoading : emailCfLoading;
          const isEmail = k === "emails_revendedores" || k === "emails_cliente_final";

          return (
            <TabsContent key={k} value={k} className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{MATERIAL_META[k].label}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{MATERIAL_META[k].descricao} · .{MATERIAL_META[k].ext}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {/* Botão de ação principal */}
                    {btn && (
                      <Button variant="outline" size="sm" onClick={btn.fn} disabled={btn.loading} className={btn.cls}>
                        {btn.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : btn.icon}
                        {btn.loading ? "Gerando..." : btn.label}
                      </Button>
                    )}
                    {/* Botões de download extra */}
                    {k === "folheto_a4" && folhetoPreview && <Button size="sm" onClick={() => { downloadFolhetoPng(folhetoCanvasRef.current!, c!.nome); }} className="bg-pink-600 hover:bg-pink-700 text-white"><Download className="h-4 w-4" /> Baixar PNG</Button>}
                    {k === "ficha_tecnica" && fichaPreviewUrl && <Button size="sm" onClick={() => { if (fichaDocRef.current) downloadFichaTecnicaPDF(fichaDocRef.current, c!.nome, c!.nome); }} className="bg-blue-600 hover:bg-blue-700 text-white"><Download className="h-4 w-4" /> Baixar PDF</Button>}
                    <Button variant="outline" size="sm" onClick={copy}><Copy className="h-4 w-4" /> Copiar</Button>
                    <Button size="sm" onClick={downloadTxt}><Download className="h-4 w-4" /> .{MATERIAL_META[k].ext}</Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">

                  {/* ─ Banner informativo ─ */}
                  {bannerCfg && !btn?.loading && !emailData && !liData && !fbData && !igData && !videoData && (
                    <div className={`rounded-xl border ${bannerCfg.border} ${bannerCfg.bg} p-3`}>
                      <p className={`text-xs ${bannerCfg.text} flex items-center gap-2`}>
                        {bannerCfg.icon} {bannerCfg.msg} Clique em <strong>{bannerCfg.btn}</strong>.
                      </p>
                    </div>
                  )}

                  {/* ─ Loading genérico ─ */}
                  {btn?.loading && (
                    <div className={`rounded-xl border ${bannerCfg?.border ?? "border-accent/30"} ${bannerCfg?.bg ?? "bg-accent/5"} p-4`}>
                      <div className={`flex items-center gap-3 text-sm ${bannerCfg?.text ?? "text-accent"}`}>
                        <Loader2 className="h-4 w-4 animate-spin" /> Gerando conteúdo com IA, aguarde…
                      </div>
                    </div>
                  )}

                  {/* ──── PREVIEWS ESPECÍFICOS ──── */}

                  {/* Podcast player */}
                  {k === "podcast_revendedores" && audioSrc && (
                    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-violet-700 dark:text-violet-300 flex items-center gap-2"><Mic className="h-4 w-4" /> Áudio gerado</p>
                        <Button variant="ghost" size="sm" className="text-violet-600 h-7 px-2" onClick={() => { const a = document.createElement("a"); a.href = audioSrc; a.download = `${c!.nome}_podcast.wav`; a.click(); }}>
                          <Download className="h-3 w-3 mr-1" /> .wav
                        </Button>
                      </div>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio ref={audioRef} controls src={audioSrc} className="w-full h-10 accent-violet-600" />
                      <p className="text-xs text-muted-foreground">Voz: Celeste (PT-BR) · WAV</p>
                    </div>
                  )}

                  {/* PPTX progress */}
                  {k === "apresentacao_slides" && pptxLoading && (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
                      <div className="flex items-center gap-3 text-sm text-emerald-600 dark:text-emerald-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {pptxProgress ? `Montando slide ${pptxProgress.current}/${pptxProgress.total}` : "IA gerando slides..."}
                      </div>
                      {pptxProgress && <Progress value={Math.round((pptxProgress.current / pptxProgress.total) * 100)} className="h-1.5" />}
                    </div>
                  )}

                  {/* Folheto preview */}
                  {k === "folheto_a4" && folhetoPreview && (
                    <div className="rounded-xl border border-pink-200 dark:border-pink-800 overflow-hidden">
                      <div className="bg-pink-50 dark:bg-pink-950/30 px-4 py-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-pink-700 dark:text-pink-300 flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Folheto A4 PNG</p>
                        <Button variant="ghost" size="sm" className="text-pink-600 h-7 px-2" onClick={() => { downloadFolhetoPng(folhetoCanvasRef.current!, c!.nome); }}><Download className="h-3 w-3 mr-1" /> PNG</Button>
                      </div>
                      <div className="p-3 bg-muted/30 flex justify-center">
                        <img src={folhetoPreview} alt="Folheto" className="max-w-full rounded shadow-lg" style={{ maxHeight: 520 }} />
                      </div>
                    </div>
                  )}

                  {/* Ficha preview */}
                  {k === "ficha_tecnica" && fichaPreviewUrl && (
                    <div className="rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
                      <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Ficha Técnica PDF A4</p>
                        <Button variant="ghost" size="sm" className="text-blue-600 h-7 px-2" onClick={() => fichaDocRef.current && downloadFichaTecnicaPDF(fichaDocRef.current, c!.nome, c!.nome)}><Download className="h-3 w-3 mr-1" /> PDF</Button>
                      </div>
                      <div className="bg-muted/30 p-2">
                        <iframe src={fichaPreviewUrl} title="Ficha Técnica" className="w-full rounded" style={{ height: 520 }} />
                      </div>
                    </div>
                  )}

                  {/* E-mail preview */}
                  {isEmail && emailData && (
                    <EmailPreview emails={emailData.emails} tipo={emailData.tipo} campanha={c!.nome} />
                  )}

                  {/* LinkedIn preview */}
                  {k === "posts_linkedin" && liData && <LinkedInPreview posts={liData} />}

                  {/* Facebook preview */}
                  {k === "posts_facebook" && fbData && <FacebookPreview posts={fbData} />}

                  {/* Instagram preview */}
                  {k === "posts_instagram" && igData && <InstagramPreview data={igData} />}

                  {/* Video roteiro preview */}
                  {k === "roteiro_video_curto" && videoData && <VideoRoteiroPreview roteiro={videoData} />}

                  {/* Textarea editável */}
                  <Textarea
                    value={edited[k] ?? c.materiais?.[k] ?? ""}
                    onChange={(e) => setEdited((prev) => ({ ...prev, [k]: e.target.value }))}
                    rows={k === "podcast_revendedores" ? 16 : 20}
                    className="font-mono text-sm leading-relaxed"
                    placeholder={`Conteúdo de ${MATERIAL_META[k].label} aparece aqui. Edite e clique no botão de gerar.`}
                  />

                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
