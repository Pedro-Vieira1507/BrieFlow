import { downloadBlob, sanitizeFilenamePart } from "./export-utils";
import { formatStructuredContentText } from "./structuredContent";

import type { StructuredContentDocument } from "../types/builder";

const BRAND_PURPLE = "7C69FF";
const INK = "171A24";
const MUTED = "5E6475";
const PAPER = "F7F7FB";

function clean(value: unknown, maxLength = 8_000): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function exportBaseName(
  document: StructuredContentDocument,
  brandName?: string,
): string {
  return sanitizeFilenamePart(
    `${document.format}_${clean(brandName, 120) || document.title}`,
  );
}

async function exportSlides(
  document: StructuredContentDocument,
  brandName?: string,
): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "BrieFlow";
  pptx.company = clean(brandName, 120) || "BrieFlow";
  pptx.subject = clean(document.summary, 300);
  pptx.title = clean(document.title, 180);
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };

  const cover = pptx.addSlide();
  cover.background = { color: INK };
  cover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.18,
    h: 7.5,
    fill: { color: BRAND_PURPLE },
    line: { color: BRAND_PURPLE },
  });
  cover.addText(clean(brandName, 120) || "Apresentação comercial", {
    x: 0.72,
    y: 0.7,
    w: 11.8,
    h: 0.35,
    color: "B7AECF",
    fontFace: "Aptos",
    fontSize: 12,
    bold: true,
    charSpacing: 1.8,
    margin: 0,
    breakLine: false,
  });
  cover.addText(clean(document.title, 220), {
    x: 0.72,
    y: 1.65,
    w: 11.4,
    h: 1.55,
    color: "FFFFFF",
    fontFace: "Aptos Display",
    fontSize: 34,
    bold: true,
    margin: 0,
    valign: "middle",
    breakLine: false,
  });
  const coverCopy = clean(document.subtitle) || clean(document.summary);
  if (coverCopy) {
    cover.addText(coverCopy, {
      x: 0.75,
      y: 3.45,
      w: 10.5,
      h: 1.2,
      color: "D7D9E3",
      fontFace: "Aptos",
      fontSize: 18,
      margin: 0,
      breakLine: false,
    });
  }
  cover.addText("Gerado e editável no BrieFlow", {
    x: 0.75,
    y: 6.75,
    w: 4.8,
    h: 0.25,
    color: "8F95A7",
    fontSize: 9,
    margin: 0,
    breakLine: false,
  });

  document.sections.forEach((section, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: PAPER };
    slide.addText(String(index + 1).padStart(2, "0"), {
      x: 0.65,
      y: 0.45,
      w: 0.55,
      h: 0.3,
      color: BRAND_PURPLE,
      bold: true,
      fontSize: 12,
      margin: 0,
      breakLine: false,
    });
    slide.addText(clean(section.title, 180) || `Slide ${index + 1}`, {
      x: 1.3,
      y: 0.38,
      w: 10.9,
      h: 0.65,
      color: INK,
      fontFace: "Aptos Display",
      fontSize: 25,
      bold: true,
      margin: 0,
      breakLine: false,
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.65,
      y: 1.23,
      w: 12,
      h: 0,
      line: { color: "DDDDE7", width: 1 },
    });

    const body = clean(section.body);
    if (body) {
      slide.addText(body, {
        x: 0.78,
        y: 1.65,
        w: section.items?.length ? 7.1 : 11.7,
        h: 4.65,
        color: INK,
        fontFace: "Aptos",
        fontSize: 19,
        breakLine: false,
        valign: "top",
        margin: 0,
        fit: "shrink",
      });
    }

    if (section.items?.length) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 8.25,
        y: 1.65,
        w: 4.35,
        h: 4.65,
        rectRadius: 0.08,
        fill: { color: "ECEAFD" },
        line: { color: "DCD7FF", width: 1 },
      });
      slide.addText(
        section.items.slice(0, 10).map((item) => ({
          text: clean(item, 500),
          options: {
            bullet: { indent: 16 },
            breakLine: true,
          },
        })),
        {
          x: 8.55,
          y: 1.95,
          w: 3.75,
          h: 4.05,
          color: INK,
          fontSize: 15,
          breakLine: false,
          margin: 0,
          paraSpaceAfter: 11,
          valign: "top",
          fit: "shrink",
        },
      );
    }

    const footer = [
      clean(section.timing, 80),
      clean(section.visualDirection, 300),
    ]
      .filter(Boolean)
      .join("  •  ");
    if (footer) {
      slide.addText(footer, {
        x: 0.78,
        y: 6.72,
        w: 11.8,
        h: 0.3,
        color: MUTED,
        fontSize: 9,
        italic: true,
        margin: 0,
        breakLine: false,
      });
    }
    if (clean(section.speakerNotes)) {
      slide.addNotes(clean(section.speakerNotes));
    }
  });

  if (clean(document.cta) || clean(document.disclaimer)) {
    const closing = pptx.addSlide();
    closing.background = { color: INK };
    closing.addText(clean(document.cta) || "Próximos passos", {
      x: 0.85,
      y: 2.1,
      w: 11.6,
      h: 1.1,
      color: "FFFFFF",
      fontSize: 32,
      bold: true,
      align: "center",
      margin: 0,
      breakLine: false,
    });
    if (clean(document.disclaimer)) {
      closing.addText(clean(document.disclaimer), {
        x: 1.25,
        y: 4.8,
        w: 10.8,
        h: 0.8,
        color: "A8ADBC",
        fontSize: 10,
        align: "center",
        margin: 0,
        breakLine: false,
      });
    }
  }

  const raw = await pptx.write({
    outputType: "arraybuffer",
    compression: true,
  });
  if (!(raw instanceof ArrayBuffer))
    throw new Error("Não foi possível preparar a apresentação.");
  const { normalizePptxPackage } = await import("./pptxPackage");
  const file = await normalizePptxPackage(raw);
  downloadBlob(
    new Blob([file], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }),
    `${exportBaseName(document, brandName)}.pptx`,
  );
}

