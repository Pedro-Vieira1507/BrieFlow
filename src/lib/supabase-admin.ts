// src/lib/supabase-admin.ts
import { createClient } from "@supabase/supabase-js";

// ATENÇÃO: Nunca exponha a VITE_SUPABASE_SERVICE_ROLE_KEY no frontend!
export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY! // Pegue no painel do Supabase: Project Settings > API > service_role secret
);