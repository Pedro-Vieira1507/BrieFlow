import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import type { ChatMessage as Msg } from "./types";

export function ChatMessage({ message }: { message: Msg }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex fade-in-up",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "text-[13px] leading-6 sm:text-[14px]",
          isUser
            ? cn(
                "max-w-[88%] rounded-[18px] rounded-br-md border border-white/8 px-4 py-2.5",
                "bg-brand text-brand-fg shadow-[0_12px_30px_-18px_var(--brand-glow)]",
              )
            : cn(
                "max-w-[94%] rounded-[18px] rounded-bl-md border border-border-subtle bg-surface-2/60 px-4 py-3",
                "text-fg-secondary shadow-[0_8px_22px_-18px_rgba(0,0,0,0.8)]",
              ),
        )}
      >
        <Markdown text={message.content} />
      </div>
    </div>
  );
}
