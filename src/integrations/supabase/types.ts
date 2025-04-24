export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      air_enquiries: {
        Row: {
          cargo_details: Json | null
          client_id: string
          created_by: string
          created_date: string | null
          customer: string
          enq_recd_datetime: string | null
          enquiry_no: string
          export_import_type: Database["public"]["Enums"]["inquiry_type_enum"]
          id: number
          is_deleted: boolean | null
          last_upd: string | null
          last_upd_by: string | null
          pod: string
          pol: string
          quoted_datetime: string | null
          remarks: string | null
          sales: string | null
          special_handling_required: boolean | null
          status: Database["public"]["Enums"]["status_enum"]
          tat: string | null
        }
        Insert: {
          cargo_details?: Json | null
          client_id: string
          created_by: string
          created_date?: string | null
          customer: string
          enq_recd_datetime?: string | null
          enquiry_no: string
          export_import_type: Database["public"]["Enums"]["inquiry_type_enum"]
          id?: number
          is_deleted?: boolean | null
          last_upd?: string | null
          last_upd_by?: string | null
          pod: string
          pol: string
          quoted_datetime?: string | null
          remarks?: string | null
          sales?: string | null
          special_handling_required?: boolean | null
          status: Database["public"]["Enums"]["status_enum"]
          tat?: string | null
        }
        Update: {
          cargo_details?: Json | null
          client_id?: string
          created_by?: string
          created_date?: string | null
          customer?: string
          enq_recd_datetime?: string | null
          enquiry_no?: string
          export_import_type?: Database["public"]["Enums"]["inquiry_type_enum"]
          id?: number
          is_deleted?: boolean | null
          last_upd?: string | null
          last_upd_by?: string | null
          pod?: string
          pol?: string
          quoted_datetime?: string | null
          remarks?: string | null
          sales?: string | null
          special_handling_required?: boolean | null
          status?: Database["public"]["Enums"]["status_enum"]
          tat?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "air_inquiries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          client_id: string
          contact_name: string
          contact_number: string
          country: string
          created_by: string
          created_date: string
          district: string | null
          email: string
          id: number
          is_deleted: boolean
          name: string
          pincode: string
          search_vector: unknown | null
          state: string
          updated_by: string
          updated_date: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          client_id: string
          contact_name: string
          contact_number: string
          country: string
          created_by: string
          created_date?: string
          district?: string | null
          email: string
          id?: never
          is_deleted?: boolean
          name: string
          pincode: string
          search_vector?: unknown | null
          state: string
          updated_by: string
          updated_date?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          client_id?: string
          contact_name?: string
          contact_number?: string
          country?: string
          created_by?: string
          created_date?: string
          district?: string | null
          email?: string
          id?: never
          is_deleted?: boolean
          name?: string
          pincode?: string
          search_vector?: unknown | null
          state?: string
          updated_by?: string
          updated_date?: string
        }
        Relationships: []
      }
      client_sequences: {
        Row: {
          sequence_value: number
        }
        Insert: {
          sequence_value: number
        }
        Update: {
          sequence_value?: number
        }
        Relationships: []
      }
      quotations: {
        Row: {
          accepted_datetime: string | null
          air_enquiry_id: number | null
          client_id: string
          created_by: string
          created_date: string
          customer: string
          enquiry_type: Database["public"]["Enums"]["quotation_enquiry_type_enum"]
          export_import_type: string
          id: number
          is_deleted: boolean | null
          last_upd: string | null
          last_upd_by: string | null
          line_items: Json
          pod: string
          pol: string
          quotation_no: string
          remarks: string | null
          sales: string | null
          sea_enquiry_id: number | null
          sent_datetime: string | null
          status: Database["public"]["Enums"]["quotation_status_enum"]
          terms_and_conditions: string | null
          total_amount: number | null
          valid_until: string | null
        }
        Insert: {
          accepted_datetime?: string | null
          air_enquiry_id?: number | null
          client_id: string
          created_by: string
          created_date?: string
          customer: string
          enquiry_type: Database["public"]["Enums"]["quotation_enquiry_type_enum"]
          export_import_type: string
          id?: number
          is_deleted?: boolean | null
          last_upd?: string | null
          last_upd_by?: string | null
          line_items?: Json
          pod: string
          pol: string
          quotation_no: string
          remarks?: string | null
          sales?: string | null
          sea_enquiry_id?: number | null
          sent_datetime?: string | null
          status?: Database["public"]["Enums"]["quotation_status_enum"]
          terms_and_conditions?: string | null
          total_amount?: number | null
          valid_until?: string | null
        }
        Update: {
          accepted_datetime?: string | null
          air_enquiry_id?: number | null
          client_id?: string
          created_by?: string
          created_date?: string
          customer?: string
          enquiry_type?: Database["public"]["Enums"]["quotation_enquiry_type_enum"]
          export_import_type?: string
          id?: number
          is_deleted?: boolean | null
          last_upd?: string | null
          last_upd_by?: string | null
          line_items?: Json
          pod?: string
          pol?: string
          quotation_no?: string
          remarks?: string | null
          sales?: string | null
          sea_enquiry_id?: number | null
          sent_datetime?: string | null
          status?: Database["public"]["Enums"]["quotation_status_enum"]
          terms_and_conditions?: string | null
          total_amount?: number | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_air_enquiry_id_fkey"
            columns: ["air_enquiry_id"]
            isOneToOne: false
            referencedRelation: "air_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "quotations_sea_enquiry_id_fkey"
            columns: ["sea_enquiry_id"]
            isOneToOne: false
            referencedRelation: "sea_enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      sea_enquiries: {
        Row: {
          cargo_details: Json | null
          client_id: string
          created_by: string
          created_date: string | null
          customer: string | null
          enq_recd_datetime: string | null
          enquiry_datetime: string | null
          enquiry_no: string
          id: number
          inquiry_type: Database["public"]["Enums"]["inquiry_type_enum"] | null
          is_deleted: boolean | null
          last_upd: string | null
          last_upd_by: string | null
          pod: string | null
          pol: string | null
          quotation_no: string | null
          quoted_datetime: string | null
          remarks: string | null
          sales: string | null
          status: Database["public"]["Enums"]["status_enum"] | null
          tat: string | null
        }
        Insert: {
          cargo_details?: Json | null
          client_id: string
          created_by: string
          created_date?: string | null
          customer?: string | null
          enq_recd_datetime?: string | null
          enquiry_datetime?: string | null
          enquiry_no: string
          id?: number
          inquiry_type?: Database["public"]["Enums"]["inquiry_type_enum"] | null
          is_deleted?: boolean | null
          last_upd?: string | null
          last_upd_by?: string | null
          pod?: string | null
          pol?: string | null
          quotation_no?: string | null
          quoted_datetime?: string | null
          remarks?: string | null
          sales?: string | null
          status?: Database["public"]["Enums"]["status_enum"] | null
          tat?: string | null
        }
        Update: {
          cargo_details?: Json | null
          client_id?: string
          created_by?: string
          created_date?: string | null
          customer?: string | null
          enq_recd_datetime?: string | null
          enquiry_datetime?: string | null
          enquiry_no?: string
          id?: number
          inquiry_type?: Database["public"]["Enums"]["inquiry_type_enum"] | null
          is_deleted?: boolean | null
          last_upd?: string | null
          last_upd_by?: string | null
          pod?: string | null
          pol?: string | null
          quotation_no?: string | null
          quoted_datetime?: string | null
          remarks?: string | null
          sales?: string | null
          status?: Database["public"]["Enums"]["status_enum"] | null
          tat?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sea_enquiries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_client: {
        Args: { p_client_data: Json }
        Returns: Json
      }
      add_client_with_universal_sequence: {
        Args: { p_client_data: Json }
        Returns: Json
      }
      get_next_air_enquiry_number: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_next_sea_enquiry_number: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_next_universal_id: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      inco_terms_enum: "FOB" | "DDP" | "EXW" | "DAP" | "CIF" | "CFR"
      inquiry_type_enum: "Export" | "Import"
      quotation_enquiry_type_enum: "AIR" | "SEA"
      quotation_status_enum: "PENDING" | "SENT" | "ACCEPTED" | "REJECTED"
      status_enum: "QUOTED" | "PENDING" | "REJECTED" | "NOMINATED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      inco_terms_enum: ["FOB", "DDP", "EXW", "DAP", "CIF", "CFR"],
      inquiry_type_enum: ["Export", "Import"],
      quotation_enquiry_type_enum: ["AIR", "SEA"],
      quotation_status_enum: ["PENDING", "SENT", "ACCEPTED", "REJECTED"],
      status_enum: ["QUOTED", "PENDING", "REJECTED", "NOMINATED"],
    },
  },
} as const
