import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCampaign, store, inferBriefFromTranscript, type StructuredBrief } from "@/lib/store";
import { inferBriefFromTranscriptAI } from "@/lib/generateMaterials";
import { getActiveKey } from "@/lib/aiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Sparkles, Save, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/campanha/$id/transcricao")({
  component: Page,
});

/**
 * Normalizes the raw JSON returned by the AI into a valid StructuredBrief.
 *
 * Problems solved:
 * - AI may use singular 'beneficio_cliente_final' instead of the plural
 *   'beneficios_cliente_final' expected by the TypeScript type.
 * - Any array field may be missing or null — default to [].
 * - objecoes_argumentos items may have different key names.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBrief(raw: any): StructuredBrief {
  const toArr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as string[]) : [];

  const toObjArr = (
    v: unknown,
  ): { objecao: string; argumento: string }[] => {
    if (!Array.isArray(v)) return [];
    return (v as Record<string, string>[]).map((item) => ({
      objecao: item.objecao ?? item.objeção ?? item.objecoes ?? "",
      argumento: item.argumento ?? item.argumentos ?? "",
    }));
  };

  return {
    marca: raw.marca ?? "",
    campanha: raw.campanha ?? "",
    publico_alvo: raw.publico_alvo ?? raw.publico ?? "",
    proposta_comercial: raw.proposta_comercial ?? raw.proposta ?? "",
    oferta_promocional: raw.oferta_promocional ?? raw.oferta ?? "",
    subcategorias: toArr(raw.subcategorias),
    diferenciais_tecnicos: toArr(
      raw.diferenciais_tecnicos ?? raw.diferenciais,
    ),
    beneficios_revendedor: toArr(
      raw.beneficios_revendedor ?? raw.beneficios_revendedores,
    ),
    // Support both plural and singular forms returned by the AI
    beneficios_cliente_final: toArr(
      raw.beneficios_cliente_final ?? raw.beneficio_cliente_final,
    ),
    objecoes_argumentos: toObjArr(
      raw.objecoes_argumentos ?? raw.objecoes,
    ),
    tom_comunicacao: raw.tom_comunicacao ?? raw.tom ?? "",
    observacoes: raw.observacoes ?? raw.observacao ?? "",
    inferencias_ia: toArr(
      raw.inferencias_ia ?? raw.inferencias,
    ),
  };
}

function Page() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const c = useCampaign(id);
  const hasKey = !!getActiveKey();

  const [text, setText] = useState<string>(c?.transcricao ?? "");
  const [inferring, setInferring] = useState(false);

  if (!c) return <p className="p-8 text-muted-foreground">Campanha não encontrada.</p>;

  function salvar() {
    store.setTranscricao(id, text);
    toast.success("Transcrição salva");
  }

  async function gerarBriefIA() {
    if (!text.trim()) return toast.error("Transcrição vazia. Cole o conteúdo antes de gerar.");
    setInferring(true);
    try {
      store.setTranscricao(id, text);
      const raw = await inferBriefFromTranscriptAI(c!.nome, text);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(raw.slice(0, 200));
        parsed = JSON.parse(match[0]);
      }
      const brief: StructuredBrief = normalizeBrief(parsed);
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
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link to="/campanha/$id/transcricao" params={{ id }} className="text-sm text-muted-foreground hover:underline">
          ← {c.nome}
        </Link>
        <h1 className="text-2xl font-bold mt-1">Transcrição</h1>
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
            onChange={e => setText(e.target.value)}
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
