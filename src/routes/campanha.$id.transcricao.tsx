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
  const [charCount, setCharCount] = useState((c?.transcricao ?? "").length);
  const [inferring, setInferring] = useState(false);

  // Three-layer text capture to beat any React / iframe / sandbox issue:
  // 1. latestText — plain JS ref updated on every input event (native, pre-React)
  // 2. textareaRef — DOM element ref for direct .value access
  // 3. text       — React state (stale-closure fallback)
  const latestText = useRef(c?.transcricao ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Always returns the most up-to-date textarea content. */
  function currentText(): string {
    return (
      latestText.current ||
      textareaRef.current?.value ||
      text
    );
  }

  // Initialise once per campaign, never reset while the user is typing.
  const initializedId = useRef("");
  useEffect(() => {
    if (initializedId.current !== id) {
      const t = c?.transcricao ?? "";
      setText(t);
      latestText.current = t;
      setCharCount(t.length);
      initializedId.current = id;
    }
  }, [id, c?.transcricao]);

  if (!c) return null;

  const hasKey = !!getActiveKey();

  function handleChange(value: string) {
    latestText.current = value; // always update ref first
    setText(value);
    setCharCount(value.length);
  }

  /** Native onInput handler — fires even when React synthetic events are suppressed in sandboxed iframes. */
  function handleNativeInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const value = (e.target as HTMLTextAreaElement).value;
    latestText.current = value;
    setCharCount(value.length);
  }

  function salvar() {
    const t = currentText();
    setText(t);
    latestText.current = t;
    store.setTranscricao(id, t);
    toast.success("Transcrição salva");
  }

  function gerarBriefLocal() {
    const t = currentText();
    if (!t.trim()) return toast.error("Transcrição vazia.");
    setText(t);
    latestText.current = t;
    store.setTranscricao(id, t);
    const brief = inferBriefFromTranscript(c?.nome ?? "Campanha", t);
    brief.campanha = c?.nome ?? brief.campanha;
    store.setBrief(id, brief);
    toast.success("Brief gerado localmente (heurística).");
    nav({ to: "/campanha/$id/brief", params: { id } });
  }

  async function gerarBriefIA() {
    // Capture text through all three layers before any async/state operation
    const t = currentText();
    if (!t.trim()) return toast.error("Transcrição vazia.");

    setInferring(true);
    try {
      store.setTranscricao(id, t); // persist (triggers re-render — safe, t is already captured)
      const raw = await inferBriefFromTranscriptAI(c?.nome ?? "Campanha", t);

      let brief: StructuredBrief;
      try {
        brief = JSON.parse(raw);
      } catch {
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
                {inferring
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sparkles className="h-4 w-4" />}
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
            onChange={(e) => handleChange(e.target.value)}
            onInput={handleNativeInput}
            rows={22}
            className="font-mono text-sm leading-relaxed"
            placeholder="Cole aqui a transcrição ou resumo da reunião. A IA usará esse texto para estruturar o brief."
          />
          <p className="mt-1.5 text-xs text-muted-foreground text-right">
            {charCount > 0
              ? <span className="text-foreground font-medium">{charCount.toLocaleString("pt-BR")} caracteres capturados ✔</span>
              : "Cole a transcrição acima antes de gerar o brief"}
          </p>
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
