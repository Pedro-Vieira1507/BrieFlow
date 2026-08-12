// src/hooks/useCredits.ts
//
// Lê o plano e créditos do usuário atual via RPC segura no Supabase.
// O saldo é atualizado automaticamente após cada geração bem-sucedida.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface UserPlan {
  plan: "free" | "basic" | "pro" | "agency";
  creditsMonthly: number;
  creditsRemaining: number;
  subscriptionStatus: "active" | "past_due" | "canceled" | "trialing";
}

const PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  basic: "Básico",
  pro: "Pro",
  agency: "Agência",
};

export function planLabel(plan: string): string {
  return PLAN_LABELS[plan] ?? plan;
}

export function useCredits() {
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_user_plan");
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return;
      setPlan({
        plan: row.plan,
        creditsMonthly: row.credits_monthly,
        creditsRemaining: row.credits_remaining,
        subscriptionStatus: row.subscription_status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar créditos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await refresh();
    })();
  }, [refresh]);

  // Re-fetch when auth state changes
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session) await refresh();
        else setPlan(null);
      })();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const creditsPercent = plan
    ? Math.round((plan.creditsRemaining / plan.creditsMonthly) * 100)
    : 0;

  const isPastDue = plan?.subscriptionStatus === "past_due";
  const isLow = (plan?.creditsRemaining ?? 0) <= 3;

  return { plan, loading, error, refresh, creditsPercent, isPastDue, isLow };
}
