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
      attendance_device_signals: {
        Row: {
          created_at: string
          device_hash: string
          event_id: string
          id: number
          kind: string
          record_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          event_id: string
          id?: never
          kind: string
          record_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          event_id?: string
          id?: never
          kind?: string
          record_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_device_signals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_signals_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          created_at: string
          event_id: string
          flag: string | null
          flag_resolution: string | null
          flag_resolved_at: string | null
          flag_resolved_by: string | null
          id: string
          registration_id: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
          time_in_at: string
          time_in_method: string
          time_in_session_id: string | null
          time_out_at: string | null
          time_out_method: string | null
          time_out_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          flag?: string | null
          flag_resolution?: string | null
          flag_resolved_at?: string | null
          flag_resolved_by?: string | null
          id?: string
          registration_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          time_in_at?: string
          time_in_method: string
          time_in_session_id?: string | null
          time_out_at?: string | null
          time_out_method?: string | null
          time_out_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          flag?: string | null
          flag_resolution?: string | null
          flag_resolved_at?: string | null
          flag_resolved_by?: string | null
          id?: string
          registration_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          time_in_at?: string
          time_in_method?: string
          time_in_session_id?: string | null
          time_out_at?: string | null
          time_out_method?: string | null
          time_out_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_flag_resolved_by_fkey"
            columns: ["flag_resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_registration_id_event_id_user_id_fkey"
            columns: ["registration_id", "event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id", "event_id", "user_id"]
          },
          {
            foreignKeyName: "attendance_records_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_time_in_session_id_fkey"
            columns: ["time_in_session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_time_out_session_id_fkey"
            columns: ["time_out_session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_session_secrets: {
        Row: {
          secret: string
          session_id: string
        }
        Insert: {
          secret: string
          session_id: string
        }
        Update: {
          secret?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_secrets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closes_at: string
          event_id: string
          id: string
          kind: string
          opened_at: string
          opened_by: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closes_at: string
          event_id: string
          id?: string
          kind: string
          opened_at?: string
          opened_by: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closes_at?: string
          event_id?: string
          id?: string
          kind?: string
          opened_at?: string
          opened_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      certificates: {
        Row: {
          attendance_record_id: string
          certificate_number: string
          event_date: string
          event_id: string
          event_title: string
          id: string
          issued_at: string
          issued_by: string
          issuer_name: string
          recipient_name: string
          registration_id: string
          revoked_at: string | null
          revoked_by: string | null
          template_version: number
          user_id: string
          verification_code: string
        }
        Insert: {
          attendance_record_id: string
          certificate_number: string
          event_date: string
          event_id: string
          event_title: string
          id?: string
          issued_at?: string
          issued_by: string
          issuer_name: string
          recipient_name: string
          registration_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          template_version?: number
          user_id: string
          verification_code?: string
        }
        Update: {
          attendance_record_id?: string
          certificate_number?: string
          event_date?: string
          event_id?: string
          event_title?: string
          id?: string
          issued_at?: string
          issued_by?: string
          issuer_name?: string
          recipient_name?: string
          registration_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          template_version?: number
          user_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_registration_id_event_id_user_id_fkey"
            columns: ["registration_id", "event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id", "event_id", "user_id"]
          },
          {
            foreignKeyName: "certificates_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
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
      close_attendance_session: {
        Args: { p_event_id: string }
        Returns: string
      }
      complete_event: { Args: { p_event_id: string }; Returns: string }
      correct_attendance: {
        Args: { p_action: string; p_reason: string; p_registration_id: string }
        Returns: string
      }
      decide_registration: {
        Args: { p_decision: string; p_id: string; p_reason?: string }
        Returns: string
      }
      delete_event_draft: { Args: { p_id: string }; Returns: string }
      export_event_report: {
        Args: { p_event_id: string }
        Returns: {
          attendance_status: string
          certificate_number: string
          college: string
          name: string
          program: string
          registration_status: string
          student_id: string
          time_in_at: string
          time_out_at: string
          year_level: number
        }[]
      }
      get_attendance_feed: { Args: { p_event_id: string }; Returns: Json }
      get_attendance_qr: { Args: { p_event_id: string }; Returns: Json }
      get_certificate_eligibility: {
        Args: { p_event_id: string }
        Returns: Json
      }
      get_event_by_invite_code: { Args: { p_code: string }; Returns: string }
      get_event_report: { Args: { p_event_id: string }; Returns: Json }
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
      issue_certificates: { Args: { p_event_id: string }; Returns: Json }
      open_attendance_session: {
        Args: { p_event_id: string; p_kind: string }
        Returns: string
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
      revoke_certificate: {
        Args: { p_id: string; p_reason: string }
        Returns: string
      }
      save_event: { Args: { p_id: string; p_values: Json }; Returns: Json }
      save_lookup: {
        Args: { p_id: number; p_kind: string; p_values: Json }
        Returns: string
      }
      set_attendance_settings: {
        Args: {
          p_event_id: string
          p_lead: number
          p_onsite: boolean
          p_policy: string
        }
        Returns: string
      }
      set_certificate_enabled: {
        Args: { p_enabled: boolean; p_event_id: string }
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
      submit_attendance_scan: {
        Args: {
          p_device_id: string
          p_expected_event_id?: string
          p_token: string
        }
        Returns: Json
      }
      submit_organizer_application: { Args: { p_values: Json }; Returns: Json }
      verify_certificate: { Args: { p_code: string }; Returns: Json }
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
