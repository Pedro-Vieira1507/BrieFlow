import { createFileRoute, Link } from "@tanstack/react-router";
import { useCampaign, MATERIAL_META, type MaterialKey, store } from "@/lib/store";
import { generateAllMaterials, type GenerationProgress } from "@/lib/generateMaterials";
import { getActiveKey, loadAIConfig } from "@/lib/aiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Copy, Download, Sparkles, Loader2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/campanha/$id/materiais")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const c = useCampaign(id);
  const [active, setActive] = useState<MaterialKey | "">("");
  const [edited, setEdited] = useState<Partial<Record<MaterialKey, string>>>({});
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const keys = c?.materiais ? (Object.keys(c.materiais) as MaterialKey[]) : [];

  useEffect(() => {
    if (keys.length && !active) setActive(keys[0]);
  }, [keys, active]);

  if (!c) return null;

  const hasKey = !!getActiveKey();
  const activeModel = loadAIConfig().model;

  async function gerarComIA() {
    if (!c?.brief) return toast.error("Configure o brief antes de gerar materiais.");
    if (!hasKey) return toast.error("Configure sua chave de API em Configurações.");
    setGenerating(true);
    setProgress(null);
    try {
      const materiais = await generateAllMaterials(c.brief, (p) => setProgress(p));
      store.update(id, { materiais, status: "materiais_gerados" });
      toast.success("Todos os materiais gerados com sucesso!");
      setActive("");
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }

  function gerarMock() {
    store.generateMaterials(id);
    toast.success("Materiais de exemplo gerados (mock).");
    setActive("");
  }

  if (keys.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Nenhum material gerado ainda.</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button asChild variant="outline">
              <Link to="/campanha/$id/brief" params={{ id }}>Abrir brief</Link>
            </Button>
            {hasKey ? (
              <Button onClick={gerarComIA} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar com IA ({activeModel})
              </Button>
            ) : (
              <Button variant="outline" onClick={gerarMock}>
                <Zap className="h-4 w-4" /> Usar exemplo (mock)
              </Button>
            )}
          </div>
          {!hasKey && (
            <p className="text-xs text-muted-foreground">
              <a href="/configuracoes" className="underline">Configure sua chave de API</a> para gerar materiais reais.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const currentKey = (active || keys[0]) as MaterialKey;
  const content = edited[currentKey] ?? c.materiais?.[currentKey] ?? "";

  function copy() {
    navigator.clipboard.writeText(content);
    toast.success("Conteúdo copiado");
  }
  function download() {
    const ext = MATERIAL_META[currentKey].ext;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c!.nome.replace(/[^a-z0-9]+/gi, "_")}_${currentKey}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download iniciado");
  }

  return (
    <div className="space-y-4">
      {/* Generation progress overlay */}
      {generating && progress && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Gerando: {progress.label}
              <span className="ml-auto text-xs text-muted-foreground">{progress.current}/{progress.total}</span>
            </div>
            <Progress value={Math.round((progress.current / progress.total) * 100)} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Regenerate button */}
      <div className="flex justify-end gap-2">
        {hasKey ? (
          <Button size="sm" onClick={gerarComIA} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Regerar com IA
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={gerarMock}>
            <Zap className="h-4 w-4" /> Regerar mock
          </Button>
        )}
      </div>

      <Tabs value={currentKey} onValueChange={(v) => setActive(v as MaterialKey)}>
        <div className="overflow-x-auto pb-1 scrollbar-thin">
          <TabsList className="inline-flex w-max">
            {keys.map((k) => (
              <TabsTrigger key={k} value={k} className="whitespace-nowrap">
                {MATERIAL_META[k].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {keys.map((k) => (
          <TabsContent key={k} value={k} className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{MATERIAL_META[k].label}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{MATERIAL_META[k].descricao} · Exporta como .{MATERIAL_META[k].ext}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={copy}>
                    <Copy className="h-4 w-4" /> Copiar
                  </Button>
                  <Button size="sm" onClick={download}>
                    <Download className="h-4 w-4" /> Baixar .{MATERIAL_META[k].ext}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={edited[k] ?? c.materiais?.[k] ?? ""}
                  onChange={(e) => setEdited((prev) => ({ ...prev, [k]: e.target.value }))}
                  rows={22}
                  className="font-mono text-sm leading-relaxed"
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
