// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/briefflow/WorkspaceShell";

export const Route = createFileRoute("/")({ component: WorkspaceShell });
