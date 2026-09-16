import { sanitizeFilenamePart } from "./export-utils";
import type { StructuredContentDocument } from "../types/builder";

const DEFAULT_PRIMARY = "6D5CE7";
const DEFAULT_SECONDARY = "241F3A";
const PAGE_MARGIN = 18;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHex(value: string | undefined, fallback: string): string {
  const normalized = clean(value).replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function exportFilename(
  format: "slides" | "technical_sheet",
  brandName: string | undefined,
  title: string,
  extension: "pptx" | "pdf",
): string {
  const subject = clean(brandName) || clean(title) || "material";
  return `${sanitizeFilenamePart(`${format}_${subject}`)}.${extension}`;
}

export async function exportSlidesPowerPoint(
  document: StructuredContentDocument,
  brandName?: string,
  themeColor?: string,
  secondaryColor?: string,
): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  const primary = normalizeHex(themeColor, DEFAULT_PRIMARY);
  const secondary = normalizeHex(secondaryColor, DEFAULT_SECONDARY);

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "BrieFlow";
  pptx.company = clean(brandName) || "BrieFlow";
  pptx.subject = clean(document.summary) || document.title;
  pptx.title = document.title;
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };

  const cover = pptx.addSlide();
  cover.background = { color: secondary };
  cover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.22,
    h: 7.5,
    line: { color: primary, transparency: 100 },
    fill: { color: primary },
  });
  cover.addText(clean(brandName) || "APRESENTAÇÃO", {
    x: 0.8,
    y: 0.75,
    w: 7.4,
    h: 0.35,
    color: primary,
    fontFace: "Aptos",
    fontSize: 12,
    bold: true,
    charSpacing: 2,
    margin: 0,
  });
  cover.addText(document.title, {
    x: 0.8,
    y: 1.55,
    w: 11.4,
    h: 1.75,
    color: "FFFFFF",
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    breakLine: false,
    fit: "shrink",
    margin: 0,
    valign: "middle",
  });
  if (clean(document.subtitle) || clean(document.summary)) {
    cover.addText(clean(document.subtitle) || clean(document.summary), {
      x: 0.82,
      y: 3.55,
      w: 9.8,
      h: 1.15,
      color: "D8D5E6",
      fontFace: "Aptos",
      fontSize: 17,
      fit: "shrink",
      margin: 0,
      valign: "top",
    });
  }
  cover.addText(`${document.sections.length} slides · gerado no BrieFlow`, {
    x: 0.82,
    y: 6.6,
    w: 5.2,
    h: 0.3,
    color: "A8A3BB",
    fontSize: 10,
    margin: 0,
  });

  document.sections.forEach((section, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: "F7F6FB" };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.14,
      line: { color: primary, transparency: 100 },
      fill: { color: primary },
    });
    slide.addText(String(index + 1).padStart(2, "0"), {
      x: 0.72,
      y: 0.55,
      w: 0.55,
      h: 0.35,
      color: primary,
      fontSize: 12,
      bold: true,
      margin: 0,
    });
    slide.addText(section.title || `Slide ${index + 1}`, {
      x: 1.35,
      y: 0.46,
      w: 10.9,
      h: 0.7,
      color: secondary,
      fontFace: "Aptos Display",
      fontSize: 23,
      bold: true,
      fit: "shrink",
      margin: 0,
    });

    const hasItems = Boolean(section.items?.filter(clean).length);
    const bodyWidth = hasItems ? 7.15 : 11.75;
    if (clean(section.body)) {
      slide.addText(section.body, {
        x: 0.75,
        y: 1.48,
        w: bodyWidth,
        h: 4.65,
        color: "343047",
        fontSize: 17,
        breakLine: false,
        fit: "shrink",
        margin: 0.08,
        valign: "top",
      });
    }

    if (hasItems) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 8.25,
        y: 1.42,
        w: 4.25,
        h: 4.8,
        rectRadius: 0.08,
        line: { color: "DED9F3", width: 1 },
        fill: { color: "EFECFA" },
      });
      const items = section.items
        ?.map(clean)
        .filter(Boolean)
        .map((item) => `• ${item}`)
        .join("\n\n");
      slide.addText(items || "", {
        x: 8.6,
        y: 1.78,
        w: 3.55,
        h: 4.05,
        color: secondary,
        fontSize: 14,
        fit: "shrink",
        margin: 0,
        breakLine: false,
        valign: "top",
      });
    }

    const footer = [clean(section.timing), clean(section.visualDirection)]
      .filter(Boolean)
      .join(" · ");
    if (footer) {
      slide.addText(footer, {
        x: 0.75,
        y: 6.75,
        w: 11.8,
        h: 0.35,
        color: "777188",
        fontSize: 9,
        italic: true,
        fit: "shrink",
        margin: 0,
      });
    }
    if (clean(section.speakerNotes)) {
      slide.addNotes(clean(section.speakerNotes));
    }
  });

  await pptx.writeFile({
    fileName: exportFilename("slides", brandName, document.title, "pptx"),
    compression: true,
  });
}

