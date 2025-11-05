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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      acquisitions: {
        Row: {
          cessionario_id: string
          cessionario_nome: string
          created_at: string
          data_aquisicao: string
          data_pagamento: string | null
          demanda: string | null
          fase_processo: string | null
          habilitacao_cessionario: string | null
          id: string
          incidente: Database["public"]["Enums"]["incident_type"]
          lucro: number | null
          mapa_orcamentario: string | null
          pessoas: string | null
          prazo_demanda: string | null
          prazo_processual: string | null
          preco_pago: number
          processo: string | null
          proxima_verificacao: string | null
          resumo: string | null
          status: Database["public"]["Enums"]["acquisition_status"]
          titular_acao: string | null
          ultima_movimentacao: string | null
          updated_at: string
          valor_incidente: number
          valor_liquido: number
        }
        Insert: {
          cessionario_id: string
          cessionario_nome: string
          created_at?: string
          data_aquisicao: string
          data_pagamento?: string | null
          demanda?: string | null
          fase_processo?: string | null
          habilitacao_cessionario?: string | null
          id?: string
          incidente: Database["public"]["Enums"]["incident_type"]
          lucro?: number | null
          mapa_orcamentario?: string | null
          pessoas?: string | null
          prazo_demanda?: string | null
          prazo_processual?: string | null
          preco_pago: number
          processo?: string | null
          proxima_verificacao?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["acquisition_status"]
          titular_acao?: string | null
          ultima_movimentacao?: string | null
          updated_at?: string
          valor_incidente: number
          valor_liquido: number
        }
        Update: {
          cessionario_id?: string
          cessionario_nome?: string
          created_at?: string
          data_aquisicao?: string
          data_pagamento?: string | null
          demanda?: string | null
          fase_processo?: string | null
          habilitacao_cessionario?: string | null
          id?: string
          incidente?: Database["public"]["Enums"]["incident_type"]
          lucro?: number | null
          mapa_orcamentario?: string | null
          pessoas?: string | null
          prazo_demanda?: string | null
          prazo_processual?: string | null
          preco_pago?: number
          processo?: string | null
          proxima_verificacao?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["acquisition_status"]
          titular_acao?: string | null
          ultima_movimentacao?: string | null
          updated_at?: string
          valor_incidente?: number
          valor_liquido?: number
        }
        Relationships: []
      }
      cessionario_permissions: {
        Row: {
          can_view_user_id: string
          cessionario_id: string
          created_at: string
          granted_by: string
          id: string
        }
        Insert: {
          can_view_user_id: string
          cessionario_id: string
          created_at?: string
          granted_by: string
          id?: string
        }
        Update: {
          can_view_user_id?: string
          cessionario_id?: string
          created_at?: string
          granted_by?: string
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
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
      is_first_user: { Args: never; Returns: boolean }
    }
    Enums: {
      acquisition_status: "ativa" | "finalizada"
      app_role: "admin" | "cessionario"
      incident_type:
        | "precatorio"
        | "rpv"
        | "precatorio_prioridade"
        | "precatorio_sjrp"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      acquisition_status: ["ativa", "finalizada"],
      app_role: ["admin", "cessionario"],
      incident_type: [
        "precatorio",
        "rpv",
        "precatorio_prioridade",
        "precatorio_sjrp",
      ],
    },
  },
} as const
