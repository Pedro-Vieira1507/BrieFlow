import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCampaign, store, inferBriefFromTranscript, type StructuredBrief } from "@/lib/store";
import { inferBriefFromTranscriptAI } from "@/lib/generateMaterials";
import { getActiveKey } from "@/lib/aiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Sparkles, Save, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/campanha/$id/transcricao")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const c = useCampaign(id);
  const nav = useNavigate();
  const [text, setText] = useState(c?.transcricao ?? "");
  const [inferring, setInferring] = useState(false);

  useEffect(() => {
    setText(c?.transcricao ?? "");
  }, [c?.transcricao]);

  if (!c) return null;

  const hasKey = !!getActiveKey();

  function salvar() {
    store.setTranscricao(id, text);
    toast.success("Transcrição salva");
  }

  // Lightweight local inference (no API)
  function gerarBriefLocal() {
    if (!text.trim()) return toast.error("Transcrição vazia.");
    store.setTranscricao(id, text);
    const brief = inferBriefFromTranscript(c?.nome ?? "Campanha", text);
    brief.campanha = c?.nome ?? brief.campanha;
    store.setBrief(id, brief);
    toast.success("Brief gerado localmente (heurística).");
    nav({ to: "/campanha/$id/brief", params: { id } });
  }

  // AI-powered inference
  async function gerarBriefIA() {
    if (!text.trim()) return toast.error("Transcrição vazia.");
    setInferring(true);
    try {
      store.setTranscricao(id, text);
      const raw = await inferBriefFromTranscriptAI(c?.nome ?? "Campanha", text);
      let brief: StructuredBrief;
      try {
        brief = JSON.parse(raw);
      } catch {
        // Gemini sometimes wraps JSON in markdown fences
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        brief = JSON.parse(match?.[1] ?? raw);
      }
      brief.campanha = c?.nome ?? brief.campanha;
      store.setBrief(id, brief);
      toast.success("Brief gerado pela IA com sucesso!");
      nav({ to: "/campanha/$id/brief", params: { id } });
    } catch (err) {
      toast.error(`Erro ao gerar brief: ${(err as Error).message}`);
    } finally {
      setInferring(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Revisão da transcrição</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={salvar}>
              <Save className="h-4 w-4" /> Salvar
            </Button>
            {hasKey ? (
              <Button size="sm" onClick={gerarBriefIA} disabled={inferring}>
                {inferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar brief com IA
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={gerarBriefLocal}>
                <Zap className="h-4 w-4" /> Gerar brief (local)
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={22}
            className="font-mono text-sm leading-relaxed"
            placeholder="A transcrição aparecerá aqui. Você pode editar livremente antes de gerar o brief."
          />
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sobre a transcrição</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              A IA usa <strong>esse texto</strong> como fonte primária do brief. Quanto mais limpo e completo, melhores os materiais.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Remova ruídos, falas duplicadas e digressões.</li>
              <li>Mantenha nomes de produtos e SKUs corretos.</li>
              <li>Confirme números, prazos e mecânicas promocionais.</li>
            </ul>
            {!hasKey && (
              <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
                Sem chave de API: o brief será gerado por heurística local.
                <a href="/configuracoes" className="underline ml-1">Configurar IA</a>
              </div>
            )}
          </CardContent>
        </Card>
        {c.brief && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brief já gerado</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground">Esta campanha já tem um brief estruturado.</p>
              <Button asChild variant="outline" size="sm">
                <Link to="/campanha/$id/brief" params={{ id }}>Abrir brief</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
