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
      event_registrations: {
        Row: {
          cancelled_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          event_id: string
          id: string
          registered_at: string
          registration_channel: Database["public"]["Enums"]["registration_channel"]
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          event_id: string
          id?: string
          registered_at?: string
          registration_channel?: Database["public"]["Enums"]["registration_channel"]
          status: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          event_id?: string
          id?: string
          registered_at?: string
          registration_channel?: Database["public"]["Enums"]["registration_channel"]
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          allow_onsite_registration: boolean
          approval_mode: Database["public"]["Enums"]["approval_mode"]
          attendance_opens_minutes_before: number
          attendance_policy: Database["public"]["Enums"]["attendance_policy"]
          banner_path: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          capacity: number | null
          category_id: number | null
          certificates_enabled: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          host_college_id: number | null
          id: string
          invite_code: string
          organizer_id: string
          published_at: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          search: unknown
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          venue: string | null
          visibility: Database["public"]["Enums"]["event_visibility"]
        }
        Insert: {
          allow_onsite_registration?: boolean
          approval_mode?: Database["public"]["Enums"]["approval_mode"]
          attendance_opens_minutes_before?: number
          attendance_policy?: Database["public"]["Enums"]["attendance_policy"]
          banner_path?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          capacity?: number | null
          category_id?: number | null
          certificates_enabled?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          host_college_id?: number | null
          id?: string
          invite_code?: string
          organizer_id: string
          published_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          search?: unknown
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          venue?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Update: {
          allow_onsite_registration?: boolean
          approval_mode?: Database["public"]["Enums"]["approval_mode"]
          attendance_opens_minutes_before?: number
          attendance_policy?: Database["public"]["Enums"]["attendance_policy"]
          banner_path?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          capacity?: number | null
          category_id?: number | null
          certificates_enabled?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          host_college_id?: number | null
          id?: string
          invite_code?: string
          organizer_id?: string
          published_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          search?: unknown
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          venue?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "events_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_host_college_id_fkey"
            columns: ["host_college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_applications: {
        Row: {
          applicant_id: string
          contact_number: string
          created_at: string
          id: string
          organization_name: string
          position_title: string
          privacy_consented_at: string
          privacy_notice_version: string
          proof_document_path: string
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          supporting_document_path: string | null
          updated_at: string
        }
        Insert: {
          applicant_id: string
          contact_number: string
          created_at?: string
          id?: string
          organization_name: string
          position_title: string
          privacy_consented_at?: string
          privacy_notice_version: string
          proof_document_path: string
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          supporting_document_path?: string | null
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          contact_number?: string
          created_at?: string
          id?: string
          organization_name?: string
          position_title?: string
          privacy_consented_at?: string
          privacy_notice_version?: string
          proof_document_path?: string
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          supporting_document_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      cancel_event: {
        Args: { p_id: string; p_reason: string }
        Returns: string
      }
      cancel_registration: { Args: { p_event_id: string }; Returns: string }
      decide_registration: {
        Args: { p_decision: string; p_id: string; p_reason?: string }
        Returns: string
      }
      delete_event_draft: { Args: { p_id: string }; Returns: string }
      get_event_by_invite_code: { Args: { p_code: string }; Returns: string }
      get_public_event_preview: {
        Args: { p_event_id: string }
        Returns: {
          banner_path: string
          category_name: string
          description: string
          ends_at: string
          host_college_name: string
          organization_name: string
          starts_at: string
          status_label: string
          title: string
          venue: string
        }[]
      }
      get_upcoming_public_events: {
        Args: never
        Returns: {
          banner_path: string
          category_name: string
          id: string
          registration_state: string
          starts_at: string
          title: string
          venue: string
        }[]
      }
      profile_full_name: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: string
      }
      publish_event: { Args: { p_id: string }; Returns: string }
      register_for_event: { Args: { p_event_id: string }; Returns: string }
      review_organizer_application: {
        Args: { p_decision: string; p_id: string; p_reason?: string }
        Returns: string
      }
      save_event: { Args: { p_id: string; p_values: Json }; Returns: Json }
      save_lookup: {
        Args: { p_id: number; p_kind: string; p_values: Json }
        Returns: string
      }
      set_event_banner: {
        Args: { p_event_id: string; p_path: string }
        Returns: string
      }
      set_organizer_status: {
        Args: { p_reason?: string; p_status: string; p_user_id: string }
        Returns: string
      }
      submit_organizer_application: { Args: { p_values: Json }; Returns: Json }
      withdraw_organizer_application: {
        Args: { p_id: string }
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
