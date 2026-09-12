export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          message: string | null
          metadata: Json
          status: string
          user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          status?: string
          user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ad_daily_stats: {
        Row: {
          clicks: number
          impressions: number
          placement_id: string
          stat_date: string
          updated_at: string
        }
        Insert: {
          clicks?: number
          impressions?: number
          placement_id: string
          stat_date?: string
          updated_at?: string
        }
        Update: {
          clicks?: number
          impressions?: number
          placement_id?: string
          stat_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_daily_stats_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_placements: {
        Row: {
          body: string | null
          created_at: string
          cta_label: string
          headline: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          opens_new_tab: boolean
          slot_key: string
          target_url: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          cta_label?: string
          headline: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          opens_new_tab?: boolean
          slot_key: string
          target_url: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          cta_label?: string
          headline?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          opens_new_tab?: boolean
          slot_key?: string
          target_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      autopilot_run_locks: {
        Row: {
          blog_id: string
          lock_token: string
          locked_at: string
        }
        Insert: {
          blog_id: string
          lock_token: string
          locked_at?: string
        }
        Update: {
          blog_id?: string
          lock_token?: string
          locked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_run_locks_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_runs: {
        Row: {
          blog_id: string | null
          created_at: string
          detail: string | null
          finished_at: string
          id: string
          post_id: string | null
          published_url: string | null
          started_at: string
          status: string
          trigger_source: string
          user_id: string | null
        }
        Insert: {
          blog_id?: string | null
          created_at?: string
          detail?: string | null
          finished_at?: string
          id?: string
          post_id?: string | null
          published_url?: string | null
          started_at?: string
          status: string
          trigger_source?: string
          user_id?: string | null
        }
        Update: {
          blog_id?: string | null
          created_at?: string
          detail?: string | null
          finished_at?: string
          id?: string
          post_id?: string | null
          published_url?: string | null
          started_at?: string
          status?: string
          trigger_source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_runs_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_runs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blogger_connections: {
        Row: {
          access_token: string | null
          blog_id: string
          blogger_blog_id: string | null
          blogger_blog_name: string | null
          blogger_blog_url: string | null
          created_at: string
          id: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          blog_id: string
          blogger_blog_id?: string | null
          blogger_blog_name?: string | null
          blogger_blog_url?: string | null
          created_at?: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          blog_id?: string
          blogger_blog_id?: string | null
          blogger_blog_name?: string | null
          blogger_blog_url?: string | null
          created_at?: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blogger_connections_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      blogs: {
        Row: {
          ai_image_aspect_ratio: string
          ai_image_custom_height: number | null
          ai_image_custom_width: number | null
          ai_image_style: string
          article_length: number
          autopilot: boolean
          autopilot_auto_publish: boolean
          autopilot_last_run_at: string | null
          blog_url: string | null
          created_at: string
          deleted_at: string | null
          id: string
          keyword_focus: string | null
          language: string
          name: string
          niche: string
          posts_per_week: number
          purge_after: string | null
          target_country: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_image_aspect_ratio?: string
          ai_image_custom_height?: number | null
          ai_image_custom_width?: number | null
          ai_image_style?: string
          article_length?: number
          autopilot?: boolean
          autopilot_auto_publish?: boolean
          autopilot_last_run_at?: string | null
          blog_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          keyword_focus?: string | null
          language?: string
          name: string
          niche?: string
          posts_per_week?: number
          purge_after?: string | null
          target_country?: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_image_aspect_ratio?: string
          ai_image_custom_height?: number | null
          ai_image_custom_width?: number | null
          ai_image_style?: string
          article_length?: number
          autopilot?: boolean
          autopilot_auto_publish?: boolean
          autopilot_last_run_at?: string | null
          blog_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          keyword_focus?: string | null
          language?: string
          name?: string
          niche?: string
          posts_per_week?: number
          purge_after?: string | null
          target_country?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_usage: {
        Row: {
          ai_drafts: number
          ai_images: number
          autopilot_runs: number
          created_at: string
          period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_drafts?: number
          ai_images?: number
          autopilot_runs?: number
          created_at?: string
          period_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_drafts?: number
          ai_images?: number
          autopilot_runs?: number
          created_at?: string
          period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          blog_id: string
          blogger_post_id: string | null
          blogger_url: string | null
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          keywords: string | null
          meta_description: string | null
          outline: string | null
          published_at: string | null
          scheduled_for: string | null
          seo_title: string | null
          slug: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blog_id: string
          blogger_post_id?: string | null
          blogger_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          keywords?: string | null
          meta_description?: string | null
          outline?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          seo_title?: string | null
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blog_id?: string
          blogger_post_id?: string | null
          blogger_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          keywords?: string | null
          meta_description?: string | null
          outline?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          seo_title?: string | null
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_console_connections: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string | null
          selected_permission_level: string | null
          selected_site_url: string | null
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          selected_permission_level?: string | null
          selected_site_url?: string | null
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          selected_permission_level?: string | null
          selected_site_url?: string | null
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          message: string
          read_at: string | null
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          message: string
          read_at?: string | null
          severity?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          message?: string
          read_at?: string | null
          severity?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_provider: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          plan: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_provider?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          plan?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_provider?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          plan?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      website_diagnostics: {
        Row: {
          created_at: string
          element: string | null
          event_type: string
          id: string
          message: string | null
          metadata: Json
          page_url: string | null
          route: string | null
          route_path: string | null
          severity: string
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          element?: string | null
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          page_url?: string | null
          route?: string | null
          route_path?: string | null
          severity?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          element?: string | null
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          page_url?: string | null
          route?: string | null
          route_path?: string | null
          severity?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_autopilot_run_lock: {
        Args: { p_blog_id: string; p_stale_after_minutes?: number }
        Returns: string
      }
      consume_ai_draft_usage: { Args: { p_user_id: string }; Returns: number }
      consume_ai_image_usage: { Args: { p_user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purge_expired_deleted_blogs: { Args: never; Returns: number }
      record_ad_event: {
        Args: { p_event: string; p_placement_id: string }
        Returns: undefined
      }
      refund_ai_draft_usage: { Args: { p_user_id: string }; Returns: undefined }
      refund_ai_image_usage: { Args: { p_user_id: string }; Returns: undefined }
      release_autopilot_run_lock: {
        Args: { p_blog_id: string; p_lock_token: string }
        Returns: boolean
      }
      resolve_effective_plan: { Args: { p_user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
