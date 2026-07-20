// components/briefflow/Editable.tsx — Corrigido (não sobrescreve durante edição)
import { useEffect, useRef } from "react";

interface EditableProps {
  value: string;
  onChange: (next: string) => void;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}

export function Editable({
  value,
  onChange,
  as: Tag = "p",
  className,
  multiline = false,
  placeholder,
}: EditableProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // CORREÇÃO: Só atualiza o DOM se o elemento NÃO estiver focado.
    // Isso evita pular o cursor e perder a posição durante a edição.
    if (ref.current && document.activeElement !== ref.current) {
      if (ref.current.innerText !== value) {
        ref.current.innerText = value;
      }
    }
  }, [value]);

  return (
    <Tag
      ref={ref as React.RefObject<HTMLHeadingElement>}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onBlur={(e) => {
        const newText = (e.target as HTMLElement).innerText;
        if (newText !== value) {
          onChange(newText);
        }
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      className={`editable-hover focus:outline-brand focus:outline-2 focus:outline-dashed focus:bg-brand/5 ${className ?? ""}`}
    />
  );
}