import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageContainer, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MATERIAL_META, type MaterialKey } from "@/lib/store";
import { useState } from "react";
import { Save } from "lucide-react";
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
  emails_cliente_final: "Crie 3 e-mails para cliente final: apresentação, diferenciais e conversão.",
  posts_linkedin: "Crie 2 posts profissionais para LinkedIn baseados no brief.",
  posts_facebook: "Crie 2 posts curtos para Facebook baseados no brief.",
  posts_instagram: "Crie 2 ideias de posts para Instagram (carrossel e reels).",
  roteiro_video_curto: "Crie um roteiro de vídeo curto (15–30s) com tempo, ação na tela e locução.",
};

function Configuracoes() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [drive, setDrive] = useState(false);
  const [drivePath, setDrivePath] = useState("/Forlab/Campanhas");
  const [outDir, setOutDir] = useState("/Forlab/Materiais");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);

  function salvar() {
    toast.success("Configurações salvas (mock).");
  }

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Configurações"
          description="Conecte APIs, escolha o modelo de IA e edite os templates de prompt usados pelo agente."
          actions={<Button onClick={salvar}><Save className="h-4 w-4" /> Salvar</Button>}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Chaves de API</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>OpenAI</Label>
                <Input type="password" placeholder="sk-…" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Google Gemini</Label>
                <Input type="password" placeholder="AIza…" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">As chaves são armazenadas com segurança e nunca expostas ao cliente final.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Modelo de IA</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Modelo padrão</Label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (rápido)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (qualidade)</option>
                  <option value="gpt-5-mini">GPT-5 Mini</option>
                  <option value="gpt-5">GPT-5</option>
                </select>
              </div>
              <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                A transcrição usa Whisper local ou cloud. O modelo aqui é usado para gerar o brief e os materiais.
              </div>
            </CardContent>
          </Card>

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

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Templates de prompt</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Prompt do brief estruturado</Label>
                <Textarea rows={4} value={prompts.brief} onChange={(e) => setPrompts({ ...prompts, brief: e.target.value })} className="text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(MATERIAL_META) as MaterialKey[]).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label>{MATERIAL_META[k].label}</Label>
                    <Textarea rows={3} value={prompts[k]} onChange={(e) => setPrompts({ ...prompts, [k]: e.target.value })} className="text-sm" />
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
