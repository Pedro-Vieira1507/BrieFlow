import { createFileRoute, Link } from "@tanstack/react-router";
import { useCampaign, MATERIAL_META, type MaterialKey, store } from "@/lib/store";
import {
  generateAllMaterials,
  generatePodcastAudio,
  type GenerationProgress,
} from "@/lib/generateMaterials";
import { getActiveKey, loadAIConfig } from "@/lib/aiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Copy, Download, Sparkles, Loader2, Zap, Mic } from "lucide-react";
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

  // ── Podcast TTS state ────────────────────────────────────────────────────
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const keys = c?.materiais ? (Object.keys(c.materiais) as MaterialKey[]) : [];

  useEffect(() => {
    if (keys.length && !active) setActive(keys[0]);
  }, [keys, active]);

  // Clear audio when switching campaigns
  useEffect(() => {
    setAudioSrc(null);
  }, [id]);

  if (!c) return null;

  const hasKey = !!getActiveKey();
  const activeModel = loadAIConfig().model;

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
      setAudioSrc(null); // reset audio when script changes
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }

  function gerarMock() {
    store.generateMaterials(id);
    toast.success("Materiais de exemplo gerados (mock).");
    setActive("");
    setAudioSrc(null);
  }

  async function gerarAudio() {
    const script = edited["podcast_revendedores"] ?? c?.materiais?.["podcast_revendedores"] ?? "";
    if (!script) {
      toast.error("Gere o roteiro do podcast antes de converter para áudio.");
      return;
    }
    if (!loadAIConfig().groqKey) {
      toast.error("TTS requer a chave Groq. Configure em ⚙️ Configurações.");
      return;
    }
    setTtsLoading(true);
    try {
      const dataUrl = await generatePodcastAudio(script);
      setAudioSrc(dataUrl);
      toast.success("Áudio gerado com sucesso! 🎙️");
      // Auto-play after a short delay
      setTimeout(() => audioRef.current?.play(), 300);
    } catch (err) {
      toast.error(`Erro ao gerar áudio: ${(err as Error).message}`);
    } finally {
      setTtsLoading(false);
    }
  }

  function downloadAudio() {
    if (!audioSrc) return;
    const a = document.createElement("a");
    a.href = audioSrc;
    a.download = `${c!.nome.replace(/[^a-z0-9]+/gi, "_")}_podcast.wav`;
    a.click();
    toast.success("Download do áudio iniciado");
  }

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
      {/* Generation progress overlay */}
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

      {/* Regenerate button */}
      <div className="flex justify-end gap-2">
        {hasKey ? (
          <Button size="sm" onClick={gerarComIA} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Regerar com IA
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
                  {/* TTS button — only on podcast tab */}
                  {k === "podcast_revendedores" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={gerarAudio}
                      disabled={ttsLoading}
                      className="border-violet-500/40 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950"
                    >
                      {ttsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                      {ttsLoading ? "Gerando áudio…" : "🎙️ Gerar Áudio"}
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
                {/* Audio player — rendered only after TTS is generated, on podcast tab */}
                {k === "podcast_revendedores" && audioSrc && (
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-violet-700 dark:text-violet-300 flex items-center gap-2">
                        <Mic className="h-4 w-4" /> Áudio gerado · Orpheus TTS
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={downloadAudio}
                        className="text-violet-600 hover:text-violet-800 h-7 px-2"
                      >
                        <Download className="h-3 w-3 mr-1" /> .wav
                      </Button>
                    </div>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio
                      ref={audioRef}
                      controls
                      src={audioSrc}
                      className="w-full h-10 accent-violet-600"
                    />
                    <p className="text-xs text-muted-foreground">
                      Voz: Celeste (PT-BR) · Modelo: PlayAI TTS via Groq · Formato: WAV
                    </p>
                  </div>
                )}

                {/* TTS loading state */}
                {k === "podcast_revendedores" && ttsLoading && (
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4">
                    <div className="flex items-center gap-3 text-sm text-violet-600 dark:text-violet-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Convertendo roteiro em áudio via Groq TTS… Pode levar até 30 segundos.
                    </div>
                  </div>
                )}

                <Textarea
                  value={edited[k] ?? c.materiais?.[k] ?? ""}
                  onChange={(e) => setEdited((prev) => ({ ...prev, [k]: e.target.value }))}
                  rows={isPodcastTab ? 16 : 22}
                  className="font-mono text-sm leading-relaxed"
                  placeholder={
                    k === "podcast_revendedores"
                      ? "Roteiro do podcast aparece aqui. Edite o texto e clique em 🎙️ Gerar Áudio para converter."
                      : ""
                  }
                />

                {k === "podcast_revendedores" && !audioSrc && !ttsLoading && (
                  <p className="text-xs text-muted-foreground text-center">
                    💡 Edite o roteiro acima se necessário e clique em{" "}
                    <strong>🎙️ Gerar Áudio</strong> para criar o arquivo WAV (requer chave Groq).
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
