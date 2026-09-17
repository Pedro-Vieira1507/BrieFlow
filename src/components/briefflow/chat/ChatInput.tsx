// src/components/briefflow/chat/ChatInput.tsx
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (text: string) => void;
  onAttachImage?: (file: File) => Promise<void>;
  onRemoveImage?: () => void;
  attachedImage?: string | null;
  disabled?: boolean;
}

const IMAGE_ONLY_MESSAGE =
  "Use a imagem anexada como foto real principal do produto nesta campanha. Não redesenhe nem substitua o produto.";

export function ChatInput({
  onSend,
  onAttachImage,
  onRemoveImage,
  attachedImage,
  disabled,
}: Props) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = Boolean(text.trim() || attachedImage) && !disabled && !uploading;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    onSend(text.trim() || IMAGE_ONLY_MESSAGE);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onAttachImage) return;

    setUploading(true);
    const toastId = toast.loading("Anexando foto do produto...");
    try {
      await onAttachImage(file);
      toast.success("Foto anexada. Ela será usada como produto principal.", {
        id: toastId,
      });
      textareaRef.current?.focus();
    } catch (error) {
      console.error("Falha ao anexar imagem pelo chat:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível anexar a imagem do produto.",
        { id: toastId },
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-border-subtle bg-surface-1/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-4">
      <form
        onSubmit={handleSubmit}
        className={cn(
          "relative rounded-[20px] border bg-surface-2/90 p-1.5 transition-all duration-200",
          text.length > 0 || attachedImage
            ? "border-brand/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
            : "border-border-subtle shadow-sm",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20",
        )}
      >
        {attachedImage && (
          <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-brand/20 bg-brand/5 p-2 pr-2.5">
            <img
              src={attachedImage}
              alt="Produto anexado"
              className="size-10 shrink-0 rounded-lg border border-white/10 bg-white object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-fg-primary">
                Foto real do produto anexada
              </p>
              <p className="truncate text-[10px] text-fg-muted">
                Será priorizada como imagem principal
              </p>
            </div>
            {onRemoveImage && (
              <button
                type="button"
                onClick={onRemoveImage}
                disabled={disabled || uploading}
                aria-label="Remover imagem anexada"
                title="Remover imagem anexada"
                className="grid size-7 shrink-0 place-items-center rounded-full text-fg-muted transition hover:bg-surface-3 hover:text-fg-primary disabled:opacity-40"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => void handleImageChange(event)}
          />
          <button
            type="button"
            disabled={disabled || uploading || !onAttachImage}
            onClick={() => fileInputRef.current?.click()}
            aria-label={attachedImage ? "Trocar foto do produto" : "Anexar foto do produto"}
            title={attachedImage ? "Trocar foto do produto" : "Anexar foto do produto"}
            className={cn(
              "mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition-all",
              attachedImage
                ? "bg-brand/15 text-brand hover:bg-brand/25"
                : "text-fg-muted hover:bg-surface-3 hover:text-fg-primary",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled || uploading}
            placeholder={
              attachedImage
                ? "Descreva como deseja usar esta foto..."
                : "Digite o site ou o que deseja criar..."
            }
            aria-label="Mensagem para o BrieFlow"
            className="max-h-[150px] min-h-[44px] w-full resize-none bg-transparent px-2 py-3 text-sm leading-5 text-fg-primary placeholder:text-fg-muted focus:outline-none disabled:opacity-50"
            rows={1}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label={disabled ? "Aguarde a resposta" : "Enviar mensagem"}
            title={disabled ? "Aguarde a resposta" : "Enviar mensagem"}
            className={cn(
              "mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-200",
              canSend
                ? "bg-brand text-white shadow-md active:scale-90 hover:brightness-110"
                : "cursor-not-allowed bg-surface-3 text-fg-muted",
            )}
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="ml-0.5 size-4" />
            )}
          </button>
        </div>
      </form>
      <div className="mt-2.5 text-center">
        <span className="text-[9px] font-medium tracking-wide text-fg-muted sm:text-[10px]">
          Revise textos, preços e condições antes de exportar.
        </span>
      </div>
    </div>
  );
}
