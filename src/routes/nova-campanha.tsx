import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell, PageContainer, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stepper } from "@/components/Stepper";
import { store, type SourceFile } from "@/lib/store";
import { transcribeFile, isTranscribable, type WhisperProgress } from "@/lib/whisper";
import { getOpenAIKey } from "@/lib/aiConfig";
import { useRef, useState } from "react";
import { CloudUpload, FileText, FolderInput, Loader2, Mic, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/nova-campanha")({
  head: () => ({
    meta: [
      { title: "Nova campanha — Agente de Conteúdo Forlab" },
      { name: "description", content: "Envie vídeo, áudio, texto ou conecte uma pasta do Drive para iniciar uma nova campanha." },
    ],
  }),
  component: NovaCampanha,
});

function detectType(name: string): SourceFile["type"] {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["mp4", "mov", "webm"].includes(ext ?? "")) return "video";
  if (["mp3", "wav", "m4a"].includes(ext ?? "")) return "audio";
  if (ext === "json") return "json";
  return "texto";
}

const WHISPER_STAGE_LABEL: Record<WhisperProgress["stage"], string> = {
  compressing: "Comprimindo arquivo...",
  uploading: "Enviando para Whisper...",
  transcribing: "Transcrevendo com IA...",
  done: "Transcrição concluída!",
};

function NovaCampanha() {
  const nav = useNavigate();
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [drivePath, setDrivePath] = useState("");
  const [processing, setProcessing] = useState(false);
  const [whisperStage, setWhisperStage] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasOpenAIKey = !!getOpenAIKey();

  async function processArquivo() {
    if (!nome.trim()) return toast.error("Informe o nome da campanha.");
    if (!file) return toast.error("Selecione um arquivo.");

    const source: SourceFile = {
      name: file.name,
      type: detectType(file.name),
      sizeKb: Math.round(file.size / 1024),
    };

    setProcessing(true);

    // If file is audio/video and OpenAI key is available, use Whisper
    if (isTranscribable(file) && hasOpenAIKey) {
      try {
        setWhisperStage("Preparando transcrição Whisper...");
        const result = await transcribeFile(file, (p) => {
          setWhisperStage(WHISPER_STAGE_LABEL[p.stage]);
        });
        const created = store.create({ nome, source, transcricao: result.text });
        toast.success(
          `Transcrição concluída${result.duration ? ` (${Math.round(result.duration)}s de áudio)` : ""}.`,
        );
        nav({ to: "/campanha/$id/transcricao", params: { id: created.id } });
      } catch (err) {
        toast.error((err as Error).message);
        setProcessing(false);
        setWhisperStage(null);
      }
      return;
    }

    // Fallback: create with mock transcription placeholder
    setWhisperStage(null);
    const created = store.create({ nome, source });
    setTimeout(() => {
      store.setTranscricao(
        created.id,
        isTranscribable(file)
          ? `[Configure sua chave OpenAI em Configurações para transcrição automática via Whisper.]\n\n` +
            `Arquivo: ${file.name} (${Math.round(file.size / 1024)} KB)\n` +
            `Cole ou edite a transcrição manualmente abaixo.`
          : `Arquivo de texto "${file.name}" carregado. Substitua por conteúdo real.`,
      );
      nav({ to: "/campanha/$id/transcricao", params: { id: created.id } });
    }, 400);
  }

  function processTexto() {
    if (!nome.trim()) return toast.error("Informe o nome da campanha.");
    if (!texto.trim()) return toast.error("Cole o conteúdo do briefing.");
    setProcessing(true);
    const source: SourceFile = { name: "briefing-colado.txt", type: "texto", sizeKb: Math.round(texto.length / 1024) };
    const created = store.create({ nome, source, transcricao: texto });
    nav({ to: "/campanha/$id/transcricao", params: { id: created.id } });
  }

  function processDrive() {
    if (!nome.trim()) return toast.error("Informe o nome da campanha.");
    if (!drivePath.trim()) return toast.error("Informe a pasta do Drive.");
    setProcessing(true);
    const source: SourceFile = { name: drivePath, type: "drive" };
    const created = store.create({ nome, source });
    nav({ to: "/campanha/$id/transcricao", params: { id: created.id } });
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Nova campanha"
          description="Envie um arquivo, cole um briefing ou conecte uma pasta do Drive para começar."
        />

        <Card className="mb-6">
          <CardContent className="p-5">
            <Stepper
              currentIndex={0}
              steps={[
                { key: "entrada", label: "Entrada" },
                { key: "transcricao", label: "Transcrição" },
                { key: "brief", label: "Brief estruturado" },
                { key: "materiais", label: "Materiais" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da campanha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da campanha</Label>
              <Input
                id="nome"
                placeholder="Ex.: Pipetadores DLAB — Compre 3 Leve 4"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <Tabs defaultValue="arquivo">
              <TabsList>
                <TabsTrigger value="arquivo">Upload de arquivo</TabsTrigger>
                <TabsTrigger value="texto">Colar texto</TabsTrigger>
                <TabsTrigger value="drive">Google Drive</TabsTrigger>
              </TabsList>

              <TabsContent value="arquivo" className="mt-4 space-y-4">
                {/* Whisper status banner */}
                {!hasOpenAIKey && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                    <span>
                      Chave OpenAI não configurada — vídeos e áudios serão importados sem transcrição automática.
                      <a href="/configuracoes" className="underline ml-1">Configurar agora</a>
                    </span>
                  </div>
                )}
                {hasOpenAIKey && (
                  <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent-foreground">
                    <Mic className="h-4 w-4 text-accent" />
                    Whisper ativo — vídeos e áudios serão transcritos automaticamente.
                  </div>
                )}

                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) setFile(f);
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors " +
                    (drag ? "border-accent bg-accent/5" : "border-border hover:border-accent/60")
                  }
                >
                  <div className="mx-auto h-11 w-11 rounded-full bg-accent/15 grid place-items-center text-accent">
                    <CloudUpload className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm font-medium">
                    {file ? file.name : "Arraste e solte um arquivo aqui"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Aceitos: .mp4, .mp3, .wav, .m4a, .txt, .docx, .json (máx. 25 MB para áudio/vídeo)
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept=".mp4,.mp3,.wav,.m4a,.txt,.docx,.json,.mov,.webm"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                {/* Progress indicator */}
                {whisperStage && (
                  <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    {whisperStage}
                  </div>
                )}

                <Button onClick={processArquivo} disabled={processing} className="w-full sm:w-auto">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                  Processar campanha
                </Button>
              </TabsContent>

              <TabsContent value="texto" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="texto">Conteúdo do briefing / transcrição</Label>
                  <Textarea
                    id="texto"
                    rows={10}
                    placeholder="Cole aqui o conteúdo da reunião, briefing comercial, e-mail ou anotações…"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                  />
                </div>
                <Button onClick={processTexto} disabled={processing}>
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Processar campanha
                </Button>
              </TabsContent>

              <TabsContent value="drive" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="drive">Caminho ou link da pasta no Google Drive</Label>
                  <Input
                    id="drive"
                    placeholder="Ex.: /Forlab/Campanhas/2025-04 — DLAB Pipetadores"
                    value={drivePath}
                    onChange={(e) => setDrivePath(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A pasta será monitorada por novos arquivos. Configure a integração em Configurações.
                  </p>
                </div>
                <Button onClick={processDrive} disabled={processing}>
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
                  Conectar pasta
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
