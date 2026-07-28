import { useRef, useState } from "react";
import { Send, Paperclip, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBriefflowStore } from "@/store/briefflow";

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadedImage, setUploadedImage } = useBriefflowStore();

  const submit = () => {
    const t = value.trim();
    if (!t && !uploadedImage) return;
    onSend(t || "Imagem enviada.");
    setValue("");
    requestAnimationFrame(() => ref.current?.focus());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="border-t border-border-subtle p-4">
      {/* PREVIEW DO ANEXO */}
      {uploadedImage && (
        <div className="relative mb-3 inline-block animate-in fade-in zoom-in duration-200">
          <img src={uploadedImage} alt="Upload preview" className="h-16 w-16 object-cover rounded-lg border border-border-strong shadow-md" />
          <button 
            onClick={() => setUploadedImage(null)} 
            className="absolute -top-2 -right-2 bg-surface-3 rounded-full p-1 border border-border-strong text-fg-muted hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "relative rounded-2xl border border-border-strong bg-surface-2",
          "transition-all focus-within:border-brand/50 focus-within:ring-1 focus-within:ring-brand/40",
          "shadow-[var(--shadow-soft)]",
        )}
      >
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Descreva a peça, cole URL ou anexe imagem..."
          rows={2}
          disabled={disabled}
          className={cn(
            "min-h-[60px] resize-none border-0 bg-transparent py-4 pl-12 pr-14",
            "text-[14px] leading-relaxed text-fg-primary placeholder:text-fg-muted",
            "focus-visible:ring-0",
          )}
        />
        
        {/* BOTÃO DE ANEXO */}
        <input 
          type="file" 
          accept="image/*" 
          ref={fileRef} 
          className="hidden" 
          onChange={handleFileChange} 
        />
        <button 
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="absolute left-3 top-3.5 text-fg-muted hover:text-brand transition-colors disabled:opacity-50"
        >
          <Paperclip className="size-5" />
        </button>

        <Button
          size="icon"
          onClick={submit}
          disabled={disabled || (!value.trim() && !uploadedImage)}
          aria-label="Enviar mensagem"
          className={cn(
            "absolute bottom-2 right-2 size-9 rounded-xl",
            "bg-brand text-brand-fg hover:brightness-110 transition-all",
            "shadow-[var(--shadow-brand)] disabled:shadow-none disabled:opacity-40",
          )}
        >
          <Send className="size-4" />
        </Button>
      </div>
      <p className="mt-2 px-1 text-[10px] uppercase tracking-widest text-fg-muted text-center">
        Enter para enviar • Shift + Enter para nova linha
      </p>
    </div>
  );
}