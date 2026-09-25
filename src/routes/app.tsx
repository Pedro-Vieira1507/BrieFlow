// src/routes/app.tsx
import { createFileRoute } from "@tanstack/react-router";
import { SocialWorkspace } from "@/components/social/SocialWorkspace";

export const Route = createFileRoute("/app")({ component: SocialWorkspace });
