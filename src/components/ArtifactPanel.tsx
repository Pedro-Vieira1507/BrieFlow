import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Artifact } from "@/lib/chat-storage";
import { Copy, Download, FileText, ImageIcon, Mail, Printer, Sparkles, Code2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Props {
  artifact?: Artifact;
  loading?: boolean;
  loadingIntent?: "image" | "email" | "banner" | "instagram" | "datasheet" | "text" | string;
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

      <div className="thin-scroll flex-1 overflow-auto bg-[var(--background)]">
        {artifact.kind === "html" && view === "preview" && (
          <ScaledHtmlPreview
            html={artifact.html}
            userPrompt={artifact.prompt ?? ""}
            intent={artifact.intent}
          />
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

// ============================================================================
// SCALED HTML PREVIEW
// Escala o iframe de forma dinâmica baseada na intenção.
// transform-origin: top left para evitar corte do lado esquerdo durante escala.
// ============================================================================

/** Dimensões reais de cada formato de artefato visual */
const ARTIFACT_DIMENSIONS: Record<string, { w: number; h: number }> = {
  banner:    { w: 1200, h: 500 },
  instagram: { w: 1080, h: 1080 },
  email:     { w: 600,  h: 800 },
  default:   { w: 1200, h: 900 },
};

function getArtifactDimensions(intent?: string): { w: number; h: number } {
  if (!intent) return ARTIFACT_DIMENSIONS.default;
  return ARTIFACT_DIMENSIONS[intent] ?? ARTIFACT_DIMENSIONS.default;
}

/**
 * sanitizeHtml — remove scripts e corrige URLs de imagens sem domínio Pollinations.
 *
 * Extração robusta do prompt de imagem do Pollinations:
 * 1. Tenta extrair diretamente do src da primeira <img> com pollinations.ai
 * 2. Fallback: constrói uma descrição traduzida a partir do userPrompt
 * Não depende de regex frágil de comentários HTML.
 */
function sanitizeHtml(html: string, userPrompt: string): string {
  // Extração robusta: tenta pegar o primeiro URL de pollinations já no HTML
  const pollinationsMatch = html.match(
    /https:\/\/image\.pollinations\.ai\/prompt\/([^?"'\s]+)/i,
  );

  let fallbackUrl: string;
  if (pollinationsMatch) {
    // Já tem URL do Pollinations — reutiliza como fallback para imagens faltantes
    fallbackUrl = `https://image.pollinations.ai/prompt/${pollinationsMatch[1]}?width=800&height=500&nologo=true`;
  } else {
    // Constrói descrição genérica a partir do prompt do utilizador
    const description = buildProductDescription(userPrompt);
    const encoded = encodeURIComponent(description);
    fallbackUrl = `https://image.pollinations.ai/prompt/${encoded}?width=800&height=500&nologo=true`;
  }

  return (
    html
      // Remove scripts injetados
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      // Substitui imagens que não são do Pollinations pelo fallback
      .replace(
        /(<img[^>]*\ssrc=["'])(?!https:\/\/image\.pollinations\.ai)([^"']*?)(["'])/gi,
        `$1${fallbackUrl}$3`,
      )
  );
}

/** Conjunto de substituições PT → EN para construir descrições de produto */
const PT_TO_EN_MAP: [RegExp, string][] = [
  [/pipeta|pipette/gi, "laboratory pipette"],
  [/brownie/gi, "brownie pastry"],
  [/recheado/gi, "filled pastry"],
  [/sanduiche|sanduíche/gi, "sandwich"],
  [/bolo/gi, "cake"],
  [/doce|confei|confeitaria/gi, "pastry confectionery"],
  [/chocolate/gi, "chocolate product"],
  [/morango/gi, "strawberry product"],
  [/instrumento|equipamento/gi, "laboratory instrument equipment"],
  [/laboratório|laboratorio/gi, "laboratory"],
  [/cosmético|cosmetico|beleza/gi, "cosmetics product"],
  [/roupa|moda|fashion/gi, "fashion clothing item"],
  [/alimento|comida|restaurante/gi, "food product"],
  [/tecnologia|tech/gi, "technology device"],
  [/imobiliário|imóvel/gi, "real estate property"],
];

function buildProductDescription(prompt: string): string {
  let desc = prompt.toLowerCase();
  for (const [pt, en] of PT_TO_EN_MAP) {
    desc = desc.replace(pt, en);
  }
  const keywords = desc
    .replace(/[^a-z\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .join(" ");
  return `${keywords}, professional macro product photography, isolated on pure white background, no humans, nobody, no people`;
}

function ScaledHtmlPreview({
  html,
  userPrompt,
  intent,
}: {
  html: string;
  userPrompt: string;
  intent?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const { w: REAL_W, h: REAL_H } = getArtifactDimensions(intent);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateScale = (containerWidth: number) => {
      if (containerWidth > 0) setScale(containerWidth / REAL_W);
    };

    // ResizeObserver para recalcular a escala dinamicamente
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      updateScale(width);
    });

    observer.observe(el);
    updateScale(el.clientWidth);

    return () => observer.disconnect();
  }, [REAL_W]);

  const scaledH = Math.round(REAL_H * scale);
  const cleanHtml = sanitizeHtml(html, userPrompt);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden bg-white shadow-inner"
      style={{ height: scaledH > 0 ? scaledH : "auto", minHeight: "100%" }}
    >
      <iframe
        title="Preview"
        sandbox="allow-same-origin"
        style={{
          width: `${REAL_W}px`,
          height: `${REAL_H}px`,
          transform: `scale(${scale})`,
          // transform-origin: top left evita que o lado esquerdo do design
          // seja cortado durante a escala de CSS
          transformOrigin: "top left",
          border: "none",
          display: "block",
          backgroundColor: "#fff",
          // position: absolute previne que o bounding box original
          // do iframe (no tamanho real, antes da escala) empurre o layout
          position: "absolute",
          top: 0,
          left: 0,
        }}
        srcDoc={cleanHtml}
      />
    </div>
  );
}

// ============================================================================
// TOOLBAR, ICONS, LABELS
// ============================================================================

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
          <Button size="sm" onClick={() => download(artifact.html, "output.html", "text/html")}>
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
  if (a.kind === "html") return "Código HTML";
  if (a.kind === "image") return "Imagem de marketing";
  if (a.kind === "markdown") return a.title ?? "Ficha técnica";
  return "Texto gerado";
}

// ============================================================================
// UTILITIES
// ============================================================================

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
    const mod = (await import("html2pdf.js")).default as (
      el: HTMLElement,
    ) => { set: (opts: Record<string, unknown>) => { save: () => Promise<void> } };
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

// ============================================================================
// EMPTY & LOADING STATES
// ============================================================================

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
        Peça um e-mail, um banner ou uma ficha técnica no chat ao lado. O resultado aparece aqui, pronto para copiar ou exportar.
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

function LoadingState({
  intent,
}: {
  intent: "image" | "email" | "banner" | "instagram" | "datasheet" | "text" | string;
}) {
  const labels: Record<string, string> = {
    image:     "A gerar imagem no Pollinations…",
    email:     "Agente 1 a escrever copy · Agente 2 a montar o e-mail…",
    banner:    "Agente 1 a escrever copy · Agente 2 a desenhar o banner…",
    instagram: "Agente 1 a escrever copy · Agente 2 a criar o post…",
    datasheet: "A estruturar ficha técnica…",
    text:      "A escrever conteúdo…",
  };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
        <div className="absolute inset-2 rounded-full bg-primary/60" />
        <Sparkles className="absolute inset-0 m-auto h-7 w-7 text-primary-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">{labels[intent] ?? "A processar…"}</p>
        <p className="mt-1 text-sm text-muted-foreground">A pipeline multi-agente está a trabalhar.</p>
      </div>
      <div className="w-full max-w-sm space-y-2">
        <div className="h-3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
