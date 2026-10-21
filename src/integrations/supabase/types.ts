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
      attendance_records: {
        Row: {
          id: string
          marked_at: string
          present: boolean
          session_id: string
          student_id: string
          studio_id: string
        }
        Insert: {
          id?: string
          marked_at?: string
          present: boolean
          session_id: string
          student_id: string
          studio_id: string
        }
        Update: {
          id?: string
          marked_at?: string
          present?: boolean
          session_id?: string
          student_id?: string
          studio_id?: string
        }
        Relationships: []
      }
      batch_members: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          joined_on: string
          left_on: string | null
          student_id: string
          studio_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          joined_on?: string
          left_on?: string | null
          student_id: string
          studio_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          joined_on?: string
          left_on?: string | null
          student_id?: string
          studio_id?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          archived_at: string | null
          created_at: string
          ends_at: string | null
          id: string
          name: string
          room: string | null
          starts_at: string | null
          studio_id: string
          trainer_name: string | null
          weekdays: number[]
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          room?: string | null
          starts_at?: string | null
          studio_id: string
          trainer_name?: string | null
          weekdays?: number[]
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          room?: string | null
          starts_at?: string | null
          studio_id?: string
          trainer_name?: string | null
          weekdays?: number[]
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          applied: boolean
          event_at: string | null
          id: string
          payload: Json
          received_at: string
          type: string
        }
        Insert: {
          applied?: boolean
          event_at?: string | null
          id: string
          payload: Json
          received_at?: string
          type: string
        }
        Update: {
          applied?: boolean
          event_at?: string | null
          id?: string
          payload?: Json
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      charges: {
        Row: {
          amount_paise: number
          created_at: string
          due_on: string
          fee_plan_id: string | null
          fee_plan_name: string
          id: string
          period: string
          student_id: string
          studio_id: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount_paise: number
          created_at?: string
          due_on: string
          fee_plan_id?: string | null
          fee_plan_name: string
          id?: string
          period: string
          student_id: string
          studio_id: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_paise?: number
          created_at?: string
          due_on?: string
          fee_plan_id?: string | null
          fee_plan_name?: string
          id?: string
          period?: string
          student_id?: string
          studio_id?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          session_on: string
          studio_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          session_on: string
          studio_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          session_on?: string
          studio_id?: string
        }
        Relationships: []
      }
      family_links: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          revoked_at: string | null
          studio_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          revoked_at?: string | null
          studio_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          revoked_at?: string | null
          studio_id?: string
          token_hash?: string
        }
        Relationships: []
      }
      fee_plan_assignments: {
        Row: {
          amount_paise: number
          created_at: string
          ends_on: string | null
          fee_plan_id: string
          id: string
          starts_on: string
          student_id: string
          studio_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          ends_on?: string | null
          fee_plan_id: string
          id?: string
          starts_on: string
          student_id: string
          studio_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          ends_on?: string | null
          fee_plan_id?: string
          id?: string
          starts_on?: string
          student_id?: string
          studio_id?: string
        }
        Relationships: []
      }
      fee_plans: {
        Row: {
          amount_paise: number
          archived_at: string | null
          classes_per_week: number | null
          created_at: string
          id: string
          name: string
          studio_id: string
        }
        Insert: {
          amount_paise: number
          archived_at?: string | null
          classes_per_week?: number | null
          created_at?: string
          id?: string
          name: string
          studio_id: string
        }
        Update: {
          amount_paise?: number
          archived_at?: string | null
          classes_per_week?: number | null
          created_at?: string
          id?: string
          name?: string
          studio_id?: string
        }
        Relationships: []
      }
      guardians: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          reminders_opted_out: boolean
          studio_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          reminders_opted_out?: boolean
          studio_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          reminders_opted_out?: boolean
          studio_id?: string
        }
        Relationships: []
      }
      invite_attempts: {
        Row: {
          attempted_at: string
          id: number
          source_hash: string | null
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: never
          source_hash?: string | null
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: never
          source_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      member_invites: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          guardian_id: string
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          revoked_at: string | null
          studio_id: string
          token_hash: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          guardian_id: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          revoked_at?: string | null
          studio_id: string
          token_hash: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          guardian_id?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          revoked_at?: string | null
          studio_id?: string
          token_hash?: string
        }
        Relationships: []
      }
      member_links: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          revoked_at: string | null
          studio_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          revoked_at?: string | null
          studio_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          revoked_at?: string | null
          studio_id?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_claims: {
        Row: {
          amount_paise: number
          confirmed_paise: number | null
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          guardian_id: string
          id: string
          method: string
          paid_on: string
          payment_id: string | null
          reference: string | null
          screenshot_path: string | null
          status: string
          student_id: string
          studio_id: string
          submitted_via: string
        }
        Insert: {
          amount_paise: number
          confirmed_paise?: number | null
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          guardian_id: string
          id?: string
          method: string
          paid_on: string
          payment_id?: string | null
          reference?: string | null
          screenshot_path?: string | null
          status?: string
          student_id: string
          studio_id: string
          submitted_via?: string
        }
        Update: {
          amount_paise?: number
          confirmed_paise?: number | null
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          guardian_id?: string
          id?: string
          method?: string
          paid_on?: string
          payment_id?: string | null
          reference?: string | null
          screenshot_path?: string | null
          status?: string
          student_id?: string
          studio_id?: string
          submitted_via?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          id: string
          idempotency_key: string
          method: string
          note: string | null
          paid_on: string
          reference: string | null
          student_id: string
          studio_id: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount_paise: number
          created_at?: string
          id?: string
          idempotency_key: string
          method: string
          note?: string | null
          paid_on: string
          reference?: string | null
          student_id: string
          studio_id: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_paise?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          method?: string
          note?: string | null
          paid_on?: string
          reference?: string | null
          student_id?: string
          studio_id?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          attempts: number
          charge_id: string
          created_at: string
          dedupe_key: string
          guardian_id: string
          id: string
          kind: string
          last_error: string | null
          lease_expires_at: string | null
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          sent_at: string | null
          status: string
          student_id: string
          studio_id: string
          template_name: string
        }
        Insert: {
          attempts?: number
          charge_id: string
          created_at?: string
          dedupe_key: string
          guardian_id: string
          id?: string
          kind: string
          last_error?: string | null
          lease_expires_at?: string | null
          next_attempt_at?: string
          payload: Json
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          student_id: string
          studio_id: string
          template_name: string
        }
        Update: {
          attempts?: number
          charge_id?: string
          created_at?: string
          dedupe_key?: string
          guardian_id?: string
          id?: string
          kind?: string
          last_error?: string | null
          lease_expires_at?: string | null
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          student_id?: string
          studio_id?: string
          template_name?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          archived_at: string | null
          created_at: string
          guardian_id: string | null
          id: string
          name: string
          studio_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          guardian_id?: string | null
          id?: string
          name: string
          studio_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          guardian_id?: string | null
          id?: string
          name?: string
          studio_id?: string
        }
        Relationships: []
      }
      studio_profiles: {
        Row: {
          billing_status: string
          billing_updated_at: string | null
          city: string | null
          created_at: string
          current_period_end: string | null
          dodo_customer_id: string | null
          dodo_subscription_id: string | null
          name: string
          phone: string | null
          plan: string
          studio_name: string
          user_id: string
        }
        Insert: {
          billing_status?: string
          billing_updated_at?: string | null
          city?: string | null
          created_at?: string
          current_period_end?: string | null
          dodo_customer_id?: string | null
          dodo_subscription_id?: string | null
          name?: string
          phone?: string | null
          plan?: string
          studio_name?: string
          user_id: string
        }
        Update: {
          billing_status?: string
          billing_updated_at?: string | null
          city?: string | null
          created_at?: string
          current_period_end?: string | null
          dodo_customer_id?: string | null
          dodo_subscription_id?: string | null
          name?: string
          phone?: string | null
          plan?: string
          studio_name?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          chat_id: number | null
          created_at: string
          guardian_id: string
          id: string
          joined_at: string | null
          revoked_at: string | null
          studio_id: string
          token_hash: string
        }
        Insert: {
          chat_id?: number | null
          created_at?: string
          guardian_id: string
          id?: string
          joined_at?: string | null
          revoked_at?: string | null
          studio_id: string
          token_hash: string
        }
        Update: {
          chat_id?: number | null
          created_at?: string
          guardian_id?: string
          id?: string
          joined_at?: string | null
          revoked_at?: string | null
          studio_id?: string
          token_hash?: string
        }
        Relationships: []
      }
      telegram_reminder_log: {
        Row: {
          charge_id: string
          created_at: string
          id: string
          sent_on: string
          studio_id: string
        }
        Insert: {
          charge_id: string
          created_at?: string
          id?: string
          sent_on: string
          studio_id: string
        }
        Update: {
          charge_id?: string
          created_at?: string
          id?: string
          sent_on?: string
          studio_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist_signups: {
        Row: {
          consent: boolean
          created_at: string
          estimated_amount: number
          id: string
          ip_hash: string | null
          late_percent: number
          monthly_fee: number
          opt_out_token: string
          opted_out_at: string | null
          source: string
          student_bucket: string
          studio_name: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          whatsapp_number: string
        }
        Insert: {
          consent?: boolean
          created_at?: string
          estimated_amount?: number
          id?: string
          ip_hash?: string | null
          late_percent?: number
          monthly_fee?: number
          opt_out_token?: string
          opted_out_at?: string | null
          source?: string
          student_bucket: string
          studio_name: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp_number: string
        }
        Update: {
          consent?: boolean
          created_at?: string
          estimated_amount?: number
          id?: string
          ip_hash?: string | null
          late_percent?: number
          monthly_fee?: number
          opt_out_token?: string
          opted_out_at?: string | null
          source?: string
          student_bucket?: string
          studio_name?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_billing_event: {
        Args: {
          p_customer_id: string | null
          p_event_at: string | null
          p_event_id: string
          p_period_end: string | null
          p_plan: string | null
          p_status: string | null
          p_subscription_id: string | null
          p_user_id: string | null
        }
        Returns: string
      }
      assign_fee_plan: {
        Args: { p_plan: string; p_starts_on: string; p_student: string }
        Returns: string
      }
      attendance_by_batch: {
        Args: { p_from: string; p_to: string }
        Returns: {
          batch_id: string
          batch_name: string
          held: number
          weekdays: number[]
        }[]
      }
      attendance_by_student: {
        Args: { p_from: string; p_to: string }
        Returns: {
          marked: number
          present: number
          student_id: string
          student_name: string
        }[]
      }
      batch_day: {
        Args: { p_batch: string; p_on: string }
        Returns: {
          present: boolean | null
          student_id: string
          student_name: string
        }[]
      }
      claim_due_reminders: {
        Args: { p_lease_seconds?: number; p_limit: number }
        Returns: Database["public"]["Tables"]["reminders"]["Row"][]
      }
      generate_monthly_charges: {
        Args: { p_due_on?: string; p_period: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ledger_overview: {
        Args: { p_period: string; p_today?: string }
        Returns: {
          billed_paise: number
          collected_paise: number
          outstanding_paise: number
          overdue_students: number
          pending_students: number
          total_students: number
        }[]
      }
      owner_nudge_summary: {
        Args: { p_today?: string }
        Returns: {
          due_today_count: number
          outstanding_paise: number
          overdue_count: number
          studio_id: string
          unpaid_count: number
        }[]
      }
      studio_capacity: {
        Args: Record<PropertyKey, never>
        Returns: {
          student_count: number
          student_limit: number
          trial_ends_at: string
        }[]
      }
      mark_attendance: {
        Args: { p_batch: string; p_marks: Json; p_session_on: string }
        Returns: number
      }
      preview_fee_reminders: {
        Args: {
          p_only_overdue?: boolean
          p_period: string
          p_student?: string
          p_today?: string
        }
        Returns: {
          due_on: string
          outstanding_paise: number
          phone: string
          skip_reason: string
          status: string
          student_id: string
          student_name: string
        }[]
      }
      queue_fee_reminders: {
        Args: {
          p_only_overdue?: boolean
          p_period: string
          p_student?: string
          p_today?: string
        }
        Returns: number
      }
      monthly_trend: {
        Args: { p_months?: number; p_today?: string }
        Returns: {
          billed_paise: number
          collected_paise: number
          missing_paise: number
          period: string
        }[]
      }
      claim_screenshots_to_purge: {
        Args: { p_days?: number }
        Returns: { claim_id: string; screenshot_path: string }[]
      }
      confirm_payment_claim: {
        Args: {
          p_acknowledge_excess?: boolean
          p_amount_paise?: number
          p_claim: string
        }
        Returns: Database["public"]["Tables"]["payment_claims"]["Row"]
      }
      payment_claim_queue: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount_paise: number
          claim_id: string
          created_at: string
          excess_paise: number
          has_screenshot: boolean
          method: string
          owed_paise: number
          paid_on: string
          possible_duplicate: boolean
          reference: string
          remaining_paise: number
          student_id: string
          student_name: string
        }[]
      }
      reject_payment_claim: {
        Args: { p_claim: string; p_reason: string }
        Returns: Database["public"]["Tables"]["payment_claims"]["Row"]
      }
      create_member_invite: {
        Args: { p_code_hash: string; p_days: number; p_guardian: string; p_token_hash: string }
        Returns: { expires_at: string; id: string }[]
      }
      redeem_telegram_link: {
        Args: { p_chat_id: number; p_token_hash: string }
        Returns: { guardian_id: string; outcome: string; studio_id: string }[]
      }
      redeem_member_invite: {
        Args: { p_secret: string; p_source?: string }
        Returns: string | null
      }
      member_studios: {
        Args: Record<PropertyKey, never>
        Returns: { joined_at: string; studio_id: string; studio_name: string }[]
      }
      member_view: {
        Args: { p_studio: string }
        Returns: Json | null
      }
      member_claims: {
        Args: { p_studio: string }
        Returns: {
          amount_paise: number
          created_at: string
          decision_reason: string | null
          id: string
          method: string
          paid_on: string
          status: string
          student_id: string
        }[]
      }
      submit_payment_claim_member: {
        Args: {
          p_amount_paise: number
          p_method: string
          p_paid_on: string
          p_reference?: string
          p_student: string
          p_studio: string
        }
        Returns: Database["public"]["Tables"]["payment_claims"]["Row"]
      }
      submit_payment_claim: {
        Args: {
          p_amount_paise: number
          p_guardian: string
          p_method: string
          p_paid_on: string
          p_reference?: string
          p_student: string
        }
        Returns: Database["public"]["Tables"]["payment_claims"]["Row"]
      }
      payment_check: {
        Args: { p_amount_paise: number; p_student: string }
        Returns: {
          excess_paise: number
          owed_paise: number
          remaining_paise: number
        }[]
      }
      record_payment: {
        Args: {
          p_acknowledge_excess?: boolean
          p_amount_paise: number
          p_idempotency_key: string
          p_method: string
          p_note: string | null
          p_paid_on: string
          p_reference?: string | null
          p_student: string
        }
        Returns: Database["public"]["Tables"]["payments"]["Row"]
      }
      student_attendance: {
        Args: { p_from: string; p_student: string; p_to: string }
        Returns: {
          batch_id: string
          batch_name: string
          present: boolean
          session_on: string
        }[]
      }
      student_charge_ledger: {
        Args: { p_student: string; p_today?: string }
        Returns: {
          allocated_paise: number
          amount_paise: number
          charge_id: string
          due_on: string
          fee_plan_name: string
          outstanding_paise: number
          period: string
          settled_method: string
          settled_on: string
          status: string
          void_reason: string
          voided_at: string
        }[]
      }
      student_ledger_status: {
        Args: { p_period: string; p_student_ids?: string[]; p_today?: string }
        Returns: {
          allocated_paise: number
          amount_paise: number
          balance_paise: number
          charge_id: string
          due_on: string
          fee_plan_name: string
          outstanding_paise: number
          period: string
          status: string
          student_id: string
          student_name: string
        }[]
      }
      studio_snapshot: {
        Args: { p_period: string; p_today?: string }
        Returns: {
          active_students: number
          billed_paise: number
          charged_students: number
          collected_paise: number
          missing_paise: number
          not_yet_due_paise: number
          ongoing_batches: number
          overdue_paise: number
          paid_students: number
        }[]
      }
      unpaid_students: {
        Args: { p_period: string; p_today?: string }
        Returns: {
          amount_paise: number
          charge_id: string
          days_overdue: number
          due_on: string
          outstanding_paise: number
          phone: string
          status: string
          student_id: string
          student_name: string
        }[]
      }
    }
    Enums: {
      app_role: "owner"
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
      app_role: ["owner"],
    },
  },
} as const
