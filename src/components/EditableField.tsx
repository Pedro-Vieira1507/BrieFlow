import { useRef, useEffect, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Visual tag rendered — div by default, h1/h2/p/span/etc */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  placeholder?: string;
  /** Allow line breaks with Shift+Enter when true */
  multiline?: boolean;
  /** If true, renders as plain text (no HTML content) */
  plainText?: boolean;
}

/**
 * EditableField — a single editable piece of content.
 *
 * Renders as the `as` element with contentEditable enabled.
 * A dashed outline appears on hover, a solid ring on focus.
 * Pressing Enter (without Shift) in single-line mode blurs the element.
 */
export function EditableField({
  value,
  onChange,
  as: Tag = "div",
  className,
  placeholder = "Clique para editar…",
  multiline = false,
  plainText = true,
}: EditableFieldProps) {
  const ref = useRef<HTMLElement>(null);

  // Keep DOM in sync when value changes from outside (e.g. AI refine)
  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  function handleInput() {
    if (ref.current) onChange(ref.current.innerText);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === "Enter" && multiline && !e.shiftKey) {
      e.preventDefault();
      ref.current?.blur();
    }
  }

  return (
    // @ts-expect-error — dynamic tag
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
      className={cn(
        "editable-field outline-none transition-all duration-150",
        "hover:ring-1 hover:ring-dashed hover:ring-primary/40 hover:rounded-sm",
        "focus:ring-2 focus:ring-primary focus:rounded-sm focus:bg-primary/5",
        "cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none",
        className
      )}
    />
  );
}
