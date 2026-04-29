import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageContainer, PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCampaigns, STATUS_LABEL, type CampaignStatus, store } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";
import { useMemo, useState } from "react";
import { Search, Trash2, ArrowRight, PlusCircle } from "lucide-react";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico — Agente de Conteúdo Forlab" },
      { name: "description", content: "Histórico de todas as campanhas processadas: arquivos, transcrições, briefs e materiais." },
    ],
  }),
  component: Historico,
});

const STATUS_OPTS: ("todos" | CampaignStatus)[] = ["todos", "recebido", "transcrito", "brief_gerado", "materiais_gerados", "erro"];

function Historico() {
  const campanhas = useCampaigns();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"todos" | CampaignStatus>("todos");

  const filtered = useMemo(() => {
    return campanhas.filter((c) => {
      const matchQ = !q || c.nome.toLowerCase().includes(q.toLowerCase()) || c.source.name.toLowerCase().includes(q.toLowerCase());
      const matchS = status === "todos" || c.status === status;
      return matchQ && matchS;
    });
  }, [campanhas, q, status]);

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Histórico de campanhas"
          description="Filtre, abra ou remova campanhas processadas."
          actions={
            <Button asChild>
              <Link to="/nova-campanha">
                <PlusCircle className="h-4 w-4" /> Nova campanha
              </Link>
            </Button>
          }
        />

        <Card className="mb-4">
          <CardContent className="p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou arquivo…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTS.map((s) => (
                <Button
                  key={s}
                  variant={status === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatus(s)}
                >
                  {s === "todos" ? "Todos" : STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Campanha</th>
                    <th className="px-4 py-3 font-medium">Origem</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Materiais</th>
                    <th className="px-4 py-3 font-medium">Criada em</th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to="/campanha/$id/transcricao" params={{ id: c.id }} className="font-medium hover:text-accent">
                          {c.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.source.name}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{Object.keys(c.materiais ?? {}).length}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(c.createdAt).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/campanha/$id/transcricao" params={{ id: c.id }}>
                              Abrir <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover campanha?")) store.remove(c.id); }}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                        Nenhuma campanha encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
