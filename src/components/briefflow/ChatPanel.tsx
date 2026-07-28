import { useBriefflowStore } from "@/store/briefflow";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessages } from "./chat/ChatMessages";
import { ChatInput } from "./chat/ChatInput";

interface Props {
  onSend: (text: string) => void;
}

export function ChatPanel({ onSend }: Props) {
  const { messages, loading, scraping } = useBriefflowStore();

  const userTurns = messages.filter((m) => m.role === "user").length;
  const currentStep = Math.min(5, userTurns + 1);
  const busy = loading || scraping;

  return (
    <div className="flex h-full flex-col bg-surface-1 text-fg-primary">
      <ChatHeader currentStep={currentStep} showStepper={messages.length > 0} />
      <ChatMessages
        messages={messages}
        loading={loading}
        scraping={scraping}
        onPickSuggestion={onSend}
      />
      <ChatInput disabled={busy} onSend={onSend} />
    </div>
  );
}
