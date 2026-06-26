import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { createThread } from "@/lib/chat-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marketing AI — Agente de Marketing com Ollama" },
      { name: "description", content: "Crie e-mails HTML, imagens e fichas técnicas com um agente de I.A. local rodando em Ollama + Pollinations." },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = createThread();
    navigate({ to: "/chat/$threadId", params: { threadId: t.id }, replace: true });
  }, [navigate]);
  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
      Iniciando nova conversa…
    </div>
  );
}
