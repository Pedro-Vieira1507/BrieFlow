import type { BuilderState } from "@/types/builder";
import { EmailPreview } from "./EmailPreview";
import { SocialPreview } from "./SocialPreview";
import { BannerPreview } from "./BannerPreview";
import { Button } from "@/components/ui/button";
import { FileText, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

function toPlainText(s: BuilderState): string {
  return [s.title, s.subtitle, s.body, s.caption, s.cta, s.hashtags?.join(" ")]
    .filter(Boolean)
    .join("\n\n");
}

function exportToGmail(s: BuilderState) {
  const subject = encodeURIComponent(s.title ?? "Campanha BrieFlow");
  const body = encodeURIComponent(toPlainText(s));
  window.open(
    `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`,
    "_blank",
  );
}

function exportToDocs(s: BuilderState) {
  navigator.clipboard.writeText(toPlainText(s)).then(() => {
    toast.success("Conteúdo copiado. Cole no Google Docs (Ctrl+V).");
    window.open("https://docs.google.com/document/create", "_blank");
  });
}

export function PageBuilder({ state, onChange }: Props) {
  const hasContent = state.type !== "none";

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-surface/80 px-6 py-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-brand text-brand-foreground shadow-elegant">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-semibold">Live Page Builder</h2>
            <p className="truncate text-xs text-muted-foreground">
              Clique em qualquer texto para editar
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasContent}
            onClick={() => exportToGmail(state)}
          >
            <Mail className="mr-2 size-4" /> Gmail
          </Button>
          <Button
            size="sm"
            disabled={!hasContent}
            onClick={() => exportToDocs(state)}
            className="bg-gradient-brand text-brand-foreground hover:opacity-90"
          >
            <FileText className="mr-2 size-4" /> Google Docs
          </Button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto bg-gradient-subtle p-6 lg:p-10">
        {state.type === "email" && <EmailPreview state={state} onChange={onChange} />}
        {state.type === "social" && <SocialPreview state={state} onChange={onChange} />}
        {state.type === "banner" && <BannerPreview state={state} onChange={onChange} />}
        {state.type === "none" && <EmptyState />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 grid size-20 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-elegant">
        <Sparkles className="size-9" />
      </div>
      <h3 className="font-display text-2xl font-bold">Peça uma campanha no chat</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Ex.: "Crie um e-mail de black friday para minha loja de café" ou
        "Faça um post no Instagram sobre nosso lançamento".
      </p>
    </div>
  );
}