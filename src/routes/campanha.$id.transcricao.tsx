import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCampaign, store, inferBriefFromTranscript, type StructuredBrief } from "@/lib/store";
import { inferBriefFromTranscriptAI } from "@/lib/generateMaterials";
import { getActiveKey } from "@/lib/aiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { Sparkles, Save, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/campanha/$id/transcricao")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const c = useCampaign(id);
  const hasKey = !!getActiveKey();

  const [text, setText] = useState<string>("");
  const [inferring, setInferring] = useState(false);

  // sincroniza o textarea quando a campanha carrega do store
  const initializedRef = useRef(false);
  useEffect(() => {
    if (c?.transcricao && !initializedRef.current) {
      setText(c.transcricao);
      initializedRef.current = true;
    }
  }, [c?.transcricao]);

  if (!c) return <p className="text-muted-foreground">Campanha não encontrada.</p>;

  function salvar() {
    store.setTranscricao(id, text);
    toast.success("Transcrição salva");
  }

  async function gerarBriefIA() {
    if (!text.trim()) return toast.error("Transcrição vazia. Cole o conteúdo antes de gerar.");
    setInferring(true);
    try {
      store.setTranscricao(id, text);

      // inferBriefFromTranscriptAI já retorna JSON stringificado e normalizado.
      // NÃO re-parsear nem re-normalizar aqui — isso sobrescreveria o trabalho feito lá.
      const jsonStr = await inferBriefFromTranscriptAI(c!.nome, text);
      const brief: StructuredBrief = JSON.parse(jsonStr) as StructuredBrief;

      // Garante que o campo campanha nunca fique vazio: usa o nome da campanha como fallback
      if (!brief.campanha?.trim()) {
        brief.campanha = c!.nome;
      }

      store.setBrief(id, brief);
      toast.success("Brief gerado pela IA com sucesso!");
      nav({ to: "/campanha/$id/brief", params: { id } });
    } catch (err) {
      toast.error(`Erro ao gerar brief: ${(err as Error).message}`);
    } finally {
      setInferring(false);
    }
  }

  function gerarBriefLocal() {
    if (!text.trim()) return toast.error("Transcrição vazia.");
    store.setTranscricao(id, text);
    const brief = inferBriefFromTranscript(c!.nome, text);
    store.setBrief(id, brief);
    toast.success("Brief gerado localmente!");
    nav({ to: "/campanha/$id/brief", params: { id } });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          Cole ou edite a transcrição da reunião/vídeo. A IA vai extrair o brief automaticamente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conteúdo da transcrição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            placeholder="Cole aqui a transcrição da reunião, script do vídeo ou briefing em texto livre..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y font-mono"
          />
          <p className="text-xs text-muted-foreground">
            {text.length > 0
              ? `${text.length} caracteres capturados ✔`
              : "Nenhum conteúdo ainda."}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={salvar}>
          <Save className="w-4 h-4 mr-2" />
          Salvar
        </Button>

        {hasKey ? (
          <Button onClick={gerarBriefIA} disabled={inferring}>
            {inferring ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando brief...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Gerar brief com IA</>
            )}
          </Button>
        ) : (
          <Button variant="secondary" onClick={gerarBriefLocal}>
            <Zap className="w-4 h-4 mr-2" />
            Gerar brief (local)
          </Button>
        )}

        {hasKey && (
          <Button variant="ghost" size="sm" onClick={gerarBriefLocal} className="text-muted-foreground">
            Gerar sem IA (local)
          </Button>
        )}
      </div>

      {!hasKey && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Configure uma chave de API em{" "}
          <Link to="/configuracoes" className="underline font-medium">
            Configurações
          </Link>{" "}
          para usar geração por IA.
        </p>
      )}
    </div>
  );
}
