import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCampaign, store, type StructuredBrief, MATERIAL_META, type MaterialKey } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { AlertTriangle, Code2, Plus, Save, Sparkles, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { getActiveKey } from "@/lib/aiConfig";
import { generateAllMaterials, type GenerationProgress } from "@/lib/generateMaterials";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/campanha/$id/brief")({
  component: Page,
});

const ALL_MATERIAL_KEYS = Object.keys(MATERIAL_META) as MaterialKey[];

function Page() {
  const { id } = Route.useParams();
  const c = useCampaign(id);
  const nav = useNavigate();
  const hasKey = !!getActiveKey();

  const [brief, setBrief] = useState<StructuredBrief | undefined>(c?.brief);
  const [showJson, setShowJson] = useState(false);

  // Seletor de materiais
  const [showSelector, setShowSelector] = useState(false);
  const [selected, setSelected] = useState<Set<MaterialKey>>(new Set(ALL_MATERIAL_KEYS));

  // Geração
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  useEffect(() => setBrief(c?.brief), [c?.brief]);

  if (!c) return null;
  if (!brief) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Esta campanha ainda não tem brief estruturado.</p>
          <Button asChild>
            <Link to="/campanha/$id/transcricao" params={{ id }}>Ir para a transcrição</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const set = <K extends keyof StructuredBrief>(k: K, v: StructuredBrief[K]) =>
    setBrief({ ...brief, [k]: v });

  const setListItem = (
    k: "subcategorias" | "diferenciais_tecnicos" | "beneficios_revendedor" | "beneficios_cliente_final" | "inferencias_ia",
    i: number,
    v: string,
  ) => {
    const arr = [...(brief[k] ?? [])];
    arr[i] = v;
    set(k, arr as never);
  };
  const addItem = (k: "subcategorias" | "diferenciais_tecnicos" | "beneficios_revendedor" | "beneficios_cliente_final" | "inferencias_ia") => {
    set(k, [...(brief[k] ?? []), ""] as never);
  };
  const delItem = (k: "subcategorias" | "diferenciais_tecnicos" | "beneficios_revendedor" | "beneficios_cliente_final" | "inferencias_ia", i: number) => {
    const arr = [...(brief[k] ?? [])];
    arr.splice(i, 1);
    set(k, arr as never);
  };

  function salvar() {
    store.setBrief(id, brief!);
    toast.success("Brief salvo");
  }

  function toggleMaterial(key: MaterialKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === ALL_MATERIAL_KEYS.length
        ? new Set()
        : new Set(ALL_MATERIAL_KEYS),
    );
  }

  async function confirmarGeracao() {
  if (selected.size === 0) return toast.error("Selecione ao menos um material.");
  store.setBrief(id, brief!);
  setShowSelector(false);

  if (!hasKey) {
    store.generateMockMaterials(id);
    toast.success("Materiais de exemplo gerados (mock).");
    nav({ to: "/campanha/$id/materiais", params: { id } });
    return;
  }

  setGenerating(true);
  setProgress(null);

  try {
    // ✅ Passa APENAS as keys selecionadas
    const keysToGenerate = ALL_MATERIAL_KEYS.filter((k) => selected.has(k));

    const materiais = await generateAllMaterials(
      brief!,
      (p) => setProgress(p),
      keysToGenerate, // ✅ filtro aplicado aqui
    );

    // ✅ Preserva materiais existentes, sobrescreve apenas os regerados
    const existing = c?.materiais ?? {};
    store.setMateriais(id, { ...existing, ...materiais });

    toast.success(`${keysToGenerate.length} material(is) gerado(s) com sucesso!`);
    nav({ to: "/campanha/$id/materiais", params: { id } });
  } catch (err) {
    toast.error(`Erro: ${(err as Error).message}`);
  } finally {
    setGenerating(false);
    setProgress(null);
  }
}

  return (
    <div className="space-y-6">
      {/* Progresso de geração */}
      {generating && progress && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Gerando: {progress.label}
              <span className="ml-auto text-xs text-muted-foreground">
                {progress.current}/{progress.total}
              </span>
            </div>
            <Progress value={Math.round((progress.current / progress.total) * 100)} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowJson((s) => !s)}>
          <Code2 className="h-4 w-4" /> {showJson ? "Ver formulário" : "Ver JSON"}
        </Button>
        <Button variant="outline" size="sm" onClick={salvar}>
          <Save className="h-4 w-4" /> Salvar brief
        </Button>
        <Button size="sm" onClick={() => setShowSelector(true)} disabled={generating}>
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Gerar materiais
        </Button>
      </div>

      {/* Modal de seleção de materiais */}
      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Selecione os materiais a gerar
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Selecionar todos */}
            <label
              htmlFor="select-all"
              className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-2 cursor-pointer hover:bg-muted/40 select-none"
            >
              <Checkbox
                id="select-all"
                checked={selected.size === ALL_MATERIAL_KEYS.length}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">
                {selected.size === ALL_MATERIAL_KEYS.length ? "Desmarcar todos" : "Selecionar todos"}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {selected.size}/{ALL_MATERIAL_KEYS.length}
              </span>
            </label>

            {/* Lista de materiais */}
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {ALL_MATERIAL_KEYS.map((key) => (
                <label
                  key={key}
                  htmlFor={`mat-${key}`}
                  className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                >
                  <Checkbox
                    id={`mat-${key}`}
                    checked={selected.has(key)}
                    onCheckedChange={() => toggleMaterial(key)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm block truncate">
                      {MATERIAL_META[key].label}
                    </span>
                    <p className="text-xs text-muted-foreground truncate">
                      {MATERIAL_META[key].descricao}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    .{MATERIAL_META[key].ext}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {!hasKey && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Sem chave de API — serão gerados materiais de exemplo (mock).{" "}
              <Link to="/configuracoes" className="underline font-medium">Configurar</Link>
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSelector(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarGeracao} disabled={selected.size === 0}>
              {hasKey ? (
                <><Sparkles className="h-4 w-4" />Gerar {selected.size} material(is)</>
              ) : (
                <><Zap className="h-4 w-4" />Gerar exemplo (mock)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showJson ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brief — JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="font-mono text-xs bg-muted/60 rounded-md p-4 overflow-auto max-h-[600px]">
              {JSON.stringify(brief, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Identidade</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Marca" value={brief.marca} onChange={(v) => set("marca", v)} />
              <Field label="Campanha" value={brief.campanha} onChange={(v) => set("campanha", v)} />
              <Field label="Tom de comunicação" value={brief.tom_comunicacao} onChange={(v) => set("tom_comunicacao", v)} />
              <Field label="Público-alvo" value={brief.publico_alvo} onChange={(v) => set("publico_alvo", v)} multiline />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Proposta comercial</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Proposta" value={brief.proposta_comercial} onChange={(v) => set("proposta_comercial", v)} multiline />
              <Field label="Oferta promocional" value={brief.oferta_promocional} onChange={(v) => set("oferta_promocional", v)} multiline />
              <Field label="Observações" value={brief.observacoes} onChange={(v) => set("observacoes", v)} multiline />
            </CardContent>
          </Card>

          <ListCard title="Subcategorias / Produtos" items={brief.subcategorias ?? []} onChange={(i, v) => setListItem("subcategorias", i, v)} onAdd={() => addItem("subcategorias")} onDel={(i) => delItem("subcategorias", i)} placeholder="Ex.: Micropipetas monocanal" />
          <ListCard title="Diferenciais técnicos" items={brief.diferenciais_tecnicos ?? []} onChange={(i, v) => setListItem("diferenciais_tecnicos", i, v)} onAdd={() => addItem("diferenciais_tecnicos")} onDel={(i) => delItem("diferenciais_tecnicos", i)} placeholder="Ex.: Calibração ISO" />
          <ListCard title="Benefícios para revendedor" items={brief.beneficios_revendedor ?? []} onChange={(i, v) => setListItem("beneficios_revendedor", i, v)} onAdd={() => addItem("beneficios_revendedor")} onDel={(i) => delItem("beneficios_revendedor", i)} placeholder="Ex.: Margem ampliada" />
          <ListCard title="Benefícios para cliente final" items={brief.beneficios_cliente_final ?? []} onChange={(i, v) => setListItem("beneficios_cliente_final", i, v)} onAdd={() => addItem("beneficios_cliente_final")} onDel={(i) => delItem("beneficios_cliente_final", i)} placeholder="Ex.: Precisão e conforto" />

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Objeções & argumentos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(brief.objecoes_argumentos ?? []).map((o, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  <Textarea
                    value={o.objecao}
                    placeholder="Objeção"
                    onChange={(e) => {
                      const arr = [...(brief.objecoes_argumentos ?? [])];
                      arr[i] = { ...arr[i], objecao: e.target.value };
                      set("objecoes_argumentos", arr);
                    }}
                  />
                  <div className="flex gap-2">
                    <Textarea
                      value={o.argumento}
                      placeholder="Argumento"
                      onChange={(e) => {
                        const arr = [...(brief.objecoes_argumentos ?? [])];
                        arr[i] = { ...arr[i], argumento: e.target.value };
                        set("objecoes_argumentos", arr);
                      }}
                    />
                    <Button variant="ghost" size="icon" onClick={() => {
                      const arr = [...(brief.objecoes_argumentos ?? [])];
                      arr.splice(i, 1);
                      set("objecoes_argumentos", arr);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() =>
                set("objecoes_argumentos", [...(brief.objecoes_argumentos ?? []), { objecao: "", argumento: "" }])
              }>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </CardContent>
          </Card>

          {brief.inferencias_ia && brief.inferencias_ia.length > 0 && (
            <Card className="lg:col-span-2 border-warning/40 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-warning-foreground">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Inferências da IA — revisar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ListCard
                  embedded
                  title=""
                  items={brief.inferencias_ia ?? []}
                  onChange={(i, v) => setListItem("inferencias_ia", i, v)}
                  onAdd={() => addItem("inferencias_ia")}
                  onDel={(i) => delItem("inferencias_ia", i)}
                  placeholder="Inferência feita pela IA"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, multiline }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function ListCard({ title, items, onChange, onAdd, onDel, placeholder, embedded }: {
  title: string; items: string[];
  onChange: (i: number, v: string) => void;
  onAdd: () => void; onDel: (i: number) => void;
  placeholder?: string; embedded?: boolean;
}) {
  const safeItems = items ?? [];
  const body = (
    <div className="space-y-2">
      {safeItems.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input value={it ?? ""} placeholder={placeholder} onChange={(e) => onChange(i, e.target.value)} />
          <Button variant="ghost" size="icon" onClick={() => onDel(i)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="h-4 w-4" /> Adicionar
      </Button>
    </div>
  );
  if (embedded) return body;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}