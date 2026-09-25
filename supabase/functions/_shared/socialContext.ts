import { createClient } from "npm:@supabase/supabase-js@2.110.5";
import { authenticate, type RequestContext } from "./http.ts";
import type { SocialDatabase } from "./socialDatabase.ts";
export const socialClient = () =>
  createClient<SocialDatabase>(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
export async function activeOrganization(
  context: RequestContext,
): Promise<string> {
  const { data: profile, error } = await context.service
    .from("profiles")
    .select("default_organization_id")
    .eq("user_id", context.user.id)
    .single();
  if (error || !profile?.default_organization_id)
    throw new Error("workspace_missing");
  const org = profile.default_organization_id;
  const { data: member } = await context.service
    .from("organization_members")
    .select("status")
    .eq("user_id", context.user.id)
    .eq("organization_id", org)
    .eq("status", "active")
    .maybeSingle();
  if (!member) throw new Error("membership_inactive");
  return org;
}
export async function socialContext(req: Request) {
  const context = await authenticate(req);
  if (!context) throw new Error("unauthorized");
  const org = await activeOrganization(context);
  return { ...context, org, db: socialClient() };
}
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export const socialMessages: Record<string, string> = {
  unauthorized: "Entre novamente para continuar.",
  workspace_missing: "Seu workspace ainda não está disponível.",
  membership_inactive: "Seu acesso ao workspace está suspenso.",
  invalid_request: "Confira os dados enviados.",
  conflict: "O conteúdo mudou em outra sessão. Recarregue antes de continuar.",
  post_conflict:
    "Esta publicação já foi enviada ou mudou. Recarregue para conferir.",
  not_found: "Campanha ou publicação não encontrada nesta conta.",
  consent_required:
    "Confirme o destino, o texto e os direitos de uso da mídia antes de publicar.",
  provider_not_configured:
    "A integração depende das credenciais e permissões do aplicativo. Nenhuma publicação foi enviada.",
  provider_permission_required:
    "A rede recusou a permissão. Reconecte a conta e confira os acessos aprovados.",
  provider_rate_limited:
    "A rede limitou as solicitações. Aguarde antes de consultar novamente.",
  provider_rejected:
    "A rede recusou a solicitação. Confira o formato, as permissões e as regras da plataforma.",
  provider_network_uncertain:
    "Não foi possível confirmar a resposta da rede. Confira diretamente na conta antes de qualquer novo envio.",
  provider_invalid_response:
    "A rede retornou uma resposta inesperada. Confira a conta antes de reenviar.",
  provider_missing_id:
    "A rede não retornou um identificador. Confira a conta; não faremos reenvio automático.",
  account_expired:
    "Esta conexão expirou. Reconecte a conta antes de continuar.",
  account_invalid: "Selecione uma conexão válida para esta rede e workspace.",
  encryption_not_configured:
    "O armazenamento seguro de conexões ainda não foi configurado.",
  media_invalid:
    "O anexo não pertence a esta campanha ou não é um arquivo válido.",
  media_domain_not_verified:
    "O domínio dos vídeos precisa estar verificado no aplicativo TikTok.",
  privacy_required:
    "Escolha uma privacidade disponível para o criador no TikTok.",
  video_duration_invalid:
    "A duração do vídeo não atende ao limite atual do criador no TikTok.",
  tiktok_consent_required:
    "Revise a privacidade, a declaração comercial e o consentimento de música do TikTok.",
  subreddit_required:
    "Informe um subreddit válido e confirme que revisou suas regras.",
  campaign_limit: "Você atingiu o limite de campanhas salvas do plano.",
  subscription_inactive: "Seu plano não está ativo para esta ação.",
  rate_limit_exceeded: "Muitas solicitações. Aguarde um instante.",
  internal_error:
    "Não foi possível concluir a operação. Seus dados já salvos foram preservados.",
};
