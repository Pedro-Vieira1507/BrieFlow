import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import type { ChatMessage as Msg } from "./types";

export function ChatMessage({ message }: { message: Msg }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex fade-in-up", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "text-[14px] leading-relaxed",
          isUser
            ? cn(
                "max-w-[85%] rounded-2xl rounded-tr-md px-4 py-3",
                "bg-brand text-brand-fg shadow-[var(--shadow-brand)]",
              )
            : cn(
                "max-w-[92%] rounded-2xl rounded-tl-md px-5 py-3.5",
                "text-fg-secondary",
              ),
        )}
      >
        <Markdown text={message.content} />
      </div>
    </div>
  );
}
