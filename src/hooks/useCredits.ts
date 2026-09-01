// src/hooks/useCredits.ts
import { useEffect } from "react";
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { PLAN_CATALOG, normalizePlanId, type PlanId } from "@/lib/plans";
import { isMaterialType, type MaterialType } from "@/types/brief";

export interface UserPlan {
  plan: PlanId;
  creditsMonthly: number;
  creditsRemaining: number;
  subscriptionStatus:
    "active" | "past_due" | "canceled" | "trialing" | "incomplete";
  allowedFormats: MaterialType[];
  maxMembers: number;
  maxSavedAssets: number;
  organizationId: string | null;
}

export function planLabel(plan: string): string {
  return PLAN_CATALOG[normalizePlanId(plan)].label;
}

// 1. Cria o Estado Global de Créditos
interface CreditsState {
  plan: UserPlan | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

let refreshSequence = 0;

export const useCreditsStore = create<CreditsState>((set) => ({
  plan: null,
  loading: false,
  error: null,
  refresh: async () => {
    if (!supabase) return;
    const request = ++refreshSequence;
    set({ loading: true, error: null });
    try {
      const { data, error: rpcError } = await supabase.rpc("get_user_plan");
      if (rpcError) throw rpcError;
      if (request !== refreshSequence) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        set({ plan: null, error: "Plano do usuário não encontrado." });
        return;
      }

      const planId = normalizePlanId(row.plan);
      const fallback = PLAN_CATALOG[planId];
      const serverFormats = Array.isArray(row.allowed_formats)
        ? row.allowed_formats.filter(isMaterialType)
        : [];

      set({
        plan: {
          plan: planId,
          creditsMonthly: Number(
            row.credits_monthly ?? fallback.monthlyCredits,
          ),
          creditsRemaining: Number(row.credits_remaining ?? 0),
          subscriptionStatus: row.subscription_status ?? "active",
          allowedFormats:
            serverFormats.length > 0
              ? serverFormats
              : [...fallback.allowedFormats],
          maxMembers: Number(row.max_members ?? fallback.maxMembers),
          maxSavedAssets: Number(
            row.max_saved_assets ?? fallback.maxSavedAssets,
          ),
          organizationId: row.organization_id ?? null,
        },
        error: null,
      });
    } catch (err) {
      if (request !== refreshSequence) return;
      set({
        error: err instanceof Error ? err.message : "Erro ao carregar créditos",
      });
    } finally {
      if (request === refreshSequence) set({ loading: false });
    }
  },
}));

let initialized = false;

// 2. Hook de Consumo que gerencia a Sessão
export function useCredits() {
  const state = useCreditsStore();
  const refresh = useCreditsStore((current) => current.refresh);

  useEffect(() => {
    if (!supabase || initialized) return;
    initialized = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) refresh();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        refresh();
      } else {
        refreshSequence += 1;
        useCreditsStore.setState({
          plan: null,
          loading: false,
          error: null,
        });
      }
    });
  }, [refresh]);

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
