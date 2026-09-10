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
          article_length: number
          autopilot: boolean
          autopilot_auto_publish: boolean
          autopilot_last_run_at: string | null
          blog_url: string | null
          created_at: string
          id: string
          keyword_focus: string | null
          language: string
          name: string
          niche: string
          posts_per_week: number
          target_country: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          article_length?: number
          autopilot?: boolean
          autopilot_auto_publish?: boolean
          autopilot_last_run_at?: string | null
          blog_url?: string | null
          created_at?: string
          id?: string
          keyword_focus?: string | null
          language?: string
          name: string
          niche?: string
          posts_per_week?: number
          target_country?: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          article_length?: number
          autopilot?: boolean
          autopilot_auto_publish?: boolean
          autopilot_last_run_at?: string | null
          blog_url?: string | null
          created_at?: string
          id?: string
          keyword_focus?: string | null
          language?: string
          name?: string
          niche?: string
          posts_per_week?: number
          target_country?: string
          tone?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
