import { callLLM } from "./generateMaterials";
import { type StructuredBrief } from "./store";
import jsPDF from "jspdf";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface EspecificacaoTecnica {
  categoria: string;
  itens: { propriedade: string; valor: string }[];
}

export interface FichaTecnicaData {
  nomeProduto: string;
  modelo: string;          // código/modelo do produto
  categoria: string;       // categoria do produto
  descricao: string;       // descrição técnica completa (1-2 parágrafos)
  especificacoes: EspecificacaoTecnica[]; // tabelas de especificações
  aplicacoes: string[];    // casos de uso / aplicações
  diferenciais: string[];  // pontos técnicos de destaque
  certificacoes: string[]; // normas / certificações
  aviso: string;           // observações / avisos técnicos
  revisao: string;         // ex: "Rev. 01 — Mai/2026"
}

// ─── Prompt IA ────────────────────────────────────────────────────────────────

export async function generateFichaTecnicaData(
  textoFicha: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<FichaTecnicaData> {
  const prompt = `Você é um engenheiro técnico especialista em equipamentos laboratoriais e redator de documentação técnica profissional.

Com base no TEXTO DA FICHA e no BRIEF abaixo, identifique o produto principal e estruture uma ficha técnica completa e profissional.

TEXTO DA FICHA TÉCNICA:
${textoFicha}

BRIEF:
- Campanha: ${nomeCampanha}
- Marca: ${brief.marca}
- Produtos/Subcategorias: ${brief.subcategorias?.join(", ") ?? ""}
- Diferenciais técnicos: ${brief.diferenciais_tecnicos?.join("; ") ?? ""}
- Público-alvo: ${brief.publico_alvo}

RETORNE SOMENTE um JSON válido (sem markdown), neste formato exato:
{
  "nomeProduto": "Nome completo do produto identificado",
  "modelo": "Código ou modelo do produto (ex: DLAB-S1)",
  "categoria": "Categoria do equipamento (ex: Pipetador Eletrônico)",
  "descricao": "Descrição técnica completa em 2 parágrafos. Mencione finalidade, tecnologia e mercado.",
  "especificacoes": [
    {
      "categoria": "Especificações Gerais",
      "itens": [
        { "propriedade": "Volume de trabalho", "valor": "0,1 μL a 100 mL" },
        { "propriedade": "Precisão", "valor": "± 0,5%" },
        { "propriedade": "Temperatura de operação", "valor": "15 °C a 40 °C" }
      ]
    },
    {
      "categoria": "Características Técnicas",
      "itens": [
        { "propriedade": "Material do corpo", "valor": "ABS de alta resistência" },
        { "propriedade": "Display", "valor": "LED OLED touchscreen" }
      ]
    },
    {
      "categoria": "Conformidade e Certificações",
      "itens": [
        { "propriedade": "Norma ISO", "valor": "ISO 8655" },
        { "propriedade": "Certificação CE", "valor": "Aprovado" }
      ]
    }
  ],
  "aplicacoes": [
    "Aplicação 1 detalhada",
    "Aplicação 2 detalhada",
    "Aplicação 3 detalhada",
    "Aplicação 4 detalhada"
  ],
  "diferenciais": [
    "Diferencial técnico 1 com detalhe",
    "Diferencial técnico 2 com detalhe",
    "Diferencial técnico 3 com detalhe"
  ],
  "certificacoes": ["ISO 8655", "CE", "RoHS"],
  "aviso": "Texto de aviso técnico ou observações de uso e conservação.",
  "revisao": "Rev. 01 — Mai/2026"
}

REGRAS:
- Identifique o produto pelo nome mais específico possível a partir do texto
- Especificações devem ser reais e coerentes com equipamentos de laboratório
- Use unidades técnicas corretas (μL, mL, °C, %, mm, g, Hz, V)
- Gere pelo menos 3 categorias de especificações com 4-6 itens cada
- Mantenha tom técnico e profissional em todo o documento`;

  const raw = await callLLM(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON válido para a ficha técnica.");
  return JSON.parse(match[0]) as FichaTecnicaData;
}

// ─── Constantes visuais ─────────────────────────────────────────────────────────

// Cores em RGB
const C = {
  navy:       [10, 25, 55]   as [number,number,number],
  accent:     [108, 99, 255] as [number,number,number],
  accentDark: [78, 70, 200]  as [number,number,number],
  white:      [255, 255, 255] as [number,number,number],
  light:      [245, 247, 252] as [number,number,number],
  muted:      [120, 130, 155] as [number,number,number],
  border:     [220, 224, 235] as [number,number,number],
  text:       [30, 35, 55]   as [number,number,number],
  rowAlt:     [249, 250, 253] as [number,number,number],
  green:      [16, 185, 129]  as [number,number,number],
  yellow:     [245, 158, 11]  as [number,number,number],
};

const PAGE_W = 210;  // mm A4
const PAGE_H = 297;
const M = 14;        // margem
const COL = PAGE_W - M * 2;

// ─── Helpers jsPDF ────────────────────────────────────────────────────────────

function rgb(doc: jsPDF, color: [number, number, number], type: "fill" | "text" | "draw" = "fill") {
  if (type === "fill") doc.setFillColor(...color);
  else if (type === "text") doc.setTextColor(...color);
  else doc.setDrawColor(...color);
}

function setFont(doc: jsPDF, weight: "normal" | "bold" | "italic", size: number) {
  doc.setFont("helvetica", weight);
  doc.setFontSize(size);
}

// Texto com quebra automática e retorno do y final
function textBlock(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): number {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lineH;
}

// Caixa de seção com header colorido
function sectionHeader(
  doc: jsPDF,
  title: string,
  y: number,
  icon?: string,
): number {
  rgb(doc, C.navy, "fill");
  doc.roundedRect(M, y, COL, 8, 1, 1, "F");
  setFont(doc, "bold", 9);
  rgb(doc, C.white, "text");
  doc.text((icon ? icon + "  " : "") + title.toUpperCase(), M + 4, y + 5.5);
  return y + 8;
}

// Verifica e adiciona nova página se necessário
function checkPage(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > PAGE_H - 18) {
    addPageFooter(doc);
    doc.addPage();
    addPageHeader(doc, "", false);
    return 22;
  }
  return y;
}

let _marca = "";
let _produto = "";
let _revisao = "";
let _pageNum = 1;

function addPageHeader(doc: jsPDF, _produto: string, showHero = true) {
  if (!showHero) {
    // Cabeçalho compacto para páginas internas
    rgb(doc, C.navy, "fill");
    doc.rect(0, 0, PAGE_W, 10, "F");
    setFont(doc, "bold", 8);
    rgb(doc, C.white, "text");
    doc.text(_marca.toUpperCase(), M, 6.5);
    rgb(doc, C.muted, "text");
    doc.setFontSize(7);
    doc.text("FICHA TÉCNICA — CONTINUAÇÃO", PAGE_W - M, 6.5, { align: "right" });
    _pageNum++;
  }
}

function addPageFooter(doc: jsPDF) {
  const y = PAGE_H - 10;
  rgb(doc, C.border, "fill");
  doc.rect(0, y - 2, PAGE_W, 12, "F");

  setFont(doc, "normal", 7);
  rgb(doc, C.muted, "text");
  doc.text(_marca + " · " + _produto, M, y + 3);
  doc.text(_revisao, PAGE_W / 2, y + 3, { align: "center" });
  doc.text("Pág. " + _pageNum, PAGE_W - M, y + 3, { align: "right" });
}

// ─── Renderizador PDF principal ───────────────────────────────────────────────────

export function generateFichaTecnicaPDF(
  data: FichaTecnicaData,
  marca: string,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Setup globals para footer/header
  _marca = marca;
  _produto = data.nomeProduto;
  _revisao = data.revisao;
  _pageNum = 1;

  // ═══════════════════════════════════════════════════════════
  // HERO HEADER — faixa topo com gradiente simulado
  // ═══════════════════════════════════════════════════════════
  const HERO_H = 44;

  // Fundo escuro principal
  rgb(doc, C.navy, "fill");
  doc.rect(0, 0, PAGE_W, HERO_H, "F");

  // Faixa accent lateral esquerda
  rgb(doc, C.accent, "fill");
  doc.rect(0, 0, 4, HERO_H, "F");

  // Retângulo decorativo direito
  rgb(doc, C.accentDark, "fill");
  doc.roundedRect(PAGE_W - 38, 0, 38, HERO_H, 0, 0, "F");

  // Texto marca (topo esquerdo)
  setFont(doc, "bold", 8);
  rgb(doc, C.accent, "text");
  doc.setCharSpace(2);
  doc.text(marca.toUpperCase(), M, 10);
  doc.setCharSpace(0);

  // Label "FICHA TÉCNICA" (topo esquerdo, abaixo da marca)
  setFont(doc, "normal", 7);
  rgb(doc, C.muted, "text");
  doc.text("FICHA TÉCNICA DE PRODUTO", M, 16);

  // Nome do produto (grande)
  setFont(doc, "bold", 15);
  rgb(doc, C.white, "text");
  const prodLines = doc.splitTextToSize(data.nomeProduto, 140);
  doc.text(prodLines, M, 26);

  // Modelo e categoria (rodapé do hero)
  setFont(doc, "normal", 8);
  rgb(doc, C.muted, "text");
  doc.text(data.modelo + "  ·  " + data.categoria, M, HERO_H - 5);

  // Revisão (lado direito do hero)
  setFont(doc, "normal", 7);
  rgb(doc, C.muted, "text");
  doc.text(data.revisao, PAGE_W - M, HERO_H - 5, { align: "right" });

  // Badges de certificações no hero (canto dir)
  if (data.certificacoes.length) {
    const certs = data.certificacoes.slice(0, 3);
    let bx = PAGE_W - 36;
    let by = 8;
    setFont(doc, "bold", 6);
    certs.forEach((cert) => {
      rgb(doc, C.accent, "fill");
      const tw = doc.getTextWidth(cert) + 4;
      doc.roundedRect(bx, by, tw, 5, 1, 1, "F");
      rgb(doc, C.white, "text");
      doc.text(cert, bx + 2, by + 3.6);
      by += 7;
    });
  }

  let y = HERO_H + 8;

  // ═══════════════════════════════════════════════════════════
  // SEÇÃO 1 — DESCRIÇÃO TÉCNICA
  // ═══════════════════════════════════════════════════════════
  y = sectionHeader(doc, "Descrição Técnica", y, "01");
  y += 4;

  setFont(doc, "normal", 8.5);
  rgb(doc, C.text, "text");
  y = textBlock(doc, data.descricao, M, y, COL, 4.5);
  y += 7;

  // ═══════════════════════════════════════════════════════════
  // SEÇÃO 2 — TABELAS DE ESPECIFICAÇÕES
  // ═══════════════════════════════════════════════════════════
  y = checkPage(doc, y, 30);
  y = sectionHeader(doc, "Especificações Técnicas", y, "02");
  y += 3;

  const COL_PROP = COL * 0.45;
  const COL_VAL  = COL * 0.55;
  const ROW_H = 6.5;

  data.especificacoes.forEach((grupo) => {
    y = checkPage(doc, y, 20);

    // Subtítulo do grupo
    y += 3;
    setFont(doc, "bold", 8);
    rgb(doc, C.accentDark, "text");
    doc.text(grupo.categoria.toUpperCase(), M, y);
    y += 2;

    // Linha de cabeçalho da tabela
    rgb(doc, C.accent, "fill");
    doc.rect(M, y, COL, ROW_H, "F");
    setFont(doc, "bold", 7.5);
    rgb(doc, C.white, "text");
    doc.text("PROPRIEDADE", M + 3, y + 4.3);
    doc.text("VALOR / ESPECIFICAÇÃO", M + COL_PROP + 3, y + 4.3);
    y += ROW_H;

    // Linhas de dados alternadas
    grupo.itens.forEach((item, idx) => {
      y = checkPage(doc, y, ROW_H + 2);

      const rowBg = idx % 2 === 0 ? C.white : C.rowAlt;
      rgb(doc, rowBg, "fill");
      doc.rect(M, y, COL, ROW_H, "F");

      // Linha divisória
      rgb(doc, C.border, "draw");
      doc.setLineWidth(0.1);
      doc.line(M, y + ROW_H, M + COL, y + ROW_H);

      // Coluna divisória vertical
      doc.line(M + COL_PROP, y, M + COL_PROP, y + ROW_H);

      setFont(doc, "bold", 7.5);
      rgb(doc, C.text, "text");
      doc.text(item.propriedade, M + 3, y + 4.3);

      setFont(doc, "normal", 7.5);
      rgb(doc, C.text, "text");
      const valLines = doc.splitTextToSize(item.valor, COL_VAL - 6);
      doc.text(valLines, M + COL_PROP + 3, y + 4.3);

      y += ROW_H * Math.max(1, valLines.length);
    });

    // Borda da tabela
    rgb(doc, C.border, "draw");
    doc.setLineWidth(0.3);
    doc.rect(M, y - grupo.itens.length * ROW_H - ROW_H, COL, grupo.itens.length * ROW_H + ROW_H, "S");

    y += 6;
  });

  // ═══════════════════════════════════════════════════════════
  // SEÇÃO 3 — DOIS PAINEIS LADO A LADO: Aplicações + Diferenciais
  // ═══════════════════════════════════════════════════════════
  y = checkPage(doc, y, 50);

  const HALF = (COL - 5) / 2;
  const panelY = y;

  // —— Painel Esquerdo: Aplicações ——
  rgb(doc, C.light, "fill");
  doc.roundedRect(M, panelY, HALF, 50, 2, 2, "F");
  rgb(doc, C.border, "draw");
  doc.setLineWidth(0.2);
  doc.roundedRect(M, panelY, HALF, 50, 2, 2, "S");

  // Faixa de cabeçalho do painel
  rgb(doc, C.navy, "fill");
  doc.roundedRect(M, panelY, HALF, 8, 2, 2, "F");
  doc.rect(M, panelY + 4, HALF, 4, "F"); // quadrado nos cantos inferiores

  setFont(doc, "bold", 8);
  rgb(doc, C.white, "text");
  doc.text("APLICAÇÕES", M + 4, panelY + 5.5);

  let py = panelY + 12;
  data.aplicacoes.slice(0, 5).forEach((ap) => {
    // Bullet com círculo colorido
    rgb(doc, C.green, "fill");
    doc.circle(M + 4, py - 0.5, 1, "F");

    setFont(doc, "normal", 7.5);
    rgb(doc, C.text, "text");
    const lines = doc.splitTextToSize(ap, HALF - 14);
    doc.text(lines, M + 8, py);
    py += 4 * lines.length + 1;
  });

  // —— Painel Direito: Diferenciais ——
  const rx = M + HALF + 5;
  rgb(doc, C.light, "fill");
  doc.roundedRect(rx, panelY, HALF, 50, 2, 2, "F");
  rgb(doc, C.border, "draw");
  doc.setLineWidth(0.2);
  doc.roundedRect(rx, panelY, HALF, 50, 2, 2, "S");

  rgb(doc, C.accent, "fill");
  doc.roundedRect(rx, panelY, HALF, 8, 2, 2, "F");
  doc.rect(rx, panelY + 4, HALF, 4, "F");

  setFont(doc, "bold", 8);
  rgb(doc, C.white, "text");
  doc.text("DIFERENCIAIS TÉCNICOS", rx + 4, panelY + 5.5);

  let dy = panelY + 12;
  data.diferenciais.slice(0, 5).forEach((dif) => {
    // Bullet com losango
    rgb(doc, C.yellow, "fill");
    doc.circle(rx + 4, dy - 0.5, 1, "F");

    setFont(doc, "normal", 7.5);
    rgb(doc, C.text, "text");
    const lines = doc.splitTextToSize(dif, HALF - 14);
    doc.text(lines, rx + 8, dy);
    dy += 4 * lines.length + 1;
  });

  y = panelY + 55;

  // ═══════════════════════════════════════════════════════════
  // SEÇÃO 4 — AVISO / OBSERVAÇÕES
  // ═══════════════════════════════════════════════════════════
  if (data.aviso) {
    y = checkPage(doc, y, 22);

    // Caixa de aviso com borda amarela
    rgb(doc, [254, 252, 232], "fill");
    doc.roundedRect(M, y, COL, 18, 2, 2, "F");
    rgb(doc, C.yellow, "draw");
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, COL, 18, 2, 2, "S");

    // Faixa amarela lateral
    rgb(doc, C.yellow, "fill");
    doc.roundedRect(M, y, 3, 18, 1, 1, "F");

    setFont(doc, "bold", 7.5);
    rgb(doc, [120, 90, 0], "text");
    doc.text("⚠  OBSERVAÇÕES TÉCNICAS", M + 6, y + 5.5);

    setFont(doc, "normal", 7.5);
    rgb(doc, C.text, "text");
    textBlock(doc, data.aviso, M + 6, y + 10, COL - 10, 4);

    y += 22;
  }

  // Footer da última página
  addPageFooter(doc);

  return doc;
}

// ─── Download ──────────────────────────────────────────────────────────────────────────

export function downloadFichaTecnicaPDF(doc: jsPDF, nomeProduto: string, nomeCampanha: string): void {
  const slug = (nomeProduto || nomeCampanha).replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`${slug}_ficha_tecnica.pdf`);
}