async function exportTechnicalSheetPdf(
  document: StructuredContentDocument,
  brandName?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    pdf.addPage();
    y = 18;
  };

  const write = (
    value: string,
    options: {
      size?: number;
      color?: [number, number, number];
      bold?: boolean;
      gap?: number;
      indent?: number;
    } = {},
  ) => {
    const text = clean(value);
    if (!text) return;
    const size = options.size ?? 10.5;
    const indent = options.indent ?? 0;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? [36, 39, 50]));
    const lines = pdf.splitTextToSize(text, contentWidth - indent);
    const lineHeight = size * 0.44;
    ensureSpace(lines.length * lineHeight + (options.gap ?? 4));
    pdf.text(lines, margin + indent, y);
    y += lines.length * lineHeight + (options.gap ?? 4);
  };

  pdf.setFillColor(23, 26, 36);
  pdf.rect(0, 0, pageWidth, 48, "F");
  pdf.setFillColor(124, 105, 255);
  pdf.rect(0, 0, 5, 48, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(21);
  const titleLines = pdf.splitTextToSize(
    clean(document.title, 220),
    contentWidth,
  );
  pdf.text(titleLines, margin, 21);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(205, 208, 220);
  pdf.text(clean(brandName, 120) || "Ficha técnica", margin, 41);
  y = 60;

  write(document.subtitle ?? "", { size: 13, bold: true, gap: 5 });
  write(document.summary ?? "", { color: [77, 82, 98], gap: 7 });

  document.sections.forEach((section, index) => {
    ensureSpace(22);
    pdf.setDrawColor(222, 220, 240);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 7;
    write(
      `${String(index + 1).padStart(2, "0")}  ${clean(section.title, 180)}`,
      {
        size: 13,
        bold: true,
        color: [45, 37, 103],
        gap: 4,
      },
    );
    write(section.body, { gap: 3 });
    section.items?.forEach((item) =>
      write(`• ${clean(item, 800)}`, { indent: 3, gap: 2 }),
    );
    if (clean(section.visualDirection)) {
      write(`Aplicação/observação: ${clean(section.visualDirection)}`, {
        size: 9,
        color: [92, 98, 117],
        gap: 3,
      });
    }
  });

  if (document.keywords?.length) {
    write(`Palavras-chave: ${document.keywords.join(", ")}`, {
      size: 9,
      color: [92, 98, 117],
      gap: 4,
    });
  }
  if (clean(document.disclaimer)) {
    write(`Observações: ${clean(document.disclaimer)}`, {
      size: 8.5,
      color: [110, 82, 32],
      gap: 4,
    });
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(130, 134, 148);
    pdf.text(
      "BrieFlow • revise especificações antes da publicação",
      margin,
      pageHeight - 9,
    );
    pdf.text(`${page}/${pages}`, pageWidth - margin, pageHeight - 9, {
      align: "right",
    });
  }

  pdf.save(`${exportBaseName(document, brandName)}.pdf`);
}

export function structuredExportLabel(
  document: StructuredContentDocument,
): "PPTX" | "PDF" | "TXT" {
  if (document.format === "slides") return "PPTX";
  if (document.format === "technical_sheet") return "PDF";
  return "TXT";
}

export async function exportStructuredDocument(
  document: StructuredContentDocument,
  brandName?: string,
): Promise<"PPTX" | "PDF" | "TXT"> {
  if (document.format === "slides") {
    await exportSlides(document, brandName);
    return "PPTX";
  }
  if (document.format === "technical_sheet") {
    await exportTechnicalSheetPdf(document, brandName);
    return "PDF";
  }

  downloadBlob(
    new Blob([formatStructuredContentText(document)], {
      type: "text/plain;charset=utf-8",
    }),
    `${exportBaseName(document, brandName)}.txt`,
  );
  return "TXT";
}
