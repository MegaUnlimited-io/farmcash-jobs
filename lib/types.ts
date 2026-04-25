// TypeScript types for the farmcash-jobs database schema.
// Keep in sync with MIGRATION019 + MIGRATION020.
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
  description?: string;
  payout_usd?: number;
  currency_amount?: number;
  order?: number;
}

export interface Job {
  id: string;
  partner_id: string;
  partner_offer_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  ai_generated_content: string | null; // TEXT column in DB (enrichment pipeline writes JSON string)
  icon_url: string | null;
  screenshots: string[] | null;
  payout_amount: number | null;
  app_package_id: string | null;
  status: JobStatus;
  // Fields added in MIGRATION020
  seeds_amount: number | null;
  conversion_type: ConversionType | null;
  cpe_tasks: CpeTask[] | null;
  tracking_link_template: string | null;
  // Sync tracking
  last_seen_in_partner_api: string | null;
  consecutive_missing_syncs: number;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRating {
  id: string;
  job_id: string;
  user_id: string;
  // 1–5; higher is always better for the user (see CLAUDE.md rating dimensions)
  // Nullable in DB — only overall_rating is required at submission
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

// JobComment extended with job context — used in admin moderation views.
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
          consecutive_missing_syncs?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Job, "id" | "created_at">>;
        Relationships: [];
      };
      job_ratings: {
        Row: JobRating;
        Insert: Omit<JobRating, "id" | "created_at" | "updated_at"> & {
          id?: string;
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
