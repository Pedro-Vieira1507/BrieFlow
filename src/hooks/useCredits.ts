// src/hooks/useCredits.ts
import { useEffect } from "react";
import { create } from "zustand";
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

// 1. Cria o Estado Global de Créditos
interface CreditsState {
  plan: UserPlan | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useCreditsStore = create<CreditsState>((set) => ({
  plan: null,
  loading: false,
  error: null,
  refresh: async () => {
    if (!supabase) return;
    set({ loading: true, error: null });
    try {
      const { data, error: rpcError } = await supabase.rpc("get_user_plan");
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return;

      set({
        plan: {
          plan: row.plan,
          creditsMonthly: row.credits_monthly,
          creditsRemaining: row.credits_remaining,
          subscriptionStatus: row.subscription_status,
        },
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Erro ao carregar créditos",
      });
    } finally {
      set({ loading: false });
    }
  },
}));

let initialized = false;

// 2. Hook de Consumo que gerencia a Sessão
export function useCredits() {
  const state = useCreditsStore();

  useEffect(() => {
    if (!supabase || initialized) return;
    initialized = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) state.refresh();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        state.refresh();
      } else {
        useCreditsStore.setState({ plan: null });
      }
    });
  }, []);

  const creditsPercent =
    state.plan && state.plan.creditsMonthly > 0
      ? Math.round(
          (state.plan.creditsRemaining / state.plan.creditsMonthly) * 100,
        )
      : 0;
  const isPastDue = state.plan?.subscriptionStatus === "past_due";
  const isLow = (state.plan?.creditsRemaining ?? 0) <= 3;

  return { ...state, creditsPercent, isPastDue, isLow };
}
