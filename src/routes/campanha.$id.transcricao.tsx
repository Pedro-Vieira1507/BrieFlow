import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCampaign, store, inferBriefFromTranscript } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Sparkles, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/campanha/$id/transcricao")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const c = useCampaign(id);
  const nav = useNavigate();
  const [text, setText] = useState(c?.transcricao ?? "");

  useEffect(() => {
    setText(c?.transcricao ?? "");
  }, [c?.transcricao]);

  if (!c) return null;

  function salvar() {
    store.setTranscricao(id, text);
    toast.success("Transcrição salva");
  }

  function gerarBrief() {
    if (!text.trim()) return toast.error("Transcrição vazia.");
    store.setTranscricao(id, text);
    const brief = inferBriefFromTranscript(c?.nome ?? "Campanha", text);
    brief.campanha = c?.nome ?? brief.campanha;
    store.setBrief(id, brief);
    toast.success("Brief estruturado gerado pela IA");
    nav({ to: "/campanha/$id/brief", params: { id } });
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
            <Button size="sm" onClick={gerarBrief}>
              <Sparkles className="h-4 w-4" /> Gerar brief
            </Button>
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
