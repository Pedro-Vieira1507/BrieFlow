// src/components/briefflow/chat/ChatInput.tsx
import { useRef, useState, useEffect } from "react";
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
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  
  // O user e setAuthOpen não são mais necessários aqui
  const { uploadedImage, setUploadedImage } = useBriefflowStore();

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="p-4 bg-gradient-to-t from-surface-1 via-surface-1 to-transparent pt-6 relative z-10">
      
      {/* PREVIEW DO ANEXO */}
      {uploadedImage && (
        <div className="relative mb-3 inline-block animate-in fade-in zoom-in duration-200 ml-2">
          <img src={uploadedImage} alt="Upload preview" className="h-14 w-14 object-cover rounded-xl border border-border-strong shadow-lg" />
          <button 
            onClick={() => setUploadedImage(null)} 
            className="absolute -top-2 -right-2 bg-surface-3 rounded-full p-1 border border-border-strong text-fg-muted hover:text-rose-400 hover:bg-rose-400/10 transition-colors shadow-md"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* INPUT COM GLASSMORPHISM */}
      <div
        className={cn(
          "relative rounded-2xl glass-strong border border-border-strong",
          "transition-all duration-300 focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/20",
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
          placeholder="Mensagem para a IA..."
          rows={1}
          disabled={disabled}
          className={cn(
            "min-h-[56px] max-h-[160px] resize-none border-0 bg-transparent py-4 pl-12 pr-14",
            "text-[14.5px] leading-relaxed text-fg-primary placeholder:text-fg-muted",
            "focus-visible:ring-0",
          )}
        />
        
        {mounted && (
          <input 
            type="file" 
            accept="image/*" 
            ref={fileRef} 
            className="hidden" 
            onChange={handleFileChange}
            suppressHydrationWarning
          />
        )}
        
        <button 
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="absolute left-3 top-3.5 p-1 rounded-full text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors disabled:opacity-50"
        >
          <Paperclip className="size-5" />
        </button>

        <Button
          size="icon"
          onClick={submit}
          disabled={disabled || (!value.trim() && !uploadedImage)}
          aria-label="Enviar mensagem"
          className={cn(
            "absolute bottom-2 right-2 size-10 rounded-xl",
            "bg-brand text-brand-fg hover:brightness-110 hover:scale-105 transition-all duration-300",
            "shadow-[var(--shadow-brand)] disabled:shadow-none disabled:opacity-30 disabled:hover:scale-100",
          )}
        >
          <Send className="size-4 ml-0.5" />
        </Button>
      </div>

      <p className="mt-2 text-[10px] text-fg-tertiary text-center font-medium">
        A IA pode cometer erros. Revise o conteúdo gerado.
      </p>
    </div>
  );
}