import type { ReactNode } from "react";
import { OptimizedImage } from "@/components/briefflow/OptimizedImage";

/**
 * Mini-parser markdown com suporte a: imagens, bold, italic, quebras de linha.
 * Extraído do ChatPanel original + adaptado para usar OptimizedImage.
 */
export function Markdown({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const imageMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/\*(.+?)\*/);
    const newlineIdx = remaining.indexOf("\n");

    let next: {
      idx: number;
      len: number;
      type: "image" | "bold" | "italic" | "newline";
      text: string;
      url?: string;
    } | null = null;

    if (imageMatch?.index !== undefined) {
      next = {
        idx: imageMatch.index,
        len: imageMatch[0].length,
        type: "image",
        text: imageMatch[1],
        url: imageMatch[2],
      };
    }
    if (
      boldMatch?.index !== undefined &&
      (!next || boldMatch.index < next.idx)
    ) {
      next = {
        idx: boldMatch.index,
        len: boldMatch[0].length,
        type: "bold",
        text: boldMatch[1],
      };
    }
    if (
      italicMatch?.index !== undefined &&
      (!next || italicMatch.index < next.idx)
    ) {
      next = {
        idx: italicMatch.index,
        len: italicMatch[0].length,
        type: "italic",
        text: italicMatch[1],
      };
    }
    if (newlineIdx !== -1 && (!next || newlineIdx < next.idx)) {
      next = { idx: newlineIdx, len: 1, type: "newline", text: "" };
    }

    if (!next) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (next.idx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, next.idx)}</span>);
    }

    if (next.type === "image") {
      parts.push(
        <div key={key++} className="my-3 max-w-[280px]">
          <OptimizedImage
            src={next.url}
            alt={next.text}
            aspect="square"
            rounded="rounded-lg"
            className="border border-border-strong"
          />
        </div>,
      );
    } else if (next.type === "bold") {
      parts.push(
        <strong key={key++} className="font-semibold text-fg-primary">
          {next.text}
        </strong>,
      );
    } else if (next.type === "italic") {
      parts.push(
        <em key={key++} className="text-fg-secondary">
          {next.text}
        </em>,
      );
    } else if (next.type === "newline") {
      parts.push(<br key={key++} />);
    }

    remaining = remaining.slice(next.idx + next.len);
  }

  return <span>{parts}</span>;
}
