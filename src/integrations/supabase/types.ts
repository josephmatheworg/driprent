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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      fits: {
        Row: {
          available_from: string
          available_to: string | null
          brand: string | null
          care_instructions: string | null
          category: Database["public"]["Enums"]["fit_category"]
          color: string | null
          condition: string | null
          created_at: string
          daily_price: number
          deposit_amount: number
          description: string | null
          id: string
          images: string[]
          is_available: boolean
          owner_id: string
          rating: number | null
          size: Database["public"]["Enums"]["fit_size"]
          title: string
          total_rentals: number | null
          total_reviews: number | null
          updated_at: string
        }
        Insert: {
          available_from?: string
          available_to?: string | null
          brand?: string | null
          care_instructions?: string | null
          category: Database["public"]["Enums"]["fit_category"]
          color?: string | null
          condition?: string | null
          created_at?: string
          daily_price: number
          deposit_amount?: number
          description?: string | null
          id?: string
          images?: string[]
          is_available?: boolean
          owner_id: string
          rating?: number | null
          size: Database["public"]["Enums"]["fit_size"]
          title: string
          total_rentals?: number | null
          total_reviews?: number | null
          updated_at?: string
        }
        Update: {
          available_from?: string
          available_to?: string | null
          brand?: string | null
          care_instructions?: string | null
          category?: Database["public"]["Enums"]["fit_category"]
          color?: string | null
          condition?: string | null
          created_at?: string
          daily_price?: number
          deposit_amount?: number
          description?: string | null
          id?: string
          images?: string[]
          is_available?: boolean
          owner_id?: string
          rating?: number | null
          size?: Database["public"]["Enums"]["fit_size"]
          title?: string
          total_rentals?: number | null
          total_reviews?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fits_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          location: string | null
          phone: string | null
          rating: number | null
          total_reviews: number | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          rating?: number | null
          total_reviews?: number | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          rating?: number | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      rentals: {
        Row: {
          agreement_accepted: boolean | null
          agreement_accepted_at: string | null
          created_at: string
          deposit_amount: number
          end_date: string
          fit_id: string
          id: string
          owner_id: string
          rental_fee: number
          renter_id: string
          return_notes: string | null
          returned_at: string | null
          service_fee: number
          start_date: string
          status: Database["public"]["Enums"]["rental_status"]
          stripe_payment_intent_id: string | null
          total_amount: number
          total_days: number
          updated_at: string
        }
        Insert: {
          agreement_accepted?: boolean | null
          agreement_accepted_at?: string | null
          created_at?: string
          deposit_amount: number
          end_date: string
          fit_id: string
          id?: string
          owner_id: string
          rental_fee: number
          renter_id: string
          return_notes?: string | null
          returned_at?: string | null
          service_fee?: number
          start_date: string
          status?: Database["public"]["Enums"]["rental_status"]
          stripe_payment_intent_id?: string | null
          total_amount: number
          total_days: number
          updated_at?: string
        }
        Update: {
          agreement_accepted?: boolean | null
          agreement_accepted_at?: string | null
          created_at?: string
          deposit_amount?: number
          end_date?: string
          fit_id?: string
          id?: string
          owner_id?: string
          rental_fee?: number
          renter_id?: string
          return_notes?: string | null
          returned_at?: string | null
          service_fee?: number
          start_date?: string
          status?: Database["public"]["Enums"]["rental_status"]
          stripe_payment_intent_id?: string | null
          total_amount?: number
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_fit_id_fkey"
            columns: ["fit_id"]
            isOneToOne: false
            referencedRelation: "fits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          rental_id: string
          review_type: string
          reviewed_fit_id: string | null
          reviewed_user_id: string | null
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          rental_id: string
          review_type: string
          reviewed_fit_id?: string | null
          reviewed_user_id?: string | null
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          rental_id?: string
          review_type?: string
          reviewed_fit_id?: string | null
          reviewed_user_id?: string | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewed_fit_id_fkey"
            columns: ["reviewed_fit_id"]
            isOneToOne: false
            referencedRelation: "fits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewed_user_id_fkey"
            columns: ["reviewed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      app_role: "admin" | "user"
      fit_category:
        | "dresses"
        | "suits"
        | "streetwear"
        | "formal"
        | "casual"
        | "accessories"
        | "shoes"
        | "outerwear"
        | "vintage"
        | "designer"
      fit_size: "XXS" | "XS" | "S" | "M" | "L" | "XL" | "XXL" | "3XL"
      rental_status:
        | "pending"
        | "confirmed"
        | "active"
        | "returned"
        | "cancelled"
        | "disputed"
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
      app_role: ["admin", "user"],
      fit_category: [
        "dresses",
        "suits",
        "streetwear",
        "formal",
        "casual",
        "accessories",
        "shoes",
        "outerwear",
        "vintage",
        "designer",
      ],
      fit_size: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"],
      rental_status: [
        "pending",
        "confirmed",
        "active",
        "returned",
        "cancelled",
        "disputed",
      ],
    },
  },
} as const
