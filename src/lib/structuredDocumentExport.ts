import { downloadBlob, sanitizeFilenamePart } from "./export-utils.ts";
import { formatStructuredContentText } from "./structuredContent.ts";

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

export async function buildSlideDeck(
  document: StructuredContentDocument,
  brandName?: string,
): Promise<ArrayBuffer> {
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

  if (!document.sections.length)
    throw new Error("Adicione um slide antes de exportar.");

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

    const notes = [
      index === 0
        ? [document.title, document.subtitle, document.summary]
            .map((value) => clean(value))
            .filter(Boolean)
            .join("\n")
        : "",
      clean(section.timing),
      clean(section.visualDirection),
      clean(section.speakerNotes),
    ].filter(Boolean);
    if (notes.length) slide.addNotes(notes.join("\n\n"));

    if (index === document.sections.length - 1) {
      const visible = [section.title, section.body, ...(section.items ?? [])]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      const footer = [document.cta, document.disclaimer]
        .map((value) => clean(value))
        .filter(
          (value) =>
            value && !visible.includes(value.toLocaleLowerCase("pt-BR")),
        )
        .join("  •  ");
      if (footer)
        slide.addText(footer, {
          x: 0.78,
          y: 6.47,
          w: 11.8,
          h: 0.65,
          color: MUTED,
          fontSize: 13,
          margin: 0,
          fit: "shrink",
        });
    }
  });

  const raw = await pptx.write({
    outputType: "arraybuffer",
    compression: true,
  });
  if (!(raw instanceof ArrayBuffer))
    throw new Error("Não foi possível preparar a apresentação.");
  const { normalizePptxPackage } = await import("./pptxPackage.ts");
  return normalizePptxPackage(raw);
}

export async function buildTechnicalSheet(
  document: StructuredContentDocument,
  brandName?: string,
): Promise<Blob> {
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
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, margin + indent, y);
      y += lineHeight;
    }
    y += options.gap ?? 4;
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

  return pdf.output("blob");
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
    const file = await buildSlideDeck(document, brandName);
    downloadBlob(
      new Blob([file], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
      `${exportBaseName(document, brandName)}.pptx`,
    );
    return "PPTX";
  }
  if (document.format === "technical_sheet") {
    downloadBlob(
      await buildTechnicalSheet(document, brandName),
      `${exportBaseName(document, brandName)}.pdf`,
    );
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
