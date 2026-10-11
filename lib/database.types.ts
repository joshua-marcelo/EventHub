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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          code: string
          created_at: string
          id: number
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: never
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: never
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: never
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: never
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          college_id: number | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          identity_flag_reason: string | null
          identity_flagged_at: string | null
          is_admin: boolean
          is_complete: boolean | null
          last_name: string | null
          middle_name: string | null
          organizer_since: string | null
          organizer_status: Database["public"]["Enums"]["organizer_status"]
          organizer_status_reason: string | null
          privacy_consented_at: string | null
          privacy_notice_version: string | null
          program_id: number | null
          student_id: string | null
          suffix: string | null
          updated_at: string
          year_level: number | null
        }
        Insert: {
          avatar_path?: string | null
          college_id?: number | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          identity_flag_reason?: string | null
          identity_flagged_at?: string | null
          is_admin?: boolean
          is_complete?: boolean | null
          last_name?: string | null
          middle_name?: string | null
          organizer_since?: string | null
          organizer_status?: Database["public"]["Enums"]["organizer_status"]
          organizer_status_reason?: string | null
          privacy_consented_at?: string | null
          privacy_notice_version?: string | null
          program_id?: number | null
          student_id?: string | null
          suffix?: string | null
          updated_at?: string
          year_level?: number | null
        }
        Update: {
          avatar_path?: string | null
          college_id?: number | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          identity_flag_reason?: string | null
          identity_flagged_at?: string | null
          is_admin?: boolean
          is_complete?: boolean | null
          last_name?: string | null
          middle_name?: string | null
          organizer_since?: string | null
          organizer_status?: Database["public"]["Enums"]["organizer_status"]
          organizer_status_reason?: string | null
          privacy_consented_at?: string | null
          privacy_notice_version?: string | null
          program_id?: number | null
          student_id?: string | null
          suffix?: string | null
          updated_at?: string
          year_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_program_fk"
            columns: ["college_id", "program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["college_id", "id"]
          },
        ]
      }
      programs: {
        Row: {
          college_id: number
          created_at: string
          id: number
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          college_id: number
          created_at?: string
          id?: never
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          college_id?: number
          created_at?: string
          id?: never
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_privacy_notice: { Args: { p_version: string }; Returns: string }
      profile_full_name: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: string
      }
    }
    Enums: {
      application_status: "pending" | "approved" | "rejected" | "withdrawn"
      approval_mode: "automatic" | "manual"
      attendance_flag: "shared_device"
      attendance_policy: "time_in_only" | "time_in_and_out"
      attendance_session_kind: "time_in" | "time_out"
      attendance_session_status: "open" | "closed"
      attendance_status: "present" | "revoked"
      check_in_method: "qr" | "manual"
      event_status: "draft" | "published" | "completed" | "cancelled"
      event_visibility: "public" | "unlisted"
      flag_resolution: "cleared" | "revoked"
      organizer_status: "none" | "active" | "suspended" | "revoked"
      registration_channel: "online" | "onsite"
      registration_status: "pending" | "approved" | "rejected" | "cancelled"
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
      application_status: ["pending", "approved", "rejected", "withdrawn"],
      approval_mode: ["automatic", "manual"],
      attendance_flag: ["shared_device"],
      attendance_policy: ["time_in_only", "time_in_and_out"],
      attendance_session_kind: ["time_in", "time_out"],
      attendance_session_status: ["open", "closed"],
      attendance_status: ["present", "revoked"],
      check_in_method: ["qr", "manual"],
      event_status: ["draft", "published", "completed", "cancelled"],
      event_visibility: ["public", "unlisted"],
      flag_resolution: ["cleared", "revoked"],
      organizer_status: ["none", "active", "suspended", "revoked"],
      registration_channel: ["online", "onsite"],
      registration_status: ["pending", "approved", "rejected", "cancelled"],
    },
  },
} as const
