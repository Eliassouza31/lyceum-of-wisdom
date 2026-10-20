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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_business: {
        Args: { p_name: string; p_timezone: string };
        Returns: string;
      };
      has_business_role: {
        Args: {
          p_business_id: string;
          p_roles: Database["public"]["Enums"]["member_role"][];
        };
        Returns: boolean;
      };
      is_business_member: { Args: { p_business_id: string }; Returns: boolean };
      is_valid_timezone: { Args: { p_timezone: string }; Returns: boolean };
    };
    Enums: {
      consent_action: "granted" | "revoked";
      consent_channel: "email" | "sms";
      consent_source:
        | "staff_entry"
        | "import"
        | "unsubscribe_link"
        | "sms_stop"
        | "booking_form";
      member_role: "owner" | "admin" | "staff";
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
    },
  },
} as const;
