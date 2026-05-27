import { createFileRoute, Link } from "@tanstack/react-router";
import { useCampaign, MATERIAL_META, type MaterialKey, store } from "@/lib/store";
import {
  generateAllMaterials,
  generatePodcastAudio,
  type GenerationProgress,
} from "@/lib/generateMaterials";
import { generateSlidesWithAI, generatePptx } from "@/lib/generatePptx";
import {
  generateFolhetoData,
  renderFolhetoCanvas,
  downloadFolhetoPng,
} from "@/lib/generateFolheto";
import {
  generateFichaTecnicaData,
  generateFichaTecnicaPDF,
  downloadFichaTecnicaPDF,
} from "@/lib/generateFichaTecnica";
import { getActiveKey, loadAIConfig } from "@/lib/aiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Copy, Download, Sparkles, Loader2, Zap, Mic,
  Presentation, ImageIcon, FileText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/campanha/$id/materiais")({
  component: Page,
});

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

  // Folheto PNG
  const [folhetoLoading, setFolhetoLoading] = useState(false);
  const [folhetoPreview, setFolhetoPreview] = useState<string | null>(null);
  const folhetoCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Ficha Técnica PDF
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaPreviewUrl, setFichaPreviewUrl] = useState<string | null>(null);
  const fichaDocRef = useRef<import("jspdf").jsPDF | null>(null);

  const keys = c?.materiais ? (Object.keys(c.materiais) as MaterialKey[]) : [];

  useEffect(() => {
    if (keys.length && !active) setActive(keys[0]);
  }, [keys, active]);

  useEffect(() => {
    setAudioSrc(null);
    setFolhetoPreview(null);
    setFichaPreviewUrl(null);
  }, [id]);

  if (!c) return null;

  const hasKey = !!getActiveKey();
  const activeModel = loadAIConfig().model;

  // ── Handlers ────────────────────────────────────────────────────────────

  async function gerarComIA() {
    if (!c?.brief) return toast.error("Configure o brief antes de gerar materiais.");
    if (!hasKey) return toast.error("Configure sua chave de API em Configurações.");
    setGenerating(true);
    setProgress(null);
    try {
      const materiais = await generateAllMaterials(c.brief, (p) => setProgress(p));
      store.update(id, { materiais, status: "materiais_gerados" });
      toast.success("Todos os materiais gerados com sucesso!");
      setActive("");
      setAudioSrc(null);
      setFolhetoPreview(null);
      setFichaPreviewUrl(null);
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }

  function gerarMock() {
    store.generateMockMaterials(id);
    toast.success("Materiais de exemplo gerados (mock).");
    setActive("");
    setAudioSrc(null);
    setFolhetoPreview(null);
    setFichaPreviewUrl(null);
  }

  async function gerarAudio() {
    const script = edited["podcast_revendedores"] ?? c?.materiais?.["podcast_revendedores"] ?? "";
    if (!script) { toast.error("Gere o roteiro do podcast antes de converter para áudio."); return; }
    setTtsLoading(true);
    try {
      const dataUrl = await generatePodcastAudio(script);
      setAudioSrc(dataUrl);
      toast.success("Áudio gerado! 🎙️");
      setTimeout(() => audioRef.current?.play(), 300);
    } catch (err) {
      toast.error(`Erro ao gerar áudio: ${(err as Error).message}`);
    } finally { setTtsLoading(false); }
  }

  function downloadAudio() {
    if (!audioSrc) return;
    const a = document.createElement("a");
    a.href = audioSrc;
    a.download = `${c!.nome.replace(/[^a-z0-9]+/gi, "_")}_podcast.wav`;
    a.click();
  }

  async function gerarPptx() {
    const texto = edited["apresentacao_slides"] ?? c?.materiais?.["apresentacao_slides"] ?? "";
    if (!texto) { toast.error("Gere a apresentação antes de exportar."); return; }
    if (!c?.brief) { toast.error("Brief não encontrado."); return; }
    if (!hasKey) { toast.error("Configure sua chave de API."); return; }
    setPptxLoading(true);
    setPptxProgress(null);
    try {
      toast.info("🤖 Analisando roteiro com IA...");
      const slides = await generateSlidesWithAI(texto, c.brief, c.nome);
      toast.info(`📸 Montando ${slides.length} slides...`);
      await generatePptx(slides, c.brief, c.nome, (cur, tot) => setPptxProgress({ current: cur, total: tot }));
      toast.success(`✅ PPTX gerado com ${slides.length} slides!`);
    } catch (err) {
      toast.error(`Erro ao gerar PPTX: ${(err as Error).message}`);
    } finally { setPptxLoading(false); setPptxProgress(null); }
  }

  async function gerarFolheto() {
    const texto = edited["folheto_a4"] ?? c?.materiais?.["folheto_a4"] ?? "";
    if (!texto) { toast.error("Gere o texto do folheto primeiro."); return; }
    if (!c?.brief) { toast.error("Brief não encontrado."); return; }
    if (!hasKey) { toast.error("Configure sua chave de API."); return; }
    setFolhetoLoading(true);
    setFolhetoPreview(null);
    try {
      toast.info("🤖 IA estruturando o folheto...");
      const folhetoData = await generateFolhetoData(texto, c.brief, c.nome);
      const canvas = renderFolhetoCanvas(folhetoData, c.brief.marca || c.nome);
      folhetoCanvasRef.current = canvas;
      setFolhetoPreview(canvas.toDataURL("image/png"));
      toast.success("Folheto gerado! 🖼️");
    } catch (err) {
      toast.error(`Erro ao gerar folheto: ${(err as Error).message}`);
    } finally { setFolhetoLoading(false); }
  }

  function baixarFolheto() {
    if (!folhetoCanvasRef.current) return;
    downloadFolhetoPng(folhetoCanvasRef.current, c!.nome);
    toast.success("Download iniciado 🖼️");
  }

  async function gerarFicha() {
    const texto = edited["ficha_tecnica"] ?? c?.materiais?.["ficha_tecnica"] ?? "";
    if (!texto) { toast.error("Gere o texto da ficha técnica primeiro."); return; }
    if (!c?.brief) { toast.error("Brief não encontrado."); return; }
    if (!hasKey) { toast.error("Configure sua chave de API."); return; }
    setFichaLoading(true);
    setFichaPreviewUrl(null);
    try {
      toast.info("🤖 IA identificando produto e especificações...");
      const fichaData = await generateFichaTecnicaData(texto, c.brief, c.nome);
      toast.info("📄 Montando PDF profissional...");
      const doc = generateFichaTecnicaPDF(fichaData, c.brief.marca || c.nome);
      fichaDocRef.current = doc;
      // Preview via blob URL
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setFichaPreviewUrl(url);
      toast.success("Ficha técnica PDF gerada! 📄");
    } catch (err) {
      toast.error(`Erro ao gerar ficha: ${(err as Error).message}`);
    } finally { setFichaLoading(false); }
  }

  function baixarFicha() {
    if (!fichaDocRef.current || !c) return;
    const texto = edited["ficha_tecnica"] ?? c?.materiais?.["ficha_tecnica"] ?? "";
    // Extrai nome do produto do primeiro campo do texto (fallback: nome da campanha)
    const match = texto.match(/^#+\s*(.+)/m) ?? texto.match(/produto[:\s]+([^\n]+)/im);
    const nomeProd = match?.[1]?.trim() ?? c.nome;
    downloadFichaTecnicaPDF(fichaDocRef.current, nomeProd, c.nome);
    toast.success("Download do PDF iniciado 📄");
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (keys.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Nenhum material gerado ainda.</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button asChild variant="outline">
              <Link to="/campanha/$id/brief" params={{ id }}>Abrir brief</Link>
            </Button>
            {hasKey ? (
              <Button onClick={gerarComIA} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar com IA ({activeModel})
              </Button>
            ) : (
              <Button variant="outline" onClick={gerarMock}>
                <Zap className="h-4 w-4" /> Usar exemplo (mock)
              </Button>
            )}
          </div>
          {!hasKey && (
            <p className="text-xs text-muted-foreground">
              <a href="/configuracoes" className="underline">Configure sua chave de API</a> para gerar materiais reais.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  const currentKey = (active || keys[0]) as MaterialKey;
  const content = edited[currentKey] ?? c.materiais?.[currentKey] ?? "";
  const isPodcastTab = currentKey === "podcast_revendedores";

  function copy() {
    navigator.clipboard.writeText(content);
    toast.success("Conteúdo copiado");
  }

  function download() {
    const ext = MATERIAL_META[currentKey].ext;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c!.nome.replace(/[^a-z0-9]+/gi, "_")}_${currentKey}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download iniciado");
  }

  return (
    <div className="space-y-4">
      {/* Progress overlay */}
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
        {hasKey ? (
          <Button size="sm" onClick={gerarComIA} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar com IA
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={gerarMock}>
            <Zap className="h-4 w-4" /> Regerar mock
          </Button>
        )}
      </div>

      <Tabs value={currentKey} onValueChange={(v) => setActive(v as MaterialKey)}>
        <div className="overflow-x-auto pb-1 scrollbar-thin">
          <TabsList className="inline-flex w-max">
            {keys.map((k) => (
              <TabsTrigger key={k} value={k} className="whitespace-nowrap">
                {MATERIAL_META[k].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {keys.map((k) => (
          <TabsContent key={k} value={k} className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{MATERIAL_META[k].label}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {MATERIAL_META[k].descricao} · Exporta como .{MATERIAL_META[k].ext}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0 flex-wrap justify-end">

                  {/* 🎙 Podcast TTS */}
                  {k === "podcast_revendedores" && (
                    <Button variant="outline" size="sm" onClick={gerarAudio} disabled={ttsLoading}
                      className="border-violet-500/40 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950">
                      {ttsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                      {ttsLoading ? "Gerando áudio…" : "🎙️ Gerar Áudio"}
                    </Button>
                  )}

                  {/* 📊 PPTX */}
                  {k === "apresentacao_slides" && (
                    <Button variant="outline" size="sm" onClick={gerarPptx} disabled={pptxLoading}
                      className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                      {pptxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
                      {pptxLoading ? "Gerando PPTX…" : "📊 Baixar PPTX"}
                    </Button>
                  )}

                  {/* 🖼 Folheto PNG */}
                  {k === "folheto_a4" && (
                    <Button variant="outline" size="sm" onClick={gerarFolheto} disabled={folhetoLoading}
                      className="border-pink-500/40 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950">
                      {folhetoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                      {folhetoLoading ? "Gerando folheto…" : "🖼️ Gerar Folheto PNG"}
                    </Button>
                  )}
                  {k === "folheto_a4" && folhetoPreview && (
                    <Button size="sm" onClick={baixarFolheto} className="bg-pink-600 hover:bg-pink-700 text-white">
                      <Download className="h-4 w-4" /> Baixar PNG
                    </Button>
                  )}

                  {/* 📄 Ficha Técnica PDF */}
                  {k === "ficha_tecnica" && (
                    <Button variant="outline" size="sm" onClick={gerarFicha} disabled={fichaLoading}
                      className="border-blue-500/40 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950">
                      {fichaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      {fichaLoading ? "Gerando PDF…" : "📄 Gerar Ficha PDF"}
                    </Button>
                  )}
                  {k === "ficha_tecnica" && fichaPreviewUrl && (
                    <Button size="sm" onClick={baixarFicha} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Download className="h-4 w-4" /> Baixar PDF
                    </Button>
                  )}

                  <Button variant="outline" size="sm" onClick={copy}>
                    <Copy className="h-4 w-4" /> Copiar
                  </Button>
                  <Button size="sm" onClick={download}>
                    <Download className="h-4 w-4" /> Baixar .{MATERIAL_META[k].ext}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">

                {/* 🎙 Player podcast */}
                {k === "podcast_revendedores" && audioSrc && (
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-violet-700 dark:text-violet-300 flex items-center gap-2">
                        <Mic className="h-4 w-4" /> Áudio gerado · Orpheus TTS
                      </p>
                      <Button variant="ghost" size="sm" onClick={downloadAudio} className="text-violet-600 h-7 px-2">
                        <Download className="h-3 w-3 mr-1" /> .wav
                      </Button>
                    </div>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio ref={audioRef} controls src={audioSrc} className="w-full h-10 accent-violet-600" />
                    <p className="text-xs text-muted-foreground">Voz: Celeste (PT-BR) · Formato: WAV</p>
                  </div>
                )}
                {k === "podcast_revendedores" && ttsLoading && (
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4">
                    <div className="flex items-center gap-3 text-sm text-violet-600 dark:text-violet-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Convertendo roteiro em áudio…
                    </div>
                  </div>
                )}

                {/* 📊 PPTX banner */}
                {k === "apresentacao_slides" && !pptxLoading && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <Presentation className="h-3.5 w-3.5 shrink-0" />
                      Edite o conteúdo e clique em <strong>📊 Baixar PPTX</strong> para exportar.
                    </p>
                  </div>
                )}
                {k === "apresentacao_slides" && pptxLoading && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
                    <div className="flex items-center gap-3 text-sm text-emerald-600 dark:text-emerald-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {pptxProgress ? `Montando slide ${pptxProgress.current} de ${pptxProgress.total}…` : "IA gerando estrutura dos slides…"}
                    </div>
                    {pptxProgress && <Progress value={Math.round((pptxProgress.current / pptxProgress.total) * 100)} className="h-1.5" />}
                  </div>
                )}

                {/* 🖼 Folheto banner */}
                {k === "folheto_a4" && !folhetoLoading && !folhetoPreview && (
                  <div className="rounded-xl border border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-950/30 p-3">
                    <p className="text-xs text-pink-700 dark:text-pink-300 flex items-center gap-2">
                      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                      Edite o texto e clique em <strong>🖼️ Gerar Folheto PNG</strong> para criar o design.
                    </p>
                  </div>
                )}
                {k === "folheto_a4" && folhetoLoading && (
                  <div className="rounded-xl border border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-950/30 p-4">
                    <div className="flex items-center gap-3 text-sm text-pink-600 dark:text-pink-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> IA estruturando e renderizando design…
                    </div>
                  </div>
                )}
                {k === "folheto_a4" && folhetoPreview && (
                  <div className="rounded-xl border border-pink-200 dark:border-pink-800 overflow-hidden">
                    <div className="bg-pink-50 dark:bg-pink-950/30 px-4 py-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-pink-700 dark:text-pink-300 flex items-center gap-2">
                        <ImageIcon className="h-3.5 w-3.5" /> Folheto gerado · A4 PNG
                      </p>
                      <Button variant="ghost" size="sm" onClick={baixarFolheto} className="text-pink-600 h-7 px-2">
                        <Download className="h-3 w-3 mr-1" /> Baixar PNG
                      </Button>
                    </div>
                    <div className="p-3 bg-muted/30 flex justify-center">
                      <img src={folhetoPreview} alt="Preview do folheto" className="max-w-full rounded shadow-lg" style={{ maxHeight: 520 }} />
                    </div>
                    <p className="text-xs text-muted-foreground text-center py-2">794 × 1123 px (A4) · Clique em Baixar PNG</p>
                  </div>
                )}

                {/* 📄 Ficha Técnica banner */}
                {k === "ficha_tecnica" && !fichaLoading && !fichaPreviewUrl && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      A IA identifica o produto no texto e gera um PDF profissional com especificações técnicas completas. Clique em <strong>📄 Gerar Ficha PDF</strong>.
                    </p>
                  </div>
                )}
                {k === "ficha_tecnica" && fichaLoading && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
                    <div className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> IA identificando produto e montando PDF...
                    </div>
                  </div>
                )}
                {k === "ficha_tecnica" && fichaPreviewUrl && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
                    <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" /> Ficha Técnica gerada · PDF A4
                      </p>
                      <Button variant="ghost" size="sm" onClick={baixarFicha} className="text-blue-600 h-7 px-2">
                        <Download className="h-3 w-3 mr-1" /> Baixar PDF
                      </Button>
                    </div>
                    <div className="bg-muted/30 p-2">
                      <iframe
                        src={fichaPreviewUrl}
                        title="Preview Ficha Técnica"
                        className="w-full rounded border border-blue-100 dark:border-blue-900"
                        style={{ height: 520 }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center py-2">
                      PDF A4 profissional · Especificações técnicas completas · Clique em Baixar PDF
                    </p>
                  </div>
                )}

                <Textarea
                  value={edited[k] ?? c.materiais?.[k] ?? ""}
                  onChange={(e) => setEdited((prev) => ({ ...prev, [k]: e.target.value }))}
                  rows={isPodcastTab ? 16 : 22}
                  className="font-mono text-sm leading-relaxed"
                  placeholder={
                    k === "podcast_revendedores" ? "Roteiro do podcast aparece aqui."
                    : k === "apresentacao_slides" ? "Apresentação aparece aqui. Edite e clique em 📊 Baixar PPTX."
                    : k === "folheto_a4" ? "Texto do folheto aparece aqui. Edite e clique em 🖼️ Gerar Folheto PNG."
                    : k === "ficha_tecnica" ? "Texto da ficha técnica aparece aqui. A IA identifica o produto e gera o PDF."
                    : ""
                  }
                />

                {k === "podcast_revendedores" && !audioSrc && !ttsLoading && (
                  <p className="text-xs text-muted-foreground text-center">
                    💡 Edite o roteiro acima e clique em <strong>🎙️ Gerar Áudio</strong> para criar o arquivo WAV.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
