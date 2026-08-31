// src/components/briefflow/ChatPanel.tsx
import { useBriefflowStore } from "@/store/briefflow";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessages } from "./chat/ChatMessages";
import { ChatInput } from "./chat/ChatInput";
import { CreditsBar } from "./CreditsBar";

interface Props {
  onSend: (text: string) => void;
}

export function ChatPanel({ onSend }: Props) {
  // Trazemos o user e setAuthOpen para barrar no nível do Painel
  const { messages, builder, loading, scraping, user, setAuthOpen } =
    useBriefflowStore();

  const userTurns = messages.filter((m) => m.role === "user").length;
  const hasCampaign = builder.type === "campaign";
  const currentStep = hasCampaign ? 5 : Math.min(5, userTurns + 1);
  const busy = loading || scraping;

  // Intercepta qualquer envio do chat (seja do input ou das sugestões)
  const handleProtectedSend = (text: string) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    onSend(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent text-fg-primary">
      <ChatHeader
        currentStep={currentStep}
        showStepper={messages.length > 0 || hasCampaign}
      />
      <CreditsBar />
      <ChatMessages
        messages={messages}
        loading={loading}
        scraping={scraping}
        onPickSuggestion={handleProtectedSend} // <-- Agora protegido
      />
      <ChatInput disabled={busy} onSend={handleProtectedSend} />{" "}
      {/* <-- Agora protegido */}
    </div>
  );
}
