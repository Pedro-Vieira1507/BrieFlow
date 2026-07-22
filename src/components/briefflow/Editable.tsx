import { useEffect, useRef } from "react";
import { Edit2 } from "lucide-react";

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
    if (ref.current && document.activeElement !== ref.current) {
      // Impede null ou string vazia quebrando marca (Fallback de segurança)
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
        className={`editable-hover focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/5 rounded-md px-1 -ml-1 transition-all ${className ?? ""}`}
      />
      <div className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/editable:opacity-100 transition-opacity pointer-events-none text-white/30">
        <Edit2 className="size-3.5" />
      </div>
    </div>
  );
}