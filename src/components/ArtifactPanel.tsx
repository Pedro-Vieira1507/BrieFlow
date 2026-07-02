import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Artifact } from "@/lib/chat-storage";
import { Copy, Download, FileText, ImageIcon, Mail, Printer, Sparkles, Code2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Props {
  artifact?: Artifact;
  loading?: boolean;
  loadingIntent?: "image" | "email" | "datasheet" | "text";
}

export function ArtifactPanel({ artifact, loading, loadingIntent }: Props) {
  const [view, setView] = useState<"preview" | "code">("preview");

  if (loading) {
    return <LoadingState intent={loadingIntent ?? "text"} />;
  }

  if (!artifact) {
    return <EmptyState />;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ArtifactIcon kind={artifact.kind} />
          <span className="capitalize">{labelFor(artifact)}</span>
        </div>
        <Toolbar artifact={artifact} view={view} onViewChange={setView} />
      </header>

      <div className="thin-scroll flex-1 overflow-auto">
        {artifact.kind === "html" && view === "preview" && (
          <ScaledHtmlPreview html={artifact.html} userPrompt={artifact.prompt ?? ""} />
        )}
        {artifact.kind === "html" && view === "code" && (
          <pre className="thin-scroll m-0 h-full overflow-auto bg-[oklch(0.14_0.01_270)] p-5 text-xs leading-relaxed text-foreground">
            <code>{artifact.html}</code>
          </pre>
        )}
        {artifact.kind === "image" && (
          <div className="flex h-full items-center justify-center p-6">
            <img
              src={artifact.url}
              alt={artifact.prompt}
              className="max-h-full max-w-full rounded-xl shadow-2xl ring-1 ring-border object-contain"
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

// ---------------------------------------------------------------------------
// sanitizeHtml
// Prioridade 1: extrai a descrição Pollinations do bloco <!-- ANALISE: -->
//   que o modelo é instruído a escrever antes do HTML.
// Prioridade 2: fallback com palavras-chave do prompt do usuário
//   convertidas para inglês via dicionário simples.
// Em ambos os casos, qualquer <img src> que não seja Pollinations é substituído.
// ---------------------------------------------------------------------------

const PT_TO_EN: [RegExp, string][] = [
  [/brownie/gi, "brownie"],
  [/recheado/gi, "filled"],
  [/sanduiche|sanduíche/gi, "sandwich"],
  [/bolo/gi, "cake"],
  [/doce|confei|confeitaria/gi, "pastry confectionery"],
  [/chocolate/gi, "chocolate"],
  [/morango/gi, "strawberry"],
  [/instrumento|equipamento/gi, "instrument equipment"],
  [/laboratório|laboratorio/gi, "laboratory"],
  [/cosmético|cosmetico|beleza/gi, "cosmetics beauty"],
  [/roupa|moda|fashion/gi, "fashion clothing"],
  [/alimento|comida|restaurante/gi, "food restaurant"],
  [/tecnologia|tech/gi, "technology"],
  [/imobiliário|imóvel/gi, "real estate property"],
];

function buildFallbackDescription(userPrompt: string): string {
  let translated = userPrompt;
  for (const [pt, en] of PT_TO_EN) {
    translated = translated.replace(pt, en);
  }
  // Pega as palavras mais longas (mais descritivas) e forma uma frase curta
  const words = translated
    .replace(/[^a-z\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .join(" ");
  return `${words} professional marketing photography`;
}

function sanitizeHtml(html: string, userPrompt: string): string {
  // Tenta extrair a descrição Pollinations do bloco ANALISE gerado pelo modelo
  const analyseMatch = html.match(
    /Descri[\u00e7c][\u00e3a]o(?:[^:]*)?:\s*([^\n\r]+)/i
  );
  const pollinationsDesc = analyseMatch
    ? analyseMatch[1].trim().replace(/["']/g, "")
    : buildFallbackDescription(userPrompt);

  const encodedDesc = encodeURIComponent(pollinationsDesc);
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedDesc}?width=800&height=500&nologo=true`;

  return (
    html
      // Remove scripts inline (preview não precisa de JS)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      // Substitui qualquer img src que não seja Pollinations
      .replace(
        /(<img[^>]*\ssrc=["'])(?!https:\/\/image\.pollinations\.ai)([^"']*?)(["'])/gi,
        `$1${fallbackUrl}$3`
      )
  );
}

const REAL_W = 1200;
const REAL_H = 900;

function ScaledHtmlPreview({ html, userPrompt }: { html: string; userPrompt: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      if (width > 0) setScale(width / REAL_W);
    });

    observer.observe(el);
    const w = el.clientWidth;
    if (w > 0) setScale(w / REAL_W);

    return () => observer.disconnect();
  }, []);

  const scaledH = Math.round(REAL_H * scale);
  const cleanHtml = sanitizeHtml(html, userPrompt);

  return (
    <div
      ref={wrapperRef}
      className="w-full overflow-hidden bg-white"
      style={{ height: scaledH }}
    >
      <iframe
        title="Preview"
        sandbox="allow-same-origin"
        style={{
          width: REAL_W,
          height: REAL_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          border: "none",
          display: "block",
        }}
        srcDoc={cleanHtml}
      />
    </div>
  );
}

function Toolbar({
  artifact,
  view,
  onViewChange,
}: {
  artifact: Artifact;
  view: "preview" | "code";
  onViewChange: (v: "preview" | "code") => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {artifact.kind === "html" && (
        <>
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            <Button
              size="sm"
              variant={view === "preview" ? "default" : "ghost"}
              className="rounded-none"
              onClick={() => onViewChange("preview")}
            >
              Preview
            </Button>
            <Button
              size="sm"
              variant={view === "code" ? "default" : "ghost"}
              className="rounded-none"
              onClick={() => onViewChange("code")}
            >
              <Code2 className="mr-1 h-4 w-4" /> HTML
            </Button>
          </div>
          <Button size="sm" variant="secondary" onClick={() => copy(artifact.html, "HTML copiado")}>
            <Copy className="mr-1 h-4 w-4" /> Copiar
          </Button>
          <Button size="sm" onClick={() => download(artifact.html, "banner.html", "text/html")}>
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
            <Printer className="mr-1 h-4 w-4" /> Exportar PDF
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

function ArtifactIcon({ kind }: { kind: Artifact["kind"] }) {
  if (kind === "html") return <Mail className="h-4 w-4 text-primary" />;
  if (kind === "image") return <ImageIcon className="h-4 w-4 text-accent" />;
  if (kind === "markdown") return <FileText className="h-4 w-4 text-primary" />;
  return <Sparkles className="h-4 w-4 text-primary" />;
}

function labelFor(a: Artifact) {
  if (a.kind === "html") return "E-mail HTML";
  if (a.kind === "image") return "Imagem de marketing";
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
  a.href = url;
  a.download = filename;
  a.click();
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
    await mod(el)
      .set({
        margin: 12,
        filename: `ficha-tecnica-${Date.now()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .save();
  } catch {
    window.print();
  }
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center text-muted-foreground">
      <div className="mb-5 grid grid-cols-2 gap-3 opacity-80">
        <Tile icon={<Mail className="h-5 w-5" />} label="E-mails HTML" />
        <Tile icon={<ImageIcon className="h-5 w-5" />} label="Imagens" />
        <Tile icon={<FileText className="h-5 w-5" />} label="Fichas técnicas" />
        <Tile icon={<Sparkles className="h-5 w-5" />} label="Copy" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Painel de Artefatos</h2>
      <p className="mt-2 max-w-sm text-sm">
        Peça um e-mail, uma imagem ou uma ficha técnica no chat ao lado. O resultado aparece aqui, pronto para copiar ou exportar.
      </p>
    </div>
  );
}

function Tile({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-foreground">
      {icon}
      {label}
    </div>
  );
}

function LoadingState({ intent }: { intent: "image" | "email" | "datasheet" | "text" }) {
  const labels: Record<typeof intent, string> = {
    image: "Gerando imagem no Pollinations…",
    email: "Compondo o e-mail HTML…",
    datasheet: "Estruturando ficha técnica…",
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
