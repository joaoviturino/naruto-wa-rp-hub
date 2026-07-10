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
      character_npc_rewards: {
        Row: {
          character_id: string
          claimed_at: string
          id: string
          npc_id: string
        }
        Insert: {
          character_id: string
          claimed_at?: string
          id?: string
          npc_id: string
        }
        Update: {
          character_id?: string
          claimed_at?: string
          id?: string
          npc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_npc_rewards_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_npc_rewards_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
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
          chakra_current: number | null
          clan_id: string | null
          clan_rerolls_used: number
          created_at: string
          current_location_id: string | null
          ef_current: number | null
          element_primary: Database["public"]["Enums"]["element"]
          em_current: number | null
          history: string | null
          id: string
          inventory_bg_url: string | null
          last_spawn_roll_at: string | null
          location_entered_at: string | null
          nickname: string
          personality: string | null
          phone_e164: string
          proficiencies: Json
          rank: Database["public"]["Enums"]["ninja_rank"]
          ryo: number
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
          chakra_current?: number | null
          clan_id?: string | null
          clan_rerolls_used?: number
          created_at?: string
          current_location_id?: string | null
          ef_current?: number | null
          element_primary: Database["public"]["Enums"]["element"]
          em_current?: number | null
          history?: string | null
          id?: string
          inventory_bg_url?: string | null
          last_spawn_roll_at?: string | null
          location_entered_at?: string | null
          nickname: string
          personality?: string | null
          phone_e164: string
          proficiencies?: Json
          rank?: Database["public"]["Enums"]["ninja_rank"]
          ryo?: number
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
          chakra_current?: number | null
          clan_id?: string | null
          clan_rerolls_used?: number
          created_at?: string
          current_location_id?: string | null
          ef_current?: number | null
          element_primary?: Database["public"]["Enums"]["element"]
          em_current?: number | null
          history?: string | null
          id?: string
          inventory_bg_url?: string | null
          last_spawn_roll_at?: string | null
          location_entered_at?: string | null
          nickname?: string
          personality?: string | null
          phone_e164?: string
          proficiencies?: Json
          rank?: Database["public"]["Enums"]["ninja_rank"]
          ryo?: number
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
          {
            foreignKeyName: "characters_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
      combat_participants: {
        Row: {
          character_id: string
          session_id: string
        }
        Insert: {
          character_id: string
          session_id: string
        }
        Update: {
          character_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combat_participants_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "combat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          location_id: string
          log: Json
          npc_id: string
          party_id: string | null
          state: Json
          status: string
          turn: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          location_id: string
          log?: Json
          npc_id: string
          party_id?: string | null
          state?: Json
          status?: string
          turn?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          location_id?: string
          log?: Json
          npc_id?: string
          party_id?: string | null
          state?: Json
          status?: string
          turn?: string
        }
        Relationships: [
          {
            foreignKeyName: "combat_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_sessions_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_sessions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
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
          req_class: Database["public"]["Enums"]["skill_class"] | null
          req_maestria: Database["public"]["Enums"]["skill_rank"] | null
          req_mission_id: string | null
          req_nivel: Database["public"]["Enums"]["skill_rank"] | null
          req_rank: Database["public"]["Enums"]["ninja_rank"] | null
          req_skill_id: string | null
          slot_size: number
          stack_limit: number | null
          stackable: boolean
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
          req_class?: Database["public"]["Enums"]["skill_class"] | null
          req_maestria?: Database["public"]["Enums"]["skill_rank"] | null
          req_mission_id?: string | null
          req_nivel?: Database["public"]["Enums"]["skill_rank"] | null
          req_rank?: Database["public"]["Enums"]["ninja_rank"] | null
          req_skill_id?: string | null
          slot_size?: number
          stack_limit?: number | null
          stackable?: boolean
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
          req_class?: Database["public"]["Enums"]["skill_class"] | null
          req_maestria?: Database["public"]["Enums"]["skill_rank"] | null
          req_mission_id?: string | null
          req_nivel?: Database["public"]["Enums"]["skill_rank"] | null
          req_rank?: Database["public"]["Enums"]["ninja_rank"] | null
          req_skill_id?: string | null
          slot_size?: number
          stack_limit?: number | null
          stackable?: boolean
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
      location_connections: {
        Row: {
          a_id: string
          b_id: string
          created_at: string
          id: string
        }
        Insert: {
          a_id: string
          b_id: string
          created_at?: string
          id?: string
        }
        Update: {
          a_id?: string
          b_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_connections_a_id_fkey"
            columns: ["a_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_connections_b_id_fkey"
            columns: ["b_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_messages: {
        Row: {
          character_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          location_id: string
        }
        Insert: {
          character_id: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          location_id: string
        }
        Update: {
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_messages_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_messages_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_minigames: {
        Row: {
          created_at: string
          location_id: string
          minigame_id: string
        }
        Insert: {
          created_at?: string
          location_id: string
          minigame_id: string
        }
        Update: {
          created_at?: string
          location_id?: string
          minigame_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_minigames_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_minigames_minigame_id_fkey"
            columns: ["minigame_id"]
            isOneToOne: false
            referencedRelation: "minigames"
            referencedColumns: ["id"]
          },
        ]
      }
      location_npcs: {
        Row: {
          location_id: string
          npc_id: string
          weight: number
        }
        Insert: {
          location_id: string
          npc_id: string
          weight?: number
        }
        Update: {
          location_id?: string
          npc_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_npcs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_npcs_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_danger_zone: boolean
          name: string
          spawn_chance: number
          spawn_tick_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_danger_zone?: boolean
          name: string
          spawn_chance?: number
          spawn_tick_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_danger_zone?: boolean
          name?: string
          spawn_chance?: number
          spawn_tick_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      minigame_runs: {
        Row: {
          character_id: string
          completed_at: string
          id: string
          location_id: string | null
          minigame_id: string
          rewards_applied: Json
          score: number
          success: boolean
        }
        Insert: {
          character_id: string
          completed_at?: string
          id?: string
          location_id?: string | null
          minigame_id: string
          rewards_applied?: Json
          score?: number
          success?: boolean
        }
        Update: {
          character_id?: string
          completed_at?: string
          id?: string
          location_id?: string | null
          minigame_id?: string
          rewards_applied?: Json
          score?: number
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "minigame_runs_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minigame_runs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minigame_runs_minigame_id_fkey"
            columns: ["minigame_id"]
            isOneToOne: false
            referencedRelation: "minigames"
            referencedColumns: ["id"]
          },
        ]
      }
      minigames: {
        Row: {
          active: boolean
          background_url: string | null
          config: Json
          cooldown_hours: number
          created_at: string
          description: string | null
          dialog_intro: string | null
          dialog_outro: string | null
          id: string
          kind: Database["public"]["Enums"]["minigame_kind"]
          name: string
          npc_name: string | null
          npc_portrait_url: string | null
          rewards: Json
          slug: string
          tileset_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          background_url?: string | null
          config?: Json
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          dialog_intro?: string | null
          dialog_outro?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["minigame_kind"]
          name: string
          npc_name?: string | null
          npc_portrait_url?: string | null
          rewards?: Json
          slug: string
          tileset_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          background_url?: string | null
          config?: Json
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          dialog_intro?: string | null
          dialog_outro?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["minigame_kind"]
          name?: string
          npc_name?: string | null
          npc_portrait_url?: string | null
          rewards?: Json
          slug?: string
          tileset_url?: string | null
          updated_at?: string
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
      npc_skills: {
        Row: {
          npc_id: string
          skill_id: string
        }
        Insert: {
          npc_id: string
          skill_id: string
        }
        Update: {
          npc_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "npc_skills_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      npcs: {
        Row: {
          battle_bg_url: string | null
          created_at: string
          description: string | null
          dialog_intro: string | null
          dialog_outro: string | null
          drop_table: Json
          energy_max: number
          hp_max: number
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["npc_kind"]
          name: string
          required_mission_id: string | null
          reward_cooldown_hours: number
          reward_items: Json
          reward_ryo: number
          reward_xp: number
          shop_items: Json
          updated_at: string
          xp: number
        }
        Insert: {
          battle_bg_url?: string | null
          created_at?: string
          description?: string | null
          dialog_intro?: string | null
          dialog_outro?: string | null
          drop_table?: Json
          energy_max?: number
          hp_max?: number
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["npc_kind"]
          name: string
          required_mission_id?: string | null
          reward_cooldown_hours?: number
          reward_items?: Json
          reward_ryo?: number
          reward_xp?: number
          shop_items?: Json
          updated_at?: string
          xp?: number
        }
        Update: {
          battle_bg_url?: string | null
          created_at?: string
          description?: string | null
          dialog_intro?: string | null
          dialog_outro?: string | null
          drop_table?: Json
          energy_max?: number
          hp_max?: number
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["npc_kind"]
          name?: string
          required_mission_id?: string | null
          reward_cooldown_hours?: number
          reward_items?: Json
          reward_ryo?: number
          reward_xp?: number
          shop_items?: Json
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "npcs_required_mission_id_fkey"
            columns: ["required_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
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
      parties: {
        Row: {
          created_at: string
          id: string
          leader_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      party_invites: {
        Row: {
          created_at: string
          from_character_id: string
          id: string
          party_id: string
          status: string
          to_character_id: string
        }
        Insert: {
          created_at?: string
          from_character_id: string
          id?: string
          party_id: string
          status?: string
          to_character_id: string
        }
        Update: {
          created_at?: string
          from_character_id?: string
          id?: string
          party_id?: string
          status?: string
          to_character_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_invites_from_character_id_fkey"
            columns: ["from_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_invites_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_invites_to_character_id_fkey"
            columns: ["to_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      party_members: {
        Row: {
          character_id: string
          joined_at: string
          party_id: string
        }
        Insert: {
          character_id: string
          joined_at?: string
          party_id: string
        }
        Update: {
          character_id?: string
          joined_at?: string
          party_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_members_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
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
      scene_images: {
        Row: {
          character_id: string
          created_at: string
          id: string
          image_url: string
          label: string | null
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          image_url: string
          label?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          image_url?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scene_images_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          animation_url: string | null
          base_cost: number
          bonus_critical: number
          bonus_energetic: number
          bonus_speed: number
          clan_id: string | null
          classification:
            | Database["public"]["Enums"]["skill_classification"]
            | null
          cooldown_turns: number
          description: string | null
          element: Database["public"]["Enums"]["element"] | null
          energy_type: string
          id: string
          image_url: string | null
          meta: Json
          name: string
          range: Database["public"]["Enums"]["skill_range"] | null
          rank: Database["public"]["Enums"]["skill_rank"]
          req_class: Database["public"]["Enums"]["skill_class"] | null
          req_maestria: Database["public"]["Enums"]["skill_rank"] | null
          req_mission_id: string | null
          req_nivel: Database["public"]["Enums"]["skill_rank"] | null
          req_prereq_skill_id: string | null
          req_rank: Database["public"]["Enums"]["ninja_rank"] | null
          skill_class: string | null
          sound_url: string | null
          type: string | null
        }
        Insert: {
          animation_url?: string | null
          base_cost?: number
          bonus_critical?: number
          bonus_energetic?: number
          bonus_speed?: number
          clan_id?: string | null
          classification?:
            | Database["public"]["Enums"]["skill_classification"]
            | null
          cooldown_turns?: number
          description?: string | null
          element?: Database["public"]["Enums"]["element"] | null
          energy_type?: string
          id?: string
          image_url?: string | null
          meta?: Json
          name: string
          range?: Database["public"]["Enums"]["skill_range"] | null
          rank?: Database["public"]["Enums"]["skill_rank"]
          req_class?: Database["public"]["Enums"]["skill_class"] | null
          req_maestria?: Database["public"]["Enums"]["skill_rank"] | null
          req_mission_id?: string | null
          req_nivel?: Database["public"]["Enums"]["skill_rank"] | null
          req_prereq_skill_id?: string | null
          req_rank?: Database["public"]["Enums"]["ninja_rank"] | null
          skill_class?: string | null
          sound_url?: string | null
          type?: string | null
        }
        Update: {
          animation_url?: string | null
          base_cost?: number
          bonus_critical?: number
          bonus_energetic?: number
          bonus_speed?: number
          clan_id?: string | null
          classification?:
            | Database["public"]["Enums"]["skill_classification"]
            | null
          cooldown_turns?: number
          description?: string | null
          element?: Database["public"]["Enums"]["element"] | null
          energy_type?: string
          id?: string
          image_url?: string | null
          meta?: Json
          name?: string
          range?: Database["public"]["Enums"]["skill_range"] | null
          rank?: Database["public"]["Enums"]["skill_rank"]
          req_class?: Database["public"]["Enums"]["skill_class"] | null
          req_maestria?: Database["public"]["Enums"]["skill_rank"] | null
          req_mission_id?: string | null
          req_nivel?: Database["public"]["Enums"]["skill_rank"] | null
          req_prereq_skill_id?: string | null
          req_rank?: Database["public"]["Enums"]["ninja_rank"] | null
          skill_class?: string | null
          sound_url?: string | null
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
      user_at_location: { Args: { _loc: string }; Returns: boolean }
      user_in_party: {
        Args: { _party: string; _user: string }
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
      minigame_kind: "cleanup"
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
      npc_kind: "aggressive" | "shop" | "reward"
      proficiency_kind:
        | "kenjutsu"
        | "shurikenjutsu"
        | "taijutsu"
        | "ninjutsu"
        | "genjutsu"
        | "fuinjutsu"
        | "iryo"
      skill_class:
        | "genjutsu"
        | "ninjutsu"
        | "taijutsu"
        | "shinjutsu"
        | "armadilha"
        | "boujutsu"
        | "bukijutsu"
        | "bunshinjutsu"
        | "doujutsu"
        | "fluxo_de_chakra"
        | "formacao"
        | "estilo_de_luta"
        | "fuuinjutsu"
        | "gijutsu"
        | "hiden"
        | "juinjutsu"
        | "jujutsu"
        | "jutsu_basico"
        | "kaijutsu"
        | "kekkaijutsu"
        | "kekkei_genkai"
        | "kekkei_moura"
        | "kekkei_touta"
        | "kenjutsu"
        | "kinjutsu"
        | "kinkojutsu"
        | "konbijutsu"
        | "kugutsujutsu"
        | "kyuuinjutsu"
        | "ninjutsu_espaco_tempo"
        | "ninjutsu_medico"
        | "nintaijutsu"
        | "saiseijutsu"
        | "senjutsu"
        | "shurikenjutsu"
        | "tansakujutsu"
        | "tenseijutsu"
        | "tonjutsu"
        | "yuugoujutsu"
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
      minigame_kind: ["cleanup"],
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
      npc_kind: ["aggressive", "shop", "reward"],
      proficiency_kind: [
        "kenjutsu",
        "shurikenjutsu",
        "taijutsu",
        "ninjutsu",
        "genjutsu",
        "fuinjutsu",
        "iryo",
      ],
      skill_class: [
        "genjutsu",
        "ninjutsu",
        "taijutsu",
        "shinjutsu",
        "armadilha",
        "boujutsu",
        "bukijutsu",
        "bunshinjutsu",
        "doujutsu",
        "fluxo_de_chakra",
        "formacao",
        "estilo_de_luta",
        "fuuinjutsu",
        "gijutsu",
        "hiden",
        "juinjutsu",
        "jujutsu",
        "jutsu_basico",
        "kaijutsu",
        "kekkaijutsu",
        "kekkei_genkai",
        "kekkei_moura",
        "kekkei_touta",
        "kenjutsu",
        "kinjutsu",
        "kinkojutsu",
        "konbijutsu",
        "kugutsujutsu",
        "kyuuinjutsu",
        "ninjutsu_espaco_tempo",
        "ninjutsu_medico",
        "nintaijutsu",
        "saiseijutsu",
        "senjutsu",
        "shurikenjutsu",
        "tansakujutsu",
        "tenseijutsu",
        "tonjutsu",
        "yuugoujutsu",
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
