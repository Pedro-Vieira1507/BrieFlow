import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { Artifact } from "@/lib/chat-storage";
import {
  Copy, Download, FileText, ImageIcon, Mail,
  Printer, Sparkles, Code2, RefreshCw, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { EmailPreview } from "@/components/previews/EmailPreview";
import { BannerPreview } from "@/components/previews/BannerPreview";
import { CopyPreview } from "@/components/previews/CopyPreview";

interface Props {
  artifact?: Artifact;
  loading?: boolean;
  loadingIntent?: "image" | "email" | "datasheet" | "text";
  sessionId?: string;
  /** Called when the user wants to ask the AI to refine the current artifact */
  onRefineRequest?: (prompt: string) => void;
}

export function ArtifactPanel({
  artifact,
  loading,
  loadingIntent,
  sessionId,
  onRefineRequest,
}: Props) {
  const [view, setView] = useState<"preview" | "code">("preview");
  const [editedData, setEditedData] = useState<Record<string, string> | null>(null);

  // Reset edited data when artifact changes
  const handleDataChange = useCallback((d: Record<string, string>) => {
    setEditedData(d);
  }, []);

  if (loading) return <LoadingState intent={loadingIntent ?? "text"} />;
  if (!artifact) return <EmptyState />;

  // Detect interactive preview type from artifact metadata or HTML content
  const previewType = detectPreviewType(artifact);
  const artifactData = artifact.data ?? parseHTMLtoData(artifact.html ?? "", previewType);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ArtifactIcon kind={artifact.kind} previewType={previewType} />
          <span className="capitalize">{labelFor(artifact, previewType)}</span>
          {previewType !== "raw" && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              <Pencil className="h-3 w-3" /> Clique para editar
            </span>
          )}
        </div>
        <Toolbar
          artifact={artifact}
          view={view}
          onViewChange={setView}
          previewType={previewType}
          editedData={editedData}
          onRefineRequest={onRefineRequest}
        />
      </header>

      <div className="thin-scroll flex-1 overflow-auto p-4">
        {/* ── Interactive inline-editable previews ── */}
        {previewType === "email" && view === "preview" && (
          <EmailPreview
            data={artifactData}
            sessionId={sessionId}
            onDataChange={handleDataChange}
          />
        )}
        {previewType === "banner" && view === "preview" && (
          <BannerPreview
            data={artifactData}
            sessionId={sessionId}
            onDataChange={handleDataChange}
          />
        )}
        {previewType === "copy" && view === "preview" && (
          <CopyPreview
            data={artifactData}
            sessionId={sessionId}
            onDataChange={handleDataChange}
          />
        )}

        {/* ── Raw HTML fallback (legacy / unknown) ── */}
        {previewType === "raw" && artifact.kind === "html" && view === "preview" && (
          <iframe
            title="Pré-visualização"
            sandbox="allow-same-origin"
            className="h-full min-h-[600px] w-full rounded-lg bg-white"
            srcDoc={artifact.html}
          />
        )}
        {artifact.kind === "html" && view === "code" && (
          <pre className="thin-scroll m-0 h-full overflow-auto rounded-lg bg-[oklch(0.14_0.01_270)] p-5 text-xs leading-relaxed text-foreground">
            <code>{artifact.html}</code>
          </pre>
        )}
        {artifact.kind === "image" && (
          <div className="flex h-full items-center justify-center p-6">
            <img
              src={artifact.url}
              alt={artifact.prompt}
              className="max-h-full max-w-full rounded-xl shadow-2xl ring-1 ring-border"
            />
          </div>
        )}
        {artifact.kind === "markdown" && (
          <div id="print-area" className="prose-artifact mx-auto max-w-3xl px-8 py-10">
            <ReactMarkdown>{artifact.markdown}</ReactMarkdown>
          </div>
        )}
        {artifact.kind === "text" && (
          <div className="prose-artifact mx-auto max-w-3xl px-8 py-10 whitespace-pre-wrap">
            {artifact.text}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Toolbar ───────────────────────────

function Toolbar({
  artifact,
  view,
  onViewChange,
  previewType,
  editedData,
  onRefineRequest,
}: {
  artifact: Artifact;
  view: "preview" | "code";
  onViewChange: (v: "preview" | "code") => void;
  previewType: PreviewType;
  editedData: Record<string, string> | null;
  onRefineRequest?: (prompt: string) => void;
}) {
  function handleRefine() {
    const prompt = window.prompt(
      "O que deseja ajustar neste conteúdo?",
      "Reescreva o headline com mais urgência"
    );
    if (prompt) onRefineRequest?.(prompt);
  }

  return (
    <div className="flex items-center gap-2">
      {onRefineRequest && previewType !== "raw" && (
        <Button size="sm" variant="outline" onClick={handleRefine}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refinar com IA
        </Button>
      )}

      {artifact.kind === "html" && (
        <>
          {previewType !== "raw" && (
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              <Button size="sm" variant={view === "preview" ? "default" : "ghost"} className="rounded-none" onClick={() => onViewChange("preview")}>
                Preview
              </Button>
              <Button size="sm" variant={view === "code" ? "default" : "ghost"} className="rounded-none" onClick={() => onViewChange("code")}>
                <Code2 className="mr-1 h-4 w-4" /> HTML
              </Button>
            </div>
          )}
          <Button size="sm" variant="secondary" onClick={() => copy(buildExportHTML(artifact, editedData), "HTML copiado")}>
            <Copy className="mr-1 h-4 w-4" /> Copiar
          </Button>
          <Button size="sm" onClick={() => download(buildExportHTML(artifact, editedData), "email.html", "text/html")}>
            <Download className="mr-1 h-4 w-4" /> Baixar
          </Button>
        </>
      )}
      {artifact.kind === "image" && (
        <Button size="sm" onClick={() => downloadImage(artifact.url)}>
          <Download className="mr-1 h-4 w-4" /> Baixar imagem
        </Button>
      )}
      {artifact.kind === "markdown" && (
        <>
          <Button size="sm" variant="secondary" onClick={() => copy(artifact.markdown, "Markdown copiado")}>
            <Copy className="mr-1 h-4 w-4" /> Copiar
          </Button>
          <Button size="sm" onClick={exportPdf}>
            <Printer className="mr-1 h-4 w-4" /> PDF
          </Button>
        </>
      )}
      {artifact.kind === "text" && (
        <Button size="sm" variant="secondary" onClick={() => copy(artifact.text, "Texto copiado")}>
          <Copy className="mr-1 h-4 w-4" /> Copiar
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

type PreviewType = "email" | "banner" | "copy" | "raw";

function detectPreviewType(artifact: Artifact): PreviewType {
  if (artifact.data) {
    const t = artifact.data.content_type ?? artifact.data.type;
    if (t === "email" || t === "email_marketing") return "email";
    if (t === "banner" || t === "instagram" || t === "social_image") return "banner";
    if (t === "copy" || t === "social_copy" || t === "post") return "copy";
  }
  // Infer from HTML presence of known markers
  const html = artifact.html ?? "";
  if (html.includes("data-preview-type=\"email\"")) return "email";
  if (html.includes("data-preview-type=\"banner\"")) return "banner";
  if (html.includes("data-preview-type=\"copy\"")) return "copy";
  return "raw";
}

function parseHTMLtoData(html: string, _type: PreviewType): Record<string, string> {
  // Best-effort extraction from HTML meta tags injected by the backend
  const get = (attr: string) => {
    const m = html.match(new RegExp(`data-field="${attr}"[^>]*>([^<]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  return {
    headline: get("headline"),
    subheadline: get("subheadline"),
    body: get("body"),
    cta_text: get("cta_text"),
    footer: get("footer"),
    subject: get("subject"),
    preheader: get("preheader"),
    hook: get("hook"),
    hashtags: get("hashtags"),
  };
}

/** Merges in-place edits back into the original HTML for export */
function buildExportHTML(artifact: Artifact, edits: Record<string, string> | null): string {
  if (!edits || !artifact.html) return artifact.html ?? "";
  let html = artifact.html;
  for (const [key, value] of Object.entries(edits)) {
    html = html.replace(
      new RegExp(`(data-field="${key}"[^>]*>)[^<]*`, "gi"),
      `$1${value}`
    );
  }
  return html;
}

function ArtifactIcon({ kind, previewType }: { kind: Artifact["kind"]; previewType: PreviewType }) {
  if (previewType === "email" || kind === "html") return <Mail className="h-4 w-4 text-primary" />;
  if (kind === "image") return <ImageIcon className="h-4 w-4 text-accent" />;
  if (kind === "markdown") return <FileText className="h-4 w-4 text-primary" />;
  return <Sparkles className="h-4 w-4 text-primary" />;
}

function labelFor(a: Artifact, previewType: PreviewType) {
  if (previewType === "email") return "E-mail Marketing";
  if (previewType === "banner") return "Banner / Social";
  if (previewType === "copy") return "Copy / Post";
  if (a.kind === "html") return "HTML";
  if (a.kind === "image") return "Imagem";
  if (a.kind === "markdown") return a.title ?? "Ficha técnica";
  return "Texto gerado";
}

function copy(text: string, msg: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(msg));
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function downloadImage(url: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `marketing-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank");
  }
}

async function exportPdf() {
  const el = document.getElementById("print-area");
  if (!el) return;
  try {
    const mod = (await import("html2pdf.js")).default as (el: HTMLElement) => {
      set: (opts: Record<string, unknown>) => { save: () => Promise<void> };
    };
    await mod(el).set({
      margin: 12,
      filename: `ficha-tecnica-${Date.now()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).save();
  } catch {
    window.print();
  }
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center text-muted-foreground">
      <div className="mb-5 grid grid-cols-2 gap-3 opacity-80">
        <Tile icon={<Mail className="h-5 w-5" />} label="E-mails" />
        <Tile icon={<ImageIcon className="h-5 w-5" />} label="Banners" />
        <Tile icon={<FileText className="h-5 w-5" />} label="Fichas" />
        <Tile icon={<Sparkles className="h-5 w-5" />} label="Copy" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Painel de Artefatos</h2>
      <p className="mt-2 max-w-sm text-sm">
        Peça um e-mail, banner ou post no chat. O resultado aparece aqui — clique em qualquer texto para editar diretamente.
      </p>
    </div>
  );
}

function Tile({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-foreground">
      {icon}{label}
    </div>
  );
}

function LoadingState({ intent }: { intent: "image" | "email" | "datasheet" | "text" }) {
  const labels: Record<typeof intent, string> = {
    image: "Gerando imagem…",
    email: "Compondo e-mail…",
    datasheet: "Estruturando ficha…",
    text: "Escrevendo conteúdo…",
  };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
        <div className="absolute inset-2 rounded-full bg-primary/60" />
        <Sparkles className="absolute inset-0 m-auto h-7 w-7 text-primary-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">{labels[intent]}</p>
        <p className="mt-1 text-sm text-muted-foreground">Isso pode levar alguns segundos.</p>
      </div>
      <div className="w-full max-w-sm space-y-2">
        <div className="h-3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
