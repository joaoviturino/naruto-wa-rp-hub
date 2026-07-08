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
      audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          meta: Json
          target: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target?: string | null
        }
        Relationships: []
      }
      bot_sessions: {
        Row: {
          id: string
          phone: string | null
          qr: string | null
          status: Database["public"]["Enums"]["bot_status"]
          updated_at: string
        }
        Insert: {
          id?: string
          phone?: string | null
          qr?: string | null
          status?: Database["public"]["Enums"]["bot_status"]
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string | null
          qr?: string | null
          status?: Database["public"]["Enums"]["bot_status"]
          updated_at?: string
        }
        Relationships: []
      }
      character_knowledges: {
        Row: {
          character_id: string
          knowledge_id: string
        }
        Insert: {
          character_id: string
          knowledge_id: string
        }
        Update: {
          character_id?: string
          knowledge_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_knowledges_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_knowledges_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "knowledges"
            referencedColumns: ["id"]
          },
        ]
      }
      character_missions: {
        Row: {
          character_id: string
          completed_at: string
          mission_id: string
        }
        Insert: {
          character_id: string
          completed_at?: string
          mission_id: string
        }
        Update: {
          character_id?: string
          completed_at?: string
          mission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_missions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      character_skills: {
        Row: {
          character_id: string
          learned_at: string
          skill_id: string
        }
        Insert: {
          character_id: string
          learned_at?: string
          skill_id: string
        }
        Update: {
          character_id?: string
          learned_at?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_skills_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          age: number | null
          appearance: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          clan_id: string | null
          clan_rerolls_used: number
          created_at: string
          element_primary: Database["public"]["Enums"]["element"]
          history: string | null
          id: string
          inventory_bg_url: string | null
          nickname: string
          personality: string | null
          phone_e164: string
          proficiencies: Json
          rank: Database["public"]["Enums"]["ninja_rank"]
          updated_at: string
          user_id: string
          village: Database["public"]["Enums"]["village"]
          xp: number
        }
        Insert: {
          age?: number | null
          appearance?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          clan_id?: string | null
          clan_rerolls_used?: number
          created_at?: string
          element_primary: Database["public"]["Enums"]["element"]
          history?: string | null
          id?: string
          inventory_bg_url?: string | null
          nickname: string
          personality?: string | null
          phone_e164: string
          proficiencies?: Json
          rank?: Database["public"]["Enums"]["ninja_rank"]
          updated_at?: string
          user_id: string
          village: Database["public"]["Enums"]["village"]
          xp?: number
        }
        Update: {
          age?: number | null
          appearance?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          clan_id?: string | null
          clan_rerolls_used?: number
          created_at?: string
          element_primary?: Database["public"]["Enums"]["element"]
          history?: string | null
          id?: string
          inventory_bg_url?: string | null
          nickname?: string
          personality?: string | null
          phone_e164?: string
          proficiencies?: Json
          rank?: Database["public"]["Enums"]["ninja_rank"]
          updated_at?: string
          user_id?: string
          village?: Database["public"]["Enums"]["village"]
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "characters_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_skills: {
        Row: {
          clan_id: string
          position: number
          skill_id: string
        }
        Insert: {
          clan_id: string
          position: number
          skill_id: string
        }
        Update: {
          clan_id?: string
          position?: number
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_skills_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          created_at: string
          description: string | null
          element_bonus: Database["public"]["Enums"]["element"] | null
          id: string
          name: string
          rarity: Database["public"]["Enums"]["clan_rarity"]
          village: Database["public"]["Enums"]["village"]
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          element_bonus?: Database["public"]["Enums"]["element"] | null
          id?: string
          name: string
          rarity: Database["public"]["Enums"]["clan_rarity"]
          village: Database["public"]["Enums"]["village"]
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          element_bonus?: Database["public"]["Enums"]["element"] | null
          id?: string
          name?: string
          rarity?: Database["public"]["Enums"]["clan_rarity"]
          village?: Database["public"]["Enums"]["village"]
          weight?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          boots_id: string | null
          character_id: string
          helmet_id: string | null
          ninja_bag: Json
          pants_id: string | null
          primary_unlocked: boolean
          primary_weapon_id: string | null
          secondary_slots: Json
          secondary_unlocked: boolean
          secondary_weapon_id: string | null
          updated_at: string
          vest_id: string | null
        }
        Insert: {
          boots_id?: string | null
          character_id: string
          helmet_id?: string | null
          ninja_bag?: Json
          pants_id?: string | null
          primary_unlocked?: boolean
          primary_weapon_id?: string | null
          secondary_slots?: Json
          secondary_unlocked?: boolean
          secondary_weapon_id?: string | null
          updated_at?: string
          vest_id?: string | null
        }
        Update: {
          boots_id?: string | null
          character_id?: string
          helmet_id?: string | null
          ninja_bag?: Json
          pants_id?: string | null
          primary_unlocked?: boolean
          primary_weapon_id?: string | null
          secondary_slots?: Json
          secondary_unlocked?: boolean
          secondary_weapon_id?: string | null
          updated_at?: string
          vest_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_boots_id_fkey"
            columns: ["boots_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_helmet_id_fkey"
            columns: ["helmet_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_pants_id_fkey"
            columns: ["pants_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_primary_weapon_id_fkey"
            columns: ["primary_weapon_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_secondary_weapon_id_fkey"
            columns: ["secondary_weapon_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_vest_id_fkey"
            columns: ["vest_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          description: string | null
          durability: number | null
          id: string
          image_url: string | null
          meta: Json
          name: string
          rank: Database["public"]["Enums"]["skill_rank"]
          req_mission_id: string | null
          req_proficiency_kind:
            | Database["public"]["Enums"]["proficiency_kind"]
            | null
          req_proficiency_level: number | null
          req_rank: Database["public"]["Enums"]["ninja_rank"] | null
          req_skill_id: string | null
          slot_size: number
          type: Database["public"]["Enums"]["item_type"]
        }
        Insert: {
          description?: string | null
          durability?: number | null
          id?: string
          image_url?: string | null
          meta?: Json
          name: string
          rank?: Database["public"]["Enums"]["skill_rank"]
          req_mission_id?: string | null
          req_proficiency_kind?:
            | Database["public"]["Enums"]["proficiency_kind"]
            | null
          req_proficiency_level?: number | null
          req_rank?: Database["public"]["Enums"]["ninja_rank"] | null
          req_skill_id?: string | null
          slot_size?: number
          type: Database["public"]["Enums"]["item_type"]
        }
        Update: {
          description?: string | null
          durability?: number | null
          id?: string
          image_url?: string | null
          meta?: Json
          name?: string
          rank?: Database["public"]["Enums"]["skill_rank"]
          req_mission_id?: string | null
          req_proficiency_kind?:
            | Database["public"]["Enums"]["proficiency_kind"]
            | null
          req_proficiency_level?: number | null
          req_rank?: Database["public"]["Enums"]["ninja_rank"] | null
          req_skill_id?: string | null
          slot_size?: number
          type?: Database["public"]["Enums"]["item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "items_req_mission_id_fkey"
            columns: ["req_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_req_skill_id_fkey"
            columns: ["req_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledges: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          rank: Database["public"]["Enums"]["ninja_rank"]
          reward_xp: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rank?: Database["public"]["Enums"]["ninja_rank"]
          reward_xp?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rank?: Database["public"]["Enums"]["ninja_rank"]
          reward_xp?: number
        }
        Relationships: []
      }
      outbound_messages: {
        Row: {
          body: string
          created_at: string
          error: string | null
          id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["msg_status"]
          to_phone: string
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["msg_status"]
          to_phone: string
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["msg_status"]
          to_phone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          clan_id: string | null
          classification:
            | Database["public"]["Enums"]["skill_classification"]
            | null
          description: string | null
          element: Database["public"]["Enums"]["element"] | null
          id: string
          image_url: string | null
          name: string
          range: Database["public"]["Enums"]["skill_range"] | null
          rank: Database["public"]["Enums"]["skill_rank"]
          req_mission_id: string | null
          req_prereq_skill_id: string | null
          req_proficiency_kind:
            | Database["public"]["Enums"]["proficiency_kind"]
            | null
          req_proficiency_level: number | null
          req_rank: Database["public"]["Enums"]["ninja_rank"] | null
          skill_class: string | null
          type: string | null
        }
        Insert: {
          clan_id?: string | null
          classification?:
            | Database["public"]["Enums"]["skill_classification"]
            | null
          description?: string | null
          element?: Database["public"]["Enums"]["element"] | null
          id?: string
          image_url?: string | null
          name: string
          range?: Database["public"]["Enums"]["skill_range"] | null
          rank?: Database["public"]["Enums"]["skill_rank"]
          req_mission_id?: string | null
          req_prereq_skill_id?: string | null
          req_proficiency_kind?:
            | Database["public"]["Enums"]["proficiency_kind"]
            | null
          req_proficiency_level?: number | null
          req_rank?: Database["public"]["Enums"]["ninja_rank"] | null
          skill_class?: string | null
          type?: string | null
        }
        Update: {
          clan_id?: string | null
          classification?:
            | Database["public"]["Enums"]["skill_classification"]
            | null
          description?: string | null
          element?: Database["public"]["Enums"]["element"] | null
          id?: string
          image_url?: string | null
          name?: string
          range?: Database["public"]["Enums"]["skill_range"] | null
          rank?: Database["public"]["Enums"]["skill_rank"]
          req_mission_id?: string | null
          req_prereq_skill_id?: string | null
          req_proficiency_kind?:
            | Database["public"]["Enums"]["proficiency_kind"]
            | null
          req_proficiency_level?: number | null
          req_rank?: Database["public"]["Enums"]["ninja_rank"] | null
          skill_class?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skills_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skills_req_mission_id_fkey"
            columns: ["req_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skills_req_prereq_skill_id_fkey"
            columns: ["req_prereq_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "user"
      bot_status: "disconnected" | "qr" | "connecting" | "connected"
      clan_rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
      element: "katon" | "suiton" | "fuuton" | "doton" | "raiton"
      item_type:
        | "consumable"
        | "tool"
        | "armor_helmet"
        | "armor_vest"
        | "armor_pants"
        | "armor_boots"
        | "weapon_primary"
        | "weapon_secondary"
      msg_status: "pending" | "sent" | "failed"
      ninja_rank:
        | "estudante"
        | "genin"
        | "chunin"
        | "tokubetsu_jonin"
        | "jonin"
        | "anbu"
        | "sannin"
        | "kage"
      proficiency_kind:
        | "kenjutsu"
        | "shurikenjutsu"
        | "taijutsu"
        | "ninjutsu"
        | "genjutsu"
        | "fuinjutsu"
        | "iryo"
      skill_classification: "ofensivo" | "defensivo" | "suplementar"
      skill_range: "curto" | "medio" | "longo"
      skill_rank: "E" | "D" | "C" | "B" | "A" | "S"
      village:
        | "konoha"
        | "suna"
        | "kiri"
        | "kumo"
        | "iwa"
        | "ame"
        | "kusa"
        | "taki"
        | "oto"
        | "yuki"
        | "hoshi"
        | "nomad"
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
      bot_status: ["disconnected", "qr", "connecting", "connected"],
      clan_rarity: ["common", "uncommon", "rare", "epic", "legendary"],
      element: ["katon", "suiton", "fuuton", "doton", "raiton"],
      item_type: [
        "consumable",
        "tool",
        "armor_helmet",
        "armor_vest",
        "armor_pants",
        "armor_boots",
        "weapon_primary",
        "weapon_secondary",
      ],
      msg_status: ["pending", "sent", "failed"],
      ninja_rank: [
        "estudante",
        "genin",
        "chunin",
        "tokubetsu_jonin",
        "jonin",
        "anbu",
        "sannin",
        "kage",
      ],
      proficiency_kind: [
        "kenjutsu",
        "shurikenjutsu",
        "taijutsu",
        "ninjutsu",
        "genjutsu",
        "fuinjutsu",
        "iryo",
      ],
      skill_classification: ["ofensivo", "defensivo", "suplementar"],
      skill_range: ["curto", "medio", "longo"],
      skill_rank: ["E", "D", "C", "B", "A", "S"],
      village: [
        "konoha",
        "suna",
        "kiri",
        "kumo",
        "iwa",
        "ame",
        "kusa",
        "taki",
        "oto",
        "yuki",
        "hoshi",
        "nomad",
      ],
    },
  },
} as const
