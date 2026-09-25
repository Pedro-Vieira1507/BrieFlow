import { z } from "zod";
import { generateCompletion } from "./aiClient";
import { invokeEdgeFunction, supabase } from "./supabase";
import { useBriefflowStore } from "@/store/briefflow";
import { useCreditsStore } from "@/hooks/useCredits";
import {
  textPrompt,
  validateCopy,
  type SocialAttachment,
  type SocialBrief,
  type SocialChannel,
  type SocialCopy,
} from "../../supabase/functions/_shared/social.ts";
export * from "../../supabase/functions/_shared/social.ts";
export const socialApi = <T>(body: unknown, signal?: AbortSignal): Promise<T> =>
  invokeEdgeFunction<T>("social-workspace", body, signal);
export function scopeGuard(): () => void {
  const userId = useBriefflowStore.getState().user?.id,
    orgId = useCreditsStore.getState().plan?.organizationId,
    version = useBriefflowStore.getState().workspaceVersion;
  if (!userId || !orgId)
    throw new Error("Entre na sua conta e aguarde o workspace carregar.");
  return () => {
    if (
      useBriefflowStore.getState().user?.id !== userId ||
      useBriefflowStore.getState().workspaceVersion !== version ||
      useCreditsStore.getState().plan?.organizationId !== orgId
    )
      throw new Error("A conta mudou. Reabra a campanha para continuar.");
  };
}
const copySchema = z.object({
  title: z.string().max(300),
  text: z.string().min(1).max(40000),
  productionNotes: z.string().max(16000),
});
export async function generateSocialCopy(
  brief: SocialBrief,
  channel: SocialChannel,
  attachments: SocialAttachment[],
  signal: AbortSignal,
): Promise<SocialCopy> {
  const prompt = textPrompt(brief, channel, attachments);
  const result = await generateCompletion({
    system: prompt.system,
    user: prompt.user,
    schema: copySchema,
    action: "social",
    stage: "content",
    maxTokens: 3500,
    temperature: 0.45,
    signal,
  });
  const issues = validateCopy(channel, result.data);
  if (issues.length)
    throw new Error(
      `A IA retornou um texto fora do formato: ${issues.join(" ")}`,
    );
  return result.data;
}
export async function uploadBriefMedia(
  file: File,
  campaignId: string,
): Promise<SocialAttachment> {
  if (!supabase) throw new Error("Armazenamento indisponível.");
  const guard = scopeGuard(),
    userId = useBriefflowStore.getState().user!.id;
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
  };
  if (!extensions[file.type] || file.size > 25 * 1024 * 1024 || file.size === 0)
    throw new Error("Envie JPEG, PNG, WebP ou MP4 com até 25 MB.");
  let duration: number | undefined;
  if (file.type === "video/mp4") {
    duration = await new Promise<number>((resolve, reject) => {
      const video = document.createElement("video"),
        url = URL.createObjectURL(file);
      const cleanup = () => {
        URL.revokeObjectURL(url);
        video.removeAttribute("src");
        clearTimeout(timer);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Não foi possível ler a duração do vídeo."));
      }, 10000);
      video.onloadedmetadata = () => {
        const seconds = video.duration;
        cleanup();
        if (Number.isFinite(seconds) && seconds > 0 && seconds <= 3600)
          resolve(seconds);
        else reject(new Error("Vídeo inválido ou maior que 60 minutos."));
      };
      video.onerror = () => {
        cleanup();
        reject(new Error("Não foi possível ler o MP4."));
      };
      video.preload = "metadata";
      video.src = url;
    });
  }
  guard();
  const id = crypto.randomUUID(),
    path = `${userId}/${campaignId}/${id}.${extensions[file.type]}`;
  const { error } = await supabase.storage
    .from("social-briefs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error)
    throw new Error(
      "Não foi possível anexar o arquivo. Confira o formato e tente novamente.",
    );
  guard();
  return {
    id,
    path,
    name: file.name,
    mime: file.type,
    size: file.size,
    description: "",
    ...(duration ? { duration } : {}),
  };
}
