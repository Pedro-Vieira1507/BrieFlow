import type {
  SocialAccount,
  SocialCampaign,
  SocialMetrics,
  SocialPost,
} from "./social.ts";
type Table<T> = {
  Row: { [K in keyof T]: T[K] };
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};
type Owner = { user_id: string; organization_id: string };
export type AccountRow = Omit<SocialAccount, "status"> & Owner;
export type PostRow = SocialPost &
  Owner & { account_id: string | null; updated_at: string };
export type SocialDatabase = {
  public: {
    Tables: {
      social_campaigns: Table<SocialCampaign>;
      social_posts: Table<PostRow>;
      social_accounts: Table<AccountRow>;
      social_credentials: Table<{
        account_id: string;
        ciphertext: string;
        updated_at: string;
      }>;
      social_oauth_states: Table<
        Owner & {
          state_hash: string;
          channel: string;
          verifier_ciphertext: string;
          expires_at: string;
        }
      >;
      social_metric_snapshots: Table<SocialMetrics & Owner & { id: string }>;
      social_publish_attempts: Table<
        Owner & {
          id: string;
          post_id: string;
          approved_copy: unknown;
          approved_options: unknown;
          created_at: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      social_create_campaign: {
        Args: { p_user_id: string; p_brief: unknown };
        Returns: SocialCampaign;
      };
      social_claim_publish: {
        Args: {
          p_user_id: string;
          p_post_id: string;
          p_version: number;
          p_account_id: string;
          p_options: unknown;
        };
        Returns: PostRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