export async function exportTechnicalSheetPdf(
  document: StructuredContentDocument,
  brandName?: string,
  themeColor?: string,
  secondaryColor?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const primaryHex = normalizeHex(themeColor, DEFAULT_PRIMARY);
  const secondaryHex = normalizeHex(secondaryColor, DEFAULT_SECONDARY);
  const primary = hexToRgb(primaryHex);
  const secondary = hexToRgb(secondaryHex);
  const maxWidth = 210 - PAGE_MARGIN * 2;
  let y = 18;

  const ensureSpace = (height: number) => {
    if (y + height <= 279) return;
    pdf.addPage();
    y = 18;
  };
  const addWrapped = (
    value: string,
    options: {
      size?: number;
      style?: "normal" | "bold" | "italic";
      color?: [number, number, number];
      indent?: number;
      spacingAfter?: number;
    } = {},
  ) => {
    const text = clean(value);
    if (!text) return;
    const size = options.size ?? 10;
    const indent = options.indent ?? 0;
    const width = maxWidth - indent;
    pdf.setFont("helvetica", options.style ?? "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? [48, 46, 58]));
    const lines = pdf.splitTextToSize(text, width) as string[];
    const lineHeight = size * 0.42;
    ensureSpace(lines.length * lineHeight + (options.spacingAfter ?? 2));
    pdf.text(lines, PAGE_MARGIN + indent, y);
    y += lines.length * lineHeight + (options.spacingAfter ?? 2);
  };

  pdf.setFillColor(...secondary);
  pdf.rect(0, 0, 210, 48, "F");
  pdf.setFillColor(...primary);
  pdf.rect(0, 0, 5, 48, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("FICHA TÉCNICA DO PRODUTO", PAGE_MARGIN, 15);
  pdf.setFontSize(21);
  const titleLines = pdf.splitTextToSize(document.title, maxWidth) as string[];
  pdf.text(titleLines.slice(0, 2), PAGE_MARGIN, 25);
  if (clean(brandName)) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(220, 218, 230);
    pdf.text(brandName!, PAGE_MARGIN, 43);
  }
  y = 59;

  addWrapped(document.subtitle || "", {
    size: 12,
    style: "bold",
    color: secondary,
    spacingAfter: 3,
  });
  addWrapped(document.summary || "", { size: 10, spacingAfter: 6 });

  document.sections.forEach((section, index) => {
    ensureSpace(22);
    pdf.setDrawColor(224, 221, 235);
    pdf.setFillColor(248, 247, 252);
    pdf.roundedRect(PAGE_MARGIN, y - 4, maxWidth, 10, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...primary);
    pdf.text(
      `${String(index + 1).padStart(2, "0")}  ${section.title}`,
      22,
      y + 2,
    );
    y += 12;

    addWrapped(section.body, { size: 9.5, spacingAfter: 3 });
    section.items
      ?.map(clean)
      .filter(Boolean)
      .forEach((item) => {
        addWrapped(`• ${item}`, { size: 9.5, indent: 4, spacingAfter: 1.8 });
      });
    if (clean(section.speakerNotes)) {
      addWrapped(`Nota técnica: ${section.speakerNotes}`, {
        size: 8.5,
        style: "italic",
        color: [100, 96, 112],
        spacingAfter: 3,
      });
    }
    y += 3;
  });

  ensureSpace(26);
  pdf.setDrawColor(...primary);
  pdf.line(PAGE_MARGIN, y, 210 - PAGE_MARGIN, y);
  y += 7;
  addWrapped(
    document.disclaimer ||
      "Documento elaborado somente com informações confirmadas na campanha. Campos técnicos não fornecidos devem ser validados antes da publicação.",
    {
      size: 8.5,
      style: "italic",
      color: [92, 88, 104],
      spacingAfter: 2,
    },
  );

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 116, 130);
    pdf.text("Gerado no BrieFlow", PAGE_MARGIN, 290);
    pdf.text(`${page} / ${pageCount}`, 210 - PAGE_MARGIN, 290, {
      align: "right",
    });
  }

  pdf.save(exportFilename("technical_sheet", brandName, document.title, "pdf"));
}
