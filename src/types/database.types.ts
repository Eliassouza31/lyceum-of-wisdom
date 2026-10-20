export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          business_id: string;
          client_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          ends_at: string;
          id: string;
          location: string | null;
          notes: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          ends_at: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          ends_at?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_client_id_business_id_fkey";
            columns: ["client_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
      business_members: {
        Row: {
          business_id: string;
          created_at: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          created_at?: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          contact_email: string | null;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          phone: string | null;
          postal_address: string | null;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          contact_email?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          phone?: string | null;
          postal_address?: string | null;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          contact_email?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          postal_address?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          business_id: string;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          email_reminders_consent: boolean;
          first_name: string;
          id: string;
          last_name: string;
          notes: string | null;
          phone_e164: string | null;
          sms_reminders_consent: boolean;
          unsubscribe_token: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          email_reminders_consent?: boolean;
          first_name: string;
          id?: string;
          last_name?: string;
          notes?: string | null;
          phone_e164?: string | null;
          sms_reminders_consent?: boolean;
          unsubscribe_token?: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          email_reminders_consent?: boolean;
          first_name?: string;
          id?: string;
          last_name?: string;
          notes?: string | null;
          phone_e164?: string | null;
          sms_reminders_consent?: boolean;
          unsubscribe_token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_events: {
        Row: {
          action: Database["public"]["Enums"]["consent_action"];
          business_id: string;
          channel: Database["public"]["Enums"]["consent_channel"];
          client_id: string;
          created_at: string;
          id: string;
          ip_address: string | null;
          recorded_by: string | null;
          source: Database["public"]["Enums"]["consent_source"];
          user_agent: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: Database["public"]["Enums"]["consent_action"];
          business_id: string;
          channel: Database["public"]["Enums"]["consent_channel"];
          client_id: string;
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          recorded_by?: string | null;
          source: Database["public"]["Enums"]["consent_source"];
          user_agent?: string | null;
        };
        Update: {
          action?: Database["public"]["Enums"]["consent_action"];
          business_id?: string;
          channel?: Database["public"]["Enums"]["consent_channel"];
          client_id?: string;
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          recorded_by?: string | null;
          source?: Database["public"]["Enums"]["consent_source"];
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consent_events_client_id_business_id_fkey";
            columns: ["client_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
      message_templates: {
        Row: {
          body: string;
          business_id: string;
          channel: Database["public"]["Enums"]["reminder_channel"];
          created_at: string;
          id: string;
          subject: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          business_id: string;
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          business_id?: string;
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_templates_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_events: {
        Row: {
          business_id: string;
          created_at: string;
          detail: NonNullable<Json>;
          event: Database["public"]["Enums"]["notification_event_type"];
          id: string;
          job_id: string;
          provider_event_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          created_at?: string;
          detail?: NonNullable<Json>;
          event: Database["public"]["Enums"]["notification_event_type"];
          id?: string;
          job_id: string;
          provider_event_id?: string | null;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          detail?: NonNullable<Json>;
          event?: Database["public"]["Enums"]["notification_event_type"];
          id?: string;
          job_id?: string;
          provider_event_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_events_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "reminder_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reminder_jobs: {
        Row: {
          appointment_id: string;
          attempts: number;
          business_id: string;
          channel: Database["public"]["Enums"]["reminder_channel"];
          created_at: string;
          id: string;
          last_error: string | null;
          locked_at: string | null;
          next_attempt_at: string | null;
          offset_minutes: number;
          provider_message_id: string | null;
          rule_id: string | null;
          send_at: string;
          sent_at: string | null;
          skip_reason: string | null;
          status: Database["public"]["Enums"]["reminder_job_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          appointment_id: string;
          attempts?: number;
          business_id: string;
          channel: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          next_attempt_at?: string | null;
          offset_minutes: number;
          provider_message_id?: string | null;
          rule_id?: string | null;
          send_at: string;
          sent_at?: string | null;
          skip_reason?: string | null;
          status?: Database["public"]["Enums"]["reminder_job_status"];
          updated_at?: string;
        };
        Update: {
          appointment_id?: string;
          attempts?: number;
          business_id?: string;
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          next_attempt_at?: string | null;
          offset_minutes?: number;
          provider_message_id?: string | null;
          rule_id?: string | null;
          send_at?: string;
          sent_at?: string | null;
          skip_reason?: string | null;
          status?: Database["public"]["Enums"]["reminder_job_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_jobs_appointment_id_business_id_fkey";
            columns: ["appointment_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "reminder_jobs_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "reminder_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      reminder_rules: {
        Row: {
          business_id: string;
          channel: Database["public"]["Enums"]["reminder_channel"];
          created_at: string;
          id: string;
          is_active: boolean;
          offset_minutes: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          is_active?: boolean;
          offset_minutes: number;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          is_active?: boolean;
          offset_minutes?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_rules_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      suppressions: {
        Row: {
          address: string;
          business_id: string | null;
          channel: Database["public"]["Enums"]["reminder_channel"];
          created_at: string;
          id: string;
          reason: Database["public"]["Enums"]["suppression_reason"];
        };
        ComputedFields: never;
        Insert: {
          address: string;
          business_id?: string | null;
          channel: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          reason: Database["public"]["Enums"]["suppression_reason"];
        };
        Update: {
          address?: string;
          business_id?: string | null;
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          id?: string;
          reason?: Database["public"]["Enums"]["suppression_reason"];
        };
        Relationships: [
          {
            foreignKeyName: "suppressions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_counters: {
        Row: {
          business_id: string;
          emails_sent: number;
          period_start: string;
          sms_sent: number;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          emails_sent?: number;
          period_start: string;
          sms_sent?: number;
        };
        Update: {
          business_id?: string;
          emails_sent?: number;
          period_start?: string;
          sms_sent?: number;
        };
        Relationships: [
          {
            foreignKeyName: "usage_counters_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_due_reminder_jobs: {
        Args: { p_limit?: number };
        Returns: {
          appointment_location: string;
          appointment_starts_at: string;
          appointment_title: string;
          attempts: number;
          business_contact_email: string;
          business_id: string;
          business_name: string;
          business_postal_address: string;
          business_timezone: string;
          client_email: string;
          client_first_name: string;
          job_id: string;
          send_at: string;
          template_body: string;
          template_subject: string;
          unsubscribe_token: string;
        }[];
      };
      complete_reminder_job: {
        Args: { p_job_id: string; p_provider_message_id: string };
        Returns: undefined;
      };
      create_business: {
        Args: { p_name: string; p_timezone: string };
        Returns: string;
      };
      fail_reminder_job: {
        Args: { p_error: string; p_job_id: string; p_permanent: boolean };
        Returns: undefined;
      };
      get_dispatch_secret: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_unsubscribe_info: {
        Args: { p_token: string };
        Returns: {
          business_name: string;
          subscribed: boolean;
        }[];
      };
      has_business_role: {
        Args: {
          p_business_id: string;
          p_roles: Database["public"]["Enums"]["member_role"][];
        };
        Returns: boolean;
      };
      invoke_reminder_dispatch: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      is_business_member: { Args: { p_business_id: string }; Returns: boolean };
      is_valid_timezone: { Args: { p_timezone: string }; Returns: boolean };
      record_email_event: {
        Args: {
          p_detail?: Json;
          p_event: Database["public"]["Enums"]["notification_event_type"];
          p_permanent_bounce?: boolean;
          p_provider_event_id: string;
          p_provider_message_id: string;
        };
        Returns: boolean;
      };
      refresh_reminder_jobs: {
        Args: {
          p_appointment_id?: string;
          p_business_id: string;
          p_rule_id?: string;
        };
        Returns: undefined;
      };
      unsubscribe_by_token: {
        Args: { p_ip_address?: string; p_token: string; p_user_agent?: string };
        Returns: string;
      };
    };
    Enums: {
      appointment_status: "scheduled" | "cancelled" | "completed" | "no_show";
      consent_action: "granted" | "revoked";
      consent_channel: "email" | "sms";
      consent_source:
        | "staff_entry"
        | "import"
        | "unsubscribe_link"
        | "sms_stop"
        | "booking_form";
      member_role: "owner" | "admin" | "staff";
      notification_event_type:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed"
        | "skipped"
        | "cancelled";
      reminder_channel: "email" | "sms";
      reminder_job_status:
        "pending" | "processing" | "sent" | "failed" | "cancelled" | "skipped";
      suppression_reason: "unsubscribed" | "hard_bounce" | "complaint";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: ["scheduled", "cancelled", "completed", "no_show"],
      consent_action: ["granted", "revoked"],
      consent_channel: ["email", "sms"],
      consent_source: [
        "staff_entry",
        "import",
        "unsubscribe_link",
        "sms_stop",
        "booking_form",
      ],
      member_role: ["owner", "admin", "staff"],
      notification_event_type: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "complained",
        "failed",
        "skipped",
        "cancelled",
      ],
      reminder_channel: ["email", "sms"],
      reminder_job_status: [
        "pending",
        "processing",
        "sent",
        "failed",
        "cancelled",
        "skipped",
      ],
      suppression_reason: ["unsubscribed", "hard_bounce", "complaint"],
    },
  },
} as const;
