// src/components/briefflow/chat/ChatInput.tsx
import { useEffect, useRef, useState } from "react";
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
  const [clientReady, setClientReady] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const interactionDisabled = Boolean(disabled || uploading || !clientReady);
  const canSend = Boolean(text.trim() || attachedImage) && !interactionDisabled;

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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onAttachImage || !clientReady) return;

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
              <p className="truncate text-xs font-semibold text-fg-primary">
                Foto real do produto anexada
              </p>
              <p className="truncate text-xs text-fg-muted">
                Será priorizada como imagem principal
              </p>
            </div>
            {onRemoveImage && (
              <button
                type="button"
                onClick={onRemoveImage}
                disabled={interactionDisabled}
                aria-label="Remover imagem anexada"
                title="Remover imagem anexada"
                className="grid size-10 shrink-0 place-items-center rounded-full text-fg-muted transition hover:bg-surface-3 hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            suppressHydrationWarning
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => void handleImageChange(event)}
          />
          <button
            type="button"
            disabled={interactionDisabled || !onAttachImage}
            onClick={() => fileInputRef.current?.click()}
            aria-label={
              attachedImage
                ? "Trocar foto do produto"
                : "Anexar foto do produto"
            }
            title={
              attachedImage
                ? "Trocar foto do produto"
                : "Anexar foto do produto"
            }
            className={cn(
              "mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full transition-all sm:size-10",
              attachedImage
                ? "bg-brand/15 text-brand hover:bg-brand/25"
                : "text-fg-muted hover:bg-surface-3 hover:text-fg-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-4" aria-hidden />
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={interactionDisabled}
            maxLength={8000}
            enterKeyHint="send"
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck
            placeholder={
              attachedImage
                ? "Descreva como deseja usar esta foto..."
                : "Digite o site ou o que deseja criar..."
            }
            aria-label="Mensagem para o BrieFlow"
            aria-describedby="brieflow-composer-help"
            aria-busy={!clientReady || Boolean(disabled)}
            className="max-h-[150px] min-h-[44px] w-full resize-none bg-transparent px-2 py-3 text-base leading-5 text-fg-primary placeholder:text-fg-muted focus:outline-none disabled:opacity-50 sm:text-sm"
            rows={1}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label={interactionDisabled ? "Aguarde a resposta" : "Enviar mensagem"}
            title={interactionDisabled ? "Aguarde a resposta" : "Enviar mensagem"}
            className={cn(
              "mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 sm:size-10",
              canSend
                ? "bg-brand text-brand-fg shadow-md hover:brightness-110 active:scale-90"
                : "cursor-not-allowed bg-surface-3 text-fg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2",
            )}
          >
            {interactionDisabled ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="ml-0.5 size-4" aria-hidden />
            )}
          </button>
        </div>
      </form>
      <p
        id="brieflow-composer-help"
        className="mt-2.5 text-center text-xs font-medium leading-5 tracking-wide text-fg-muted"
      >
        Enter envia · Shift+Enter quebra linha · revise textos, preços e
        condições antes de exportar.
      </p>
    </div>
  );
}
