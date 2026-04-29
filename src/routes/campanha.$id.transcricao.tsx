import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCampaign, store, inferBriefFromTranscript, type StructuredBrief } from "@/lib/store";
import { inferBriefFromTranscriptAI } from "@/lib/generateMaterials";
import { getActiveKey } from "@/lib/aiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
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

  // Ref gives us the CURRENT textarea value regardless of React render timing.
  // useSyncExternalStore can force a re-render between setState and the next
  // event-handler execution, causing a stale-closure where `text` is still "".
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Only initialise from store on first load (or when campaign switches).
  // We deliberately avoid resetting after every store.emit() to prevent
  // overwriting text the user has already typed.
  const initializedId = useRef("");
  useEffect(() => {
    if (initializedId.current !== id) {
      setText(c?.transcricao ?? "");
      initializedId.current = id;
    }
  }, [id, c?.transcricao]);

  if (!c) return null;

  const hasKey = !!getActiveKey();

  /** Returns the most up-to-date text: DOM first, then React state. */
  function currentText(): string {
    return textareaRef.current?.value ?? text;
  }

  function salvar() {
    const t = currentText();
    setText(t);
    store.setTranscricao(id, t);
    toast.success("Transcrição salva");
  }

  // Lightweight local inference (no API)
  function gerarBriefLocal() {
    const t = currentText();
    if (!t.trim()) return toast.error("Transcrição vazia.");
    setText(t);
    store.setTranscricao(id, t);
    const brief = inferBriefFromTranscript(c?.nome ?? "Campanha", t);
    brief.campanha = c?.nome ?? brief.campanha;
    store.setBrief(id, brief);
    toast.success("Brief gerado localmente (heurística).");
    nav({ to: "/campanha/$id/brief", params: { id } });
  }

  // AI-powered inference
  async function gerarBriefIA() {
    // Always read from DOM ref to bypass stale-closure issues
    const t = currentText();
    if (!t.trim()) return toast.error("Transcrição vazia.");
    setInferring(true);
    try {
      // Persist to store before API call (status update triggers re-render,
      // but we already captured `t` from the DOM — safe)
      setText(t);
      store.setTranscricao(id, t);

      const raw = await inferBriefFromTranscriptAI(c?.nome ?? "Campanha", t);
      let brief: StructuredBrief;
      try {
        brief = JSON.parse(raw);
      } catch {
        // Some models wrap JSON in markdown fences
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
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={22}
            className="font-mono text-sm leading-relaxed"
            placeholder="Cole aqui a transcrição ou resumo da reunião. A IA usará esse texto para estruturar o brief."
          />
          {text.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground text-right">
              {text.length.toLocaleString("pt-BR")} caracteres
            </p>
          )}
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
