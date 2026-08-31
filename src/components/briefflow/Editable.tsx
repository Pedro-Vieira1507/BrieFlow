// src/components/briefflow/Editable.tsx
import { useEffect, useRef } from "react";
import { Edit2 } from "lucide-react";

interface EditableProps {
  value: string;
  onChange: (next: string) => void;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  style?: React.CSSProperties; // <-- ADICIONADO: Suporte a estilos inline (Cores, Opacidade, etc)
}

export function Editable({
  value,
  onChange,
  as: Tag = "p",
  className,
  multiline = false,
  placeholder,
  style, // <-- ADICIONADO
}: EditableProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      const safeValue = value?.trim() || "Sua Marca";
      if (ref.current.innerText !== safeValue) {
        ref.current.innerText = safeValue;
      }
    }
  }, [value]);

  return (
    <div className="relative group/editable inline-block w-full">
      <Tag
        ref={ref as React.RefObject<HTMLHeadingElement>}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={style} // <-- ADICIONADO: Repassando o estilo final para o HTML
        onBlur={(e) => {
          const newText = (e.target as HTMLElement).innerText;
          if (newText !== value) onChange(newText);
        }}
        onKeyDown={(e) => {
          if (!multiline && e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          }
        }}
        // UX: Adicionado cursor-text, empty states e transições mais suaves
        className={`editable-hover cursor-text focus:outline-none focus:ring-2 focus:ring-[rgba(59,130,246,0.6)] focus:bg-[rgba(255,255,255,0.08)] rounded-md px-1.5 -ml-1.5 transition-all duration-200 empty:before:content-[attr(data-placeholder)] empty:before:text-inherit empty:before:opacity-40 empty:before:italic ${className ?? ""}`}
      />
      <div data-export-exclude="true" className="absolute -right-7 top-1/2 -translate-y-1/2 opacity-0 group-hover/editable:opacity-100 transition-opacity duration-300 pointer-events-none text-white/50 bg-black/20 rounded-full p-1 backdrop-blur-sm">
        <Edit2 className="size-3.5" />
      </div>
    </div>
  );
}
