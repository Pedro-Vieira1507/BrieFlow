import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageContainer, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MATERIAL_META, type MaterialKey } from "@/lib/store";
import { loadAIConfig, saveAIConfig, type AIConfig, type AIModel } from "@/lib/aiConfig";
import { useState } from "react";
import { Save, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Agente de Conteúdo Forlab" },
      { name: "description", content: "Chaves de API, integração Google Drive, modelo de IA e templates de prompt." },
    ],
  }),
  component: Configuracoes,
});

const DEFAULT_PROMPTS: Record<"brief" | MaterialKey, string> = {
  brief: "A partir da transcrição/briefing fornecida, extraia um JSON estruturado com marca, campanha, público-alvo, proposta comercial, oferta promocional, subcategorias citadas, diferenciais técnicos, benefícios para revendedor e cliente final, objeções e argumentos, tom de comunicação e observações. Não invente categorias fixas — use estritamente o que está no conteúdo. Marque inferências.",
  podcast_revendedores: "Crie um roteiro de podcast de 5 minutos para revendedores, com intro, 3 blocos temáticos e CTA, baseado no brief estruturado.",
  apresentacao_slides: "Gere 10 slides estruturados para revendedores, com título e bullets por slide.",
  folheto_a4: "Crie texto de folheto A4 promocional para cliente final, com título, subtítulo, bloco principal, destaques técnicos e CTA.",
  ficha_tecnica: "Crie ficha técnica interna para vendedores com SKUs, mecânica, vigência, pontos fortes e quebra de objeções.",
  emails_revendedores: "Crie 2 e-mails para revendedores: anúncio e reforço/urgência.",
  emails_cliente_final: "Crie 3 e-mails para cliente final: topo de funil (apresentação + ecossistema Forlab), meio de funil (diferenciais técnicos vs. concorrentes) e fundo de funil (oferta).",
  posts_linkedin: "Crie 2 posts profissionais para LinkedIn baseados no brief.",
  posts_facebook: "Crie 2 posts curtos para Facebook baseados no brief.",
  posts_instagram: "Crie 2 ideias de posts para Instagram (carrossel e reels).",
  roteiro_video_curto: "Crie um roteiro de vídeo curto (15–30s) com tempo, ação na tela e locução.",
};

function Configuracoes() {
  const saved = loadAIConfig();
  const [openaiKey, setOpenaiKey] = useState(saved.openaiKey);
  const [geminiKey, setGeminiKey] = useState(saved.geminiKey);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [drive, setDrive] = useState(saved.driveEnabled);
  const [drivePath, setDrivePath] = useState(saved.drivePath);
  const [outDir, setOutDir] = useState(saved.driveOutDir);
  const [model, setModel] = useState<AIModel>(saved.model);
  const [prompts, setPrompts] = useState<Record<string, string>>({
    ...DEFAULT_PROMPTS,
    ...saved.prompts,
  });
  const [saved2, setSaved2] = useState(false);

  function salvar() {
    const config: AIConfig = {
      openaiKey,
      geminiKey,
      model,
      driveEnabled: drive,
      drivePath,
      driveOutDir: outDir,
      prompts,
    };
    saveAIConfig(config);
    setSaved2(true);
    setTimeout(() => setSaved2(false), 2500);
    toast.success("Configurações salvas com sucesso.");
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Configurações"
          description="Conecte APIs, escolha o modelo de IA e edite os templates de prompt usados pelo agente."
          actions={
            <Button onClick={salvar}>
              {saved2 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* API Keys */}
          <Card>
            <CardHeader><CardTitle className="text-base">Chaves de API</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>OpenAI (Whisper + GPT)</Label>
                <div className="relative">
                  <Input
                    type={showOpenai ? "text" : "password"}
                    placeholder="sk-…"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenai((v) => !v)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Usada para transcrição Whisper e modelos GPT.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Google Gemini</Label>
                <div className="relative">
                  <Input
                    type={showGemini ? "text" : "password"}
                    placeholder="AIza…"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGemini((v) => !v)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showGemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Usada para modelos Gemini 2.5.</p>
              </div>
              <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
                ⚠️ Chaves salvas no <strong>localStorage</strong> do navegador. Para produção, prefira um backend seguro.
              </p>
            </CardContent>
          </Card>

          {/* Model selector */}
          <Card>
            <CardHeader><CardTitle className="text-base">Modelo de IA</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Modelo padrão</Label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as AIModel)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash — rápido, econômico</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro — máxima qualidade</option>
                  <option value="gpt-4o-mini">GPT-4o Mini — rápido + Whisper</option>
                  <option value="gpt-4o">GPT-4o — qualidade + Whisper</option>
                </select>
              </div>
              <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
                <p>🎤 <strong>Whisper</strong> usa sempre a chave OpenAI (obrigatório para transcrição).</p>
                <p>🤖 <strong>Brief e materiais</strong> usam o modelo selecionado acima.</p>
                <p>💰 Gemini 2.5 Flash é o mais economíco para produzir os 10 materiais.</p>
              </div>
            </CardContent>
          </Card>

          {/* Google Drive */}
          <Card>
            <CardHeader><CardTitle className="text-base">Google Drive</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Monitoramento de pasta</div>
                  <div className="text-xs text-muted-foreground">Cria campanhas automaticamente para novos arquivos.</div>
                </div>
                <Switch checked={drive} onCheckedChange={setDrive} />
              </div>
              <div className="space-y-1.5">
                <Label>Pasta monitorada</Label>
                <Input value={drivePath} onChange={(e) => setDrivePath(e.target.value)} disabled={!drive} />
              </div>
              <div className="space-y-1.5">
                <Label>Pasta padrão de saída</Label>
                <Input value={outDir} onChange={(e) => setOutDir(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Prompt templates */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Templates de prompt</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Prompt do brief estruturado</Label>
                <Textarea
                  rows={4}
                  value={prompts["brief"] ?? DEFAULT_PROMPTS.brief}
                  onChange={(e) => setPrompts({ ...prompts, brief: e.target.value })}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">Deixe em branco para usar o prompt padrão completo do sistema.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(MATERIAL_META) as MaterialKey[]).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label>{MATERIAL_META[k].label}</Label>
                    <Textarea
                      rows={3}
                      value={prompts[k] ?? DEFAULT_PROMPTS[k] ?? ""}
                      onChange={(e) => setPrompts({ ...prompts, [k]: e.target.value })}
                      className="text-sm"
                      placeholder="Deixe em branco para usar o prompt padrão."
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </AppShell>
  );
}
