import { invokeEdgeFunction } from "@/lib/supabase";

export interface ProfessionalImageResult {
  imageUrl: string | null;
  found: boolean;
  sourceUrl?: string;
  error?: string;
}

/**
 * Compatibilidade com a assinatura antiga de createServerFn. A busca, o
 * download e o armazenamento agora acontecem na Edge Function autenticada;
 * chaves de Google/Remove.bg nunca chegam ao navegador.
 */
export async function visualSearchFn(payload: {
  data: { query: string };
}): Promise<ProfessionalImageResult> {
  const query = payload?.data?.query?.trim();
  if (!query) throw new Error("Termo de busca obrigatório.");
  return invokeEdgeFunction<ProfessionalImageResult>("image-search", {
    query,
  });
}
