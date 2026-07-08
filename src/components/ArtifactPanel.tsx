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
// Dimensões canônicas por intent
// ============================================================================
function getCanvasDimensions(intent?: string): { width: number; height: number } {
  switch (intent) {
    case "banner":    return { width: 1200, height: 500 };
    case "instagram": return { width: 1080, height: 1080 };
    case "email":     return { width: 600,  height: 800 };
    default:          return { width: 1200, height: 900 };
  }
}

// ============================================================================
// Fallback robusto para imagens Pollinations
// Não depende de regex frágil em comentários HTML.
// Estratégia:
//   1. Se o HTML já contém uma URL pollinations válida → mantém.
//   2. Se contém outra <img> sem pollinations → substitui pela URL de fallback.
//   3. A URL de fallback é construída a partir do userPrompt traduzido para inglês
//      usando o mapa PT→EN + negative prompts obrigatórios.
// ============================================================================
const NEGATIVE_PROMPTS_ENCODED = encodeURIComponent(
  "professional macro product photography, isolated on pure white background, no humans, nobody, no people, empty scene",
);

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
  [/pipeta|pipetas/gi, "laboratory pipette"],
  [/laboratorial/gi, "laboratory"],
  [/farmácio|farmaceutico/gi, "pharmaceutical"],
];

function buildFallbackPollinationsUrl(userPrompt: string, intent?: string): string {
  let translated = userPrompt;
  for (const [pt, en] of PT_TO_EN) {
    translated = translated.replace(pt, en);
  }
  const words = translated
    .replace(/[^a-z\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 8)
    .join(" ");

  const dims = getCanvasDimensions(intent);
  const desc = encodeURIComponent(
    `${words} ${NEGATIVE_PROMPTS_ENCODED.slice(0, 60)}`,
  );
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(words + ", professional macro product photography, isolated on pure white background, no humans, nobody")}?width=${dims.width}&height=${dims.height}&nologo=true`;
}

function sanitizeHtml(html: string, userPrompt: string, intent?: string): string {
  // Remove scripts
  let clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  // Verifica se já existe uma URL Pollinations válida com descrição
  const hasValidPollinations = /https:\/\/image\.pollinations\.ai\/prompt\/[^"'\s]{10,}/i.test(clean);

  if (!hasValidPollinations) {
    // Substitui qualquer src de imagem que não seja pollinations pela URL de fallback
    const fallbackUrl = buildFallbackPollinationsUrl(userPrompt, intent);
    clean = clean.replace(
      /(<img[^>]*\ssrc=["'])(?!https:\/\/image\.pollinations\.ai)([^"']*?)(["'])/gi,
      `$1${fallbackUrl}$3`,
    );
    // Se não havia nenhuma <img>, não faz nada — evita injetar imagens indesejadas
  }

  return clean;
}

// ============================================================================
// ScaledHtmlPreview — iframe dinâmico com escala por intent
// ============================================================================
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

  const { width: REAL_W, height: REAL_H } = getCanvasDimensions(intent);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateScale = (containerWidth: number) => {
      if (containerWidth > 0) setScale(containerWidth / REAL_W);
    };

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      updateScale(w);
    });

    observer.observe(el);
    updateScale(el.clientWidth);

    return () => observer.disconnect();
  }, [REAL_W]);

  const scaledH = Math.round(REAL_H * scale);
  const cleanHtml = sanitizeHtml(html, userPrompt, intent);

  return (
    <div
      ref={wrapperRef}
      className="w-full overflow-hidden bg-white shadow-inner relative"
      style={{ height: scaledH > 0 ? scaledH : "auto", minHeight: scaledH > 0 ? scaledH : 200 }}
    >
      <iframe
        title="Preview"
        sandbox="allow-same-origin"
        style={{
          width: `${REAL_W}px`,
          height: `${REAL_H}px`,
          transform: `scale(${scale})`,
          // transform-origin: top left — garante que o lado esquerdo não é cortado
          transformOrigin: "top left",
          border: "none",
          display: "block",
          backgroundColor: "#fff",
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
// Toolbar, Icons, Labels, Utilities
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
          <Button size="sm" variant="secondary" onClick={() => copyText(artifact.html, "HTML copiado")}>
            <Copy className="mr-1 h-4 w-4" /> Copiar
          </Button>
          <Button size="sm" onClick={() => downloadFile(artifact.html, "output.html", "text/html")}>
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
          <Button size="sm" variant="secondary" onClick={() => copyText(artifact.markdown, "Markdown copiado")}>
            <Copy className="mr-1 h-4 w-4" /> Copiar
          </Button>
          <Button size="sm" onClick={exportPdf}>
            <Printer className="mr-1 h-4 w-4" /> Exportar PDF
          </Button>
        </>
      )}

      {artifact.kind === "text" && (
        <Button size="sm" variant="secondary" onClick={() => copyText(artifact.text, "Texto copiado")}>
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

function copyText(text: string, msg: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(msg));
}

function downloadFile(content: string, filename: string, mime: string) {
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
    ) => {
      set: (opts: Record<string, unknown>) => { save: () => Promise<void> };
    };
    await mod(el)
      .set({
        margin: 12,
        filename: `ficha-tecnica-${Date.now()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .save();
  } catch {
    window.print();
  }
}

function LoadingState({ intent }: { intent: string }) {
  const labels: Record<string, string> = {
    banner:    "A gerar banner 1200×500…",
    instagram: "A gerar post Instagram 1080×1080…",
    email:     "A gerar e-mail HTML…",
    image:     "A gerar imagem…",
    datasheet: "A gerar ficha técnica…",
    text:      "A gerar conteúdo…",
  };
  const label = labels[intent] ?? "A gerar conteúdo…";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Sparkles className="h-10 w-10 opacity-20" />
      <p className="text-sm">O artefato gerado aparecerá aqui.</p>
    </div>
  );
}
