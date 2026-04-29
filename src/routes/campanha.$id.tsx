import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { AppShell, PageContainer, PageHeader } from "@/components/AppShell";
import { useCampaign, type CampaignStatus } from "@/lib/store";
import { Stepper } from "@/components/Stepper";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/campanha/$id")({
  head: () => ({
    meta: [
      { title: "Campanha — Agente de Conteúdo Forlab" },
      { name: "description", content: "Detalhes da campanha: transcrição, brief estruturado e materiais gerados." },
    ],
  }),
  component: CampanhaLayout,
  notFoundComponent: () => (
    <AppShell>
      <PageContainer>
        <PageHeader title="Campanha não encontrada" />
        <Button asChild variant="outline">
          <Link to="/historico">Voltar ao histórico</Link>
        </Button>
      </PageContainer>
    </AppShell>
  ),
});

const STEPS = [
  { key: "transcricao", label: "Transcrição" },
  { key: "brief", label: "Brief estruturado" },
  { key: "materiais", label: "Materiais" },
];

function statusToStep(status: CampaignStatus) {
  if (status === "materiais_gerados") return 2;
  if (status === "brief_gerado") return 2;
  if (status === "transcrito") return 1;
  return 0;
}

function CampanhaLayout() {
  const { id } = Route.useParams();
  const c = useCampaign(id);
  const loc = useLocation();

  if (!c) {
    return (
      <AppShell>
        <PageContainer>
          <PageHeader title="Campanha não encontrada" />
          <Button asChild variant="outline">
            <Link to="/historico">Voltar ao histórico</Link>
          </Button>
        </PageContainer>
      </AppShell>
    );
  }

  const currentStep =
    loc.pathname.endsWith("/materiais") ? 2 :
    loc.pathname.endsWith("/brief") ? 1 :
    loc.pathname.endsWith("/transcricao") ? 0 :
    statusToStep(c.status);

  return (
    <AppShell>
      <PageContainer>
        <div className="mb-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/historico">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>
        <PageHeader
          title={c.nome}
          description={`Origem: ${c.source.name}`}
          actions={<StatusBadge status={c.status} />}
        />
        <Card className="mb-6">
          <CardContent className="p-5">
            <Stepper steps={STEPS} currentIndex={currentStep} />
          </CardContent>
        </Card>
        <Outlet />
      </PageContainer>
    </AppShell>
  );
}
