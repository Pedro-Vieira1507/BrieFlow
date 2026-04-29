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

  // DOM ref is the single source of truth — it reflects exactly what the user sees,
  // regardless of React state timing or iframe sandboxing issues.
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Always returns the current textarea content.
   * Priority: DOM element value (ground truth) > React state.
   * The DOM value is what was last rendered/typed, including pastes that may
   * not have triggered React’s synthetic onChange in sandboxed environments.
   */
  function currentText(): string {
    return textareaRef.current?.value ?? text;
  }

  // Initialise text from store on first load for this campaign only.
  // Never auto-reset while the user is actively editing.
  const initializedId = useRef("");
  useEffect(() => {
    if (initializedId.current !== id) {
      const t = c?.transcricao ?? "";
      setText(t);
      setCharCount(t.length);
      initializedId.current = id;
      // Also seed the DOM node if it already exists
      if (textareaRef.current) textareaRef.current.value = t;
    }
  }, [id, c?.transcricao]);

  if (!c) return null;

  const hasKey = !!getActiveKey();

  /** Called for every keystroke/paste — keep React state and char-counter in sync. */
  function handleChange(value: string) {
    setText(value);
    setCharCount(value.length);
  }

  /**
   * Native onInput — fires even when React synthetic events are suppressed.
   * Updates charCount so the user can verify capture, but doesn’t need to
   * update React state because currentText() reads from the DOM directly.
   */
  function handleNativeInput(e: React.FormEvent<HTMLTextAreaElement>) {
    setCharCount((e.target as HTMLTextAreaElement).value.length);
  }

  function salvar() {
    const t = currentText();
    setText(t);
    store.setTranscricao(id, t);
    toast.success("Transcrição salva");
  }

  function gerarBriefLocal() {
    const t = currentText();
    if (!t.trim()) return toast.error("Transcrição vazia.");
    store.setTranscricao(id, t);
    const brief = inferBriefFromTranscript(c?.nome ?? "Campanha", t);
    brief.campanha = c?.nome ?? brief.campanha;
    store.setBrief(id, brief);
    toast.success("Brief gerado localmente (heurística).");
    nav({ to: "/campanha/$id/brief", params: { id } });
  }

  async function gerarBriefIA() {
    // Read from DOM — immune to React stale-closure and useSyncExternalStore races
    const t = currentText();
    if (!t.trim()) return toast.error("Transcrição vazia.");

    setInferring(true);
    try {
      store.setTranscricao(id, t);
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
          <p className="mt-1.5 text-xs text-right">
            {charCount > 0
              ? <span className="text-foreground font-medium">{charCount.toLocaleString("pt-BR")} caracteres ✔️</span>
              : <span className="text-muted-foreground">Cole a transcrição acima antes de gerar o brief</span>}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sobre a transcrição</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>A IA usa <strong>esse texto</strong> como fonte primária do brief. Quanto mais limpo e completo, melhores os materiais.</p>
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
