import { callLLM } from "./generateMaterials";
import { type StructuredBrief } from "./store";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FolhetoData {
  tagline: string;           // frase de impacto no topo
  titulo: string;            // título principal da oferta
  subtitulo: string;         // subtítulo/descrição curta
  badge: string;             // badge de destaque (ex: "OFERTA EXCLUSIVA")
  beneficios: string[];      // lista de 4-5 benefícios com emoji
  destaque: string;          // caixa de destaque central (ex: "Compre 3, Leve 4")
  destaqueDesc: string;      // descrição do destaque
  produtos: { nome: string; desc: string }[]; // 3 produtos/categorias
  cta: string;               // call-to-action principal
  ctaSub: string;            // texto de apoio do CTA
  rodape: string;            // texto de rodapé (validade, contato)
  paletaCor: "roxo" | "azul" | "verde" | "laranja"; // tema de cor
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

export async function generateFolhetoData(
  textoRoteiro: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<FolhetoData> {
  const prompt = `Você é um especialista em marketing digital e design gráfico.
Com base no TEXTO DO FOLHETO e no BRIEF abaixo, crie o conteúdo estruturado para um folheto A4 moderno e persuasivo.

TEXTO DO FOLHETO:
${textoRoteiro}

BRIEF:
- Campanha: ${nomeCampanha}
- Marca: ${brief.marca}
- Produto: ${brief.produto ?? brief.subcategorias?.join(", ") ?? ""}
- Público-alvo: ${brief.publico_alvo}
- Oferta: ${brief.oferta_promocional}
- Tom: ${brief.tom_comunicacao}

RETORNE SOMENTE um JSON válido (sem markdown), neste formato exato:
{
  "tagline": "frase curta e impactante no topo (máx 8 palavras)",
  "titulo": "título principal grande e chamativo (máx 6 palavras)",
  "subtitulo": "subtítulo explicativo (máx 15 palavras)",
  "badge": "texto do badge de destaque (máx 3 palavras em maiúsculas)",
  "beneficios": [
    "✅ Benefício 1 com detalhe relevante",
    "🔬 Benefício 2 com detalhe relevante",
    "⚡ Benefício 3 com detalhe relevante",
    "💰 Benefício 4 com detalhe relevante",
    "🎯 Benefício 5 com detalhe relevante"
  ],
  "destaque": "texto central de destaque da oferta (ex: COMPRE 3, LEVE 4)",
  "destaqueDesc": "descrição curta do destaque (máx 12 palavras)",
  "produtos": [
    { "nome": "Nome Produto 1", "desc": "descrição técnica curta" },
    { "nome": "Nome Produto 2", "desc": "descrição técnica curta" },
    { "nome": "Nome Produto 3", "desc": "descrição técnica curta" }
  ],
  "cta": "CHAME PARA AÇÃO (máx 5 palavras em maiúsculas)",
  "ctaSub": "texto de apoio do CTA (máx 10 palavras)",
  "rodape": "texto de rodapé com validade e/ou contato (máx 20 palavras)",
  "paletaCor": "roxo"
}`;

  const raw = await callLLM(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON válido para o folheto.");
  return JSON.parse(match[0]) as FolhetoData;
}

// ─── Paletas de cor ───────────────────────────────────────────────────────────

const PALETAS = {
  roxo: {
    bg: "#0F0A1E",
    bgCard: "#1A1130",
    accent: "#7C3AED",
    accentLight: "#A78BFA",
    accentGlow: "rgba(124,58,237,0.35)",
    highlight: "#F59E0B",
    highlightBg: "rgba(245,158,11,0.15)",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    badge: "#7C3AED",
    ctaBg: "#7C3AED",
    border: "rgba(167,139,250,0.25)",
  },
  azul: {
    bg: "#0A1628",
    bgCard: "#0F2040",
    accent: "#2563EB",
    accentLight: "#60A5FA",
    accentGlow: "rgba(37,99,235,0.35)",
    highlight: "#F59E0B",
    highlightBg: "rgba(245,158,11,0.15)",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    badge: "#2563EB",
    ctaBg: "#2563EB",
    border: "rgba(96,165,250,0.25)",
  },
  verde: {
    bg: "#052E16",
    bgCard: "#064E3B",
    accent: "#059669",
    accentLight: "#6EE7B7",
    accentGlow: "rgba(5,150,105,0.35)",
    highlight: "#F59E0B",
    highlightBg: "rgba(245,158,11,0.15)",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    badge: "#059669",
    ctaBg: "#059669",
    border: "rgba(110,231,183,0.25)",
  },
  laranja: {
    bg: "#1C0A00",
    bgCard: "#2D1200",
    accent: "#EA580C",
    accentLight: "#FCA16A",
    accentGlow: "rgba(234,88,12,0.35)",
    highlight: "#FACC15",
    highlightBg: "rgba(250,204,21,0.15)",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    badge: "#EA580C",
    ctaBg: "#EA580C",
    border: "rgba(252,161,106,0.25)",
  },
};

// ─── Helpers de Canvas ────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 99,
): number {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount++;
      if (lineCount >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
    lineCount++;
  }
  return lineCount;
}

// ─── Renderer principal ───────────────────────────────────────────────────────

export function renderFolhetoCanvas(data: FolhetoData, marca: string): HTMLCanvasElement {
  const W = 794;   // A4 @ 96dpi
  const H = 1123;
  const P = 36;    // padding geral

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const pal = PALETAS[data.paletaCor ?? "roxo"];

  // ── Fundo ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);

  // Gradiente radial de fundo
  const grad = ctx.createRadialGradient(W * 0.5, H * 0.25, 0, W * 0.5, H * 0.25, W * 0.8);
  grad.addColorStop(0, pal.accentGlow);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── Barra lateral esquerda ─────────────────────────────────────────────────
  const barGrad = ctx.createLinearGradient(0, 0, 0, H);
  barGrad.addColorStop(0, pal.accent);
  barGrad.addColorStop(1, pal.accentLight);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, 6, H);

  let curY = P;

  // ── TOPO: marca + tagline ──────────────────────────────────────────────────
  // Marca
  ctx.font = "bold 13px 'Arial'";
  ctx.fillStyle = pal.accentLight;
  ctx.letterSpacing = "3px";
  ctx.fillText(marca.toUpperCase(), P + 8, curY + 14);
  ctx.letterSpacing = "0px";

  // Tagline à direita
  ctx.font = "italic 12px 'Arial'";
  ctx.fillStyle = pal.textMuted;
  ctx.textAlign = "right";
  ctx.fillText(data.tagline, W - P, curY + 14);
  ctx.textAlign = "left";

  curY += 30;

  // Linha separadora topo
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(P + 8, curY);
  ctx.lineTo(W - P, curY);
  ctx.stroke();
  curY += 18;

  // ── BADGE ──────────────────────────────────────────────────────────────────
  const badgeText = data.badge.toUpperCase();
  ctx.font = "bold 11px 'Arial'";
  const badgeW = ctx.measureText(badgeText).width + 22;
  roundRect(ctx, P + 8, curY, badgeW, 22, 11);
  ctx.fillStyle = pal.badge;
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(badgeText, P + 8 + 11, curY + 15);
  curY += 36;

  // ── TÍTULO PRINCIPAL ───────────────────────────────────────────────────────
  ctx.font = "bold 46px 'Arial'";
  ctx.fillStyle = pal.text;
  const lines = wrapText(ctx, data.titulo, P + 8, curY, W - P * 2 - 16, 54, 2);
  curY += lines * 54 + 6;

  // ── SUBTÍTULO ──────────────────────────────────────────────────────────────
  ctx.font = "18px 'Arial'";
  ctx.fillStyle = pal.textMuted;
  const subLines = wrapText(ctx, data.subtitulo, P + 8, curY, W - P * 2 - 16, 26, 2);
  curY += subLines * 26 + 20;

  // ── CAIXA DE DESTAQUE CENTRAL ──────────────────────────────────────────────
  const destH = 100;
  roundRect(ctx, P, curY, W - P * 2, destH, 16);
  const destGrad = ctx.createLinearGradient(P, curY, W - P, curY + destH);
  destGrad.addColorStop(0, pal.accent);
  destGrad.addColorStop(1, pal.accentLight);
  ctx.fillStyle = destGrad;
  ctx.fill();

  // Brilho no destaque
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, P, curY, W - P * 2, destH / 2, 16);
  ctx.fill();

  ctx.font = "bold 30px 'Arial'";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.fillText(data.destaque, W / 2, curY + 38);
  ctx.font = "14px 'Arial'";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(data.destaqueDesc, W / 2, curY + 64);
  ctx.textAlign = "left";
  curY += destH + 22;

  // ── GRID DE PRODUTOS (3 colunas) ───────────────────────────────────────────
  const colW = (W - P * 2 - 20) / 3;
  const cardH = 80;
  data.produtos.slice(0, 3).forEach((prod, i) => {
    const cx = P + i * (colW + 10);
    roundRect(ctx, cx, curY, colW, cardH, 10);
    ctx.fillStyle = pal.bgCard;
    ctx.fill();
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Traço colorido no topo do card
    roundRect(ctx, cx, curY, colW, 3, 2);
    ctx.fillStyle = i === 1 ? pal.highlight : pal.accentLight;
    ctx.fill();

    ctx.font = "bold 13px 'Arial'";
    ctx.fillStyle = pal.text;
    wrapText(ctx, prod.nome, cx + 12, curY + 20, colW - 24, 16, 1);

    ctx.font = "11px 'Arial'";
    ctx.fillStyle = pal.textMuted;
    wrapText(ctx, prod.desc, cx + 12, curY + 40, colW - 24, 14, 3);
  });
  curY += cardH + 22;

  // ── BENEFÍCIOS (2 colunas) ─────────────────────────────────────────────────
  const benefTitulo = "POR QUE ESCOLHER?";
  ctx.font = "bold 13px 'Arial'";
  ctx.fillStyle = pal.accentLight;
  ctx.letterSpacing = "2px";
  ctx.fillText(benefTitulo, P + 8, curY + 12);
  ctx.letterSpacing = "0px";
  curY += 24;

  const halfW = (W - P * 2 - 14) / 2;
  const benefH = 44;
  data.beneficios.slice(0, 4).forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = P + col * (halfW + 14);
    const by = curY + row * (benefH + 8);

    roundRect(ctx, bx, by, halfW, benefH, 8);
    ctx.fillStyle = pal.bgCard;
    ctx.fill();
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "13px 'Arial'";
    ctx.fillStyle = pal.text;
    wrapText(ctx, b, bx + 12, by + 16, halfW - 24, 17, 2);
  });
  curY += Math.ceil(data.beneficios.slice(0, 4).length / 2) * (benefH + 8) + 20;

  // ── CTA ────────────────────────────────────────────────────────────────────
  const ctaH = 64;
  roundRect(ctx, P, curY, W - P * 2, ctaH, 14);
  const ctaGrad = ctx.createLinearGradient(P, curY, W - P, curY + ctaH);
  ctaGrad.addColorStop(0, pal.highlight);
  ctaGrad.addColorStop(1, "#F97316");
  ctx.fillStyle = ctaGrad;
  ctx.fill();

  ctx.font = "bold 22px 'Arial'";
  ctx.fillStyle = "#0F0A00";
  ctx.textAlign = "center";
  ctx.fillText(data.cta, W / 2, curY + 26);
  ctx.font = "13px 'Arial'";
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillText(data.ctaSub, W / 2, curY + 46);
  ctx.textAlign = "left";
  curY += ctaH + 16;

  // ── RODAPÉ ─────────────────────────────────────────────────────────────────
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(P + 8, curY);
  ctx.lineTo(W - P, curY);
  ctx.stroke();
  curY += 12;

  ctx.font = "11px 'Arial'";
  ctx.fillStyle = pal.textMuted;
  ctx.textAlign = "center";
  wrapText(ctx, data.rodape, P + 8, curY, W - P * 2 - 16, 16, 2);
  ctx.textAlign = "left";

  return canvas;
}

// ─── Export PNG ───────────────────────────────────────────────────────────────

export function downloadFolhetoPng(canvas: HTMLCanvasElement, nomeCampanha: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeCampanha.replace(/[^a-z0-9]+/gi, "_")}_folheto.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
