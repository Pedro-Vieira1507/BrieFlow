import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageContainer, PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useCampaigns, MATERIAL_META } from "@/lib/store";
import { ArrowRight, FileAudio, FileText, FileVideo, FolderInput, PlusCircle, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Agente de Conteúdo Forlab" },
      { name: "description", content: "Resumo de campanhas, materiais gerados e atalhos para criar uma nova campanha." },
    ],
  }),
  component: Dashboard,
});

function iconForType(t: string) {
  if (t === "video") return FileVideo;
  if (t === "audio") return FileAudio;
  if (t === "drive") return FolderInput;
  return FileText;
}

function Dashboard() {
  const campanhas = useCampaigns();
  const totalMateriais = campanhas.reduce((acc, c) => acc + Object.keys(c.materiais ?? {}).length, 0);
  const briefs = campanhas.filter((c) => c.brief).length;
  const recentes = campanhas.slice(0, 5);

  const stats = [
    { label: "Campanhas", value: campanhas.length, icon: Sparkles, hint: "totais no workspace" },
    { label: "Briefs gerados", value: briefs, icon: FileText, hint: "estruturados pela IA" },
    { label: "Materiais gerados", value: totalMateriais, icon: TrendingUp, hint: `${Object.keys(MATERIAL_META).length} formatos disponíveis` },
  ];

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Dashboard"
          description="Acompanhe suas campanhas, transcrições e materiais gerados pela IA."
          actions={
            <Button asChild>
              <Link to="/nova-campanha">
                <PlusCircle className="h-4 w-4" />
                Nova campanha
              </Link>
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="border-border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                        {s.label}
                      </div>
                      <div className="text-3xl font-semibold tracking-tight mt-1">{s.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{s.hint}</div>
                    </div>
                    <div className="h-9 w-9 rounded-md bg-accent/15 text-accent grid place-items-center">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Últimas campanhas</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/historico">
                  Ver todas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {recentes.map((c) => {
                  const Icon = iconForType(c.source.type);
                  return (
                    <li key={c.id}>
                      <Link
                        to="/campanha/$id"
                        params={{ id: c.id }}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="h-9 w-9 rounded-md bg-secondary grid place-items-center text-secondary-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{c.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.source.name}</div>
                        </div>
                        <StatusBadge status={c.status} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
                {recentes.length === 0 && (
                  <li className="p-8 text-center text-sm text-muted-foreground">Nenhuma campanha ainda. Crie a primeira.</li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atalhos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                to="/nova-campanha"
                className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-accent hover:bg-accent/5 transition-colors"
              >
                <PlusCircle className="h-4 w-4 text-accent" />
                <div className="text-sm">
                  <div className="font-medium">Enviar arquivo ou texto</div>
                  <div className="text-xs text-muted-foreground">Vídeo, áudio, .txt, .docx ou JSON</div>
                </div>
              </Link>
              <Link
                to="/configuracoes"
                className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-accent hover:bg-accent/5 transition-colors"
              >
                <FolderInput className="h-4 w-4 text-accent" />
                <div className="text-sm">
                  <div className="font-medium">Conectar Google Drive</div>
                  <div className="text-xs text-muted-foreground">Monitorar pasta automaticamente</div>
                </div>
              </Link>
              <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                Dica: revise sempre a transcrição antes de gerar o brief — a qualidade dos materiais depende disso.
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </AppShell>
  );
}
