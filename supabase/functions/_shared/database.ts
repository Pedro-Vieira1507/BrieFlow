export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type AiUsageRow = {
  id: number;
  organization_id: string | null;
  user_id: string;
  request_id: string;
  action: string;
  provider: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  success: boolean;
  error_code: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  credits_monthly: number;
  credits_remaining: number;
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_event_created: number;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Edge-only schema contract. Keep this focused on the tables and RPCs used by
 * functions, and regenerate/extend it whenever the database migration changes.
 */
export type Database = {
  public: {
    Tables: {
      ai_usage_log: Table<AiUsageRow>;
      organization_members: Table<{
        organization_id: string;
        user_id: string;
        role: string;
        status: string;
        invited_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      profiles: Table<{
        user_id: string;
        default_organization_id: string | null;
        display_name: string | null;
        created_at: string;
        updated_at: string;
      }>;
      scrape_cache: Table<{
        url_hash: string;
        url: string;
        data: Json;
        fetched_at: string;
        expires_at: string;
      }>;
      stripe_webhook_events: Table<{
        id: string;
        event_type: string;
        status: string;
        error_code: string | null;
        attempt_count: number;
        created_at: string;
        updated_at: string;
        processed_at: string | null;
      }>;
      subscriptions: Table<SubscriptionRow>;
    };
    Views: Record<string, never>;
    Functions: {
      authorize_generation: {
        Args: {
          p_user_id: string;
          p_action: string;
          p_request_id: string;
          p_metadata?: Json;
        };
        Returns: Array<{
          ok: boolean;
          code: string;
          credits_remaining: number;
          credit_cost: number;
          plan: string;
          allowed_formats: string[];
          organization_id: string;
        }>;
      };
      check_rate_limit: {
        Args: { p_user_id: string; p_scope: string; p_limit: number };
        Returns: boolean;
      };
      claim_stripe_webhook: {
        Args: { p_event_id: string; p_event_type: string };
        Returns: boolean;
      };
      refund_generation: {
        Args: {
          p_user_id: string;
          p_request_id: string;
          p_reason?: string;
        };
        Returns: boolean;
      };
      sync_stripe_subscription: {
        Args: {
          p_organization_id: string;
          p_plan_id: string;
          p_status: string;
          p_period_start: string;
          p_period_end: string;
          p_stripe_customer_id: string;
          p_stripe_subscription_id: string;
          p_stripe_price_id: string | null;
          p_cancel_at_period_end: boolean;
          p_event_created: number;
          p_reset_credits?: boolean;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
