import { createClient } from "@supabase/supabase-js";
import type { BuilderState } from "@/types/builder";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltam as variáveis de ambiente do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// FUNÇÕES DE ASSET MANAGEMENT
// ==========================================

export async function saveAssetToLibrary(name: string, state: BuilderState) {
  const { data, error } = await supabase
    .from("assets")
    .insert([
      {
        name,
        type: state.type,
        content: state,
        status: "draft",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Erro ao salvar asset:", error);
    throw error;
  }

  return data;
}

export async function getSavedAssets() {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar assets:", error);
    throw error;
  }

  return data;
}