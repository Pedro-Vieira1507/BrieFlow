// src/hooks/useCredits.ts
import { useEffect } from "react";
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { CREDIT_REFRESH_INTERVAL_MS, getCreditDayKey } from "@/lib/creditCycle";
import { PLAN_CATALOG, normalizePlanId, type PlanId } from "@/lib/plans";
import { isMaterialType, type MaterialType } from "@/types/brief";

export interface UserPlan {
  plan: PlanId;
  creditsDaily: number;
  creditsRemaining: number;
  monthlyCreditCap: number | null;
  monthlyCreditsUsed: number | null;
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
          creditsDaily: Number(row.credits_monthly ?? fallback.dailyCredits),
          creditsRemaining: Number(row.credits_remaining ?? 0),
          monthlyCreditCap:
            row.monthly_credit_cap == null
              ? fallback.monthlyCreditCap
              : Number(row.monthly_credit_cap),
          monthlyCreditsUsed:
            row.monthly_credits_used == null
              ? null
              : Number(row.monthly_credits_used),
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

let observedCreditDay = getCreditDayKey();
let creditObserverUsers = 0;
let stopCreditObserver: (() => void) | null = null;

function startCreditObserver(refresh: () => Promise<void>): () => void {
  if (!supabase) return () => undefined;

  let active = true;
  observedCreditDay = getCreditDayKey();

  void supabase.auth.getSession().then(({ data: { session } }) => {
    if (active && session) void refresh();
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!active) return;
    if (session) {
      void refresh();
    } else {
      refreshSequence += 1;
      useCreditsStore.setState({
        plan: null,
        loading: false,
        error: null,
      });
    }
  });

  const refreshAfterDayChange = () => {
    const currentCreditDay = getCreditDayKey();
    if (currentCreditDay === observedCreditDay) return;
    observedCreditDay = currentCreditDay;
    void refresh();
  };

  const interval = window.setInterval(
    refreshAfterDayChange,
    CREDIT_REFRESH_INTERVAL_MS,
  );
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") refreshAfterDayChange();
  };

  window.addEventListener("focus", refreshAfterDayChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    active = false;
    window.clearInterval(interval);
    window.removeEventListener("focus", refreshAfterDayChange);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    subscription.unsubscribe();
  };
}

// 2. Hook de Consumo que gerencia a Sessão
export function useCredits() {
  const state = useCreditsStore();
  const refresh = useCreditsStore((current) => current.refresh);

  useEffect(() => {
    if (!supabase) return;
    creditObserverUsers += 1;
    if (creditObserverUsers === 1) {
      stopCreditObserver = startCreditObserver(refresh);
    }

    return () => {
      creditObserverUsers = Math.max(0, creditObserverUsers - 1);
      if (creditObserverUsers === 0) {
        stopCreditObserver?.();
        stopCreditObserver = null;
      }
    };
  }, [refresh]);

  const creditsPercent =
    state.plan && state.plan.creditsDaily > 0
      ? Math.round(
          (state.plan.creditsRemaining / state.plan.creditsDaily) * 100,
        )
      : 0;
  const isPastDue = state.plan?.subscriptionStatus === "past_due";
  const isLow = (state.plan?.creditsRemaining ?? 0) <= 3;

  return { ...state, creditsPercent, isPastDue, isLow };
}
