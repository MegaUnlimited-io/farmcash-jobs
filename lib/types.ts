// TypeScript types for the farmcash-jobs database schema.
// Keep in sync with MIGRATION021.
// Regenerate with Supabase CLI once the project is linked:
//   npx supabase gen types typescript --project-id <id> > lib/types.ts

export type JobStatus =
  | "active"
  | "partner_removed"
  | "blacklisted"
  | "seasonal"
  | "under_review";

export type CommentStatus = "pending" | "approved" | "rejected";

export type ConversionType = "cpi" | "cpa" | "cpe" | "cpl";

export interface CpeTask {
  id: string;
  name: string;
  event_name?: string;
  payout_seeds: number;   // Seeds reward for this task (0 = install-tracking step)
  status?: string;
  bonus_task?: boolean;
  type?: string;
}

// jobs: one per app — the stable wiki entity, deduped by app_package_id.
// payout_min/max are aggregated from active job_offers by the sync.
// Any field in manual_overrides is skipped by the sync (manual value wins).
export interface Job {
  id: string;
  app_package_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  ai_generated_content: string | null;
  icon_url: string | null;
  screenshots: string[] | null;
  payout_min: number | null;  // Seeds — lowest active offer
  payout_max: number | null;  // Seeds — highest active offer
  conversion_type: ConversionType | null;
  cpe_tasks: CpeTask[] | null;
  manual_overrides: Record<string, unknown>;
  status: JobStatus;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

// job_offers: one per partner offer — dynamic, high-churn.
// Many can point to the same job (same app, different partner or GEO split).
export interface JobOffer {
  id: string;
  job_id: string | null;
  partner_id: string;
  partner_offer_id: string;
  app_package_id: string | null;
  name: string;
  payout_amount: number | null;   // Seeds
  conversion_type: ConversionType | null;
  cpe_tasks: CpeTask[] | null;
  tracking_link_template: string | null;
  landing_page: string | null;
  promote_to_wiki: boolean;
  is_active: boolean;
  consecutive_missing_syncs: number;
  last_seen_in_partner_api: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRating {
  id: string;
  job_id: string;
  user_id: string;
  // 1–5; higher is always better for the user (see CLAUDE.md rating dimensions)
  overall_rating: number | null;
  ad_aggression: number | null;
  task_difficulty: number | null;
  payment_speed: number | null;
  is_bot: boolean;
  bot_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobComment {
  id: string;
  job_id: string;
  user_id: string;
  content: string;
  is_guide: boolean;
  is_pinned: boolean;
  is_bot: boolean;
  bot_name: string | null;
  status: CommentStatus;
  created_at: string;
  updated_at: string;
}

export interface JobRatingsSummary {
  job_id: string;
  total_ratings: number;
  human_ratings: number;
  avg_overall: number | null;
  avg_ad_aggression: number | null;
  avg_task_difficulty: number | null;
  avg_payment_speed: number | null;
}

export interface Admin {
  user_id: string;
  created_at: string;
}

export interface PendingComment extends JobComment {
  job_name: string;
  job_slug: string;
}

// Supabase Database type — used to type the Supabase client generics.
// Relationships must be present on each table/view to satisfy GenericTable constraint
// in @supabase/postgrest-js. FK relationships are not yet modelled; using empty arrays.
export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: Job;
        Insert: Omit<Job, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Job, "id" | "created_at">>;
        Relationships: [];
      };
      job_offers: {
        Row: JobOffer;
        Insert: Omit<JobOffer, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<JobOffer, "id" | "created_at">>;
        Relationships: [];
      };
      job_ratings: {
        Row: JobRating;
        Insert: Omit<JobRating, "id" | "overall_rating" | "created_at" | "updated_at"> & {
          id?: string;
          overall_rating?: number | null; // computed by trigger; omit on insert
          is_bot?: boolean;
          bot_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<JobRating, "id" | "created_at">>;
        Relationships: [];
      };
      job_comments: {
        Row: JobComment;
        Insert: Omit<JobComment, "id" | "created_at" | "updated_at"> & {
          id?: string;
          is_guide?: boolean;
          is_pinned?: boolean;
          is_bot?: boolean;
          bot_name?: string | null;
          status?: CommentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<JobComment, "id" | "created_at">>;
        Relationships: [];
      };
      admins: {
        Row: Admin;
        Insert: Admin;
        Update: Partial<Admin>;
        Relationships: [];
      };
      jobs_featured: {
        Row: { job_id: string; display_order: number; created_at: string };
        Insert: { job_id: string; display_order?: number; created_at?: string };
        Update: Partial<{ display_order: number }>;
        Relationships: [];
      };
    };
    Views: {
      job_ratings_summary: {
        Row: JobRatingsSummary;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
