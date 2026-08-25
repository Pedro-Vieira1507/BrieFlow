// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BuilderState } from "@/types/builder";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

export async function saveAssetToLibrary(name: string, state: BuilderState) {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Você precisa fazer login para salvar campanhas na biblioteca.");

  const { data, error } = await supabase
    .from("assets")
    .insert([{
      user_id: user.id,
      name: state.brandName ? `Campanha ${state.brandName}` : name,
      type: state.type,
      content: state,
      status: "draft",
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSavedAssets() {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteSavedAsset(id: string) {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }
  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// NOVA FUNÇÃO: Faz o upload da imagem para o Supabase Storage e retorna a URL Pública
export async function uploadCampaignAsset(file: File, pathFolder: string): Promise<string> {
  if (!supabase) throw new Error("Supabase não configurado.");
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${pathFolder}/${fileName}`;

  const { error } = await supabase.storage
    .from('campaign-assets')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('campaign-assets')
    .getPublicUrl(filePath);

  return publicUrl;
}