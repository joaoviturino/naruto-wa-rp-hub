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
      admin_todos: {
        Row: {
          assignee: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          status: string
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assignee?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          assignee?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: []
      }
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
      bot_auth_state: {
        Row: {
          key: string
          session_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          session_id?: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          session_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      bot_sessions: {
        Row: {
          id: string
          last_seen_at: string | null
          phone: string | null
          qr: string | null
          status: Database["public"]["Enums"]["bot_status"]
          updated_at: string
        }
        Insert: {
          id?: string
          last_seen_at?: string | null
          phone?: string | null
          qr?: string | null
          status?: Database["public"]["Enums"]["bot_status"]
          updated_at?: string
        }
        Update: {
          id?: string
          last_seen_at?: string | null
          phone?: string | null
          qr?: string | null
          status?: Database["public"]["Enums"]["bot_status"]
          updated_at?: string
        }
        Relationships: []
      }
      character_book_reads: {
        Row: {
          book_id: string
          character_id: string
          completed_at: string
          id: string
          rewards_applied: Json
        }
        Insert: {
          book_id: string
          character_id: string
          completed_at?: string
          id?: string
          rewards_applied?: Json
        }
        Update: {
          book_id?: string
          character_id?: string
          completed_at?: string
          id?: string
          rewards_applied?: Json
        }
        Relationships: [
          {
            foreignKeyName: "character_book_reads_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_book_reads_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_clan_progress: {
        Row: {
          character_id: string
          node_id: string
          unlocked_at: string
        }
        Insert: {
          character_id: string
          node_id: string
          unlocked_at?: string
        }
        Update: {
          character_id?: string
          node_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_clan_progress_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_clan_progress_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "clan_tree_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      character_jobs: {
        Row: {
          character_id: string
          created_at: string
          hired_at: string
          id: string
          job_id: string
          last_activity_at: string
          last_paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          hired_at?: string
          id?: string
          job_id: string
          last_activity_at?: string
          last_paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          hired_at?: string
          id?: string
          job_id?: string
          last_activity_at?: string
          last_paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_jobs_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
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
          claimed_at: string | null
          completed_at: string
          mission_id: string
          progress: Json
          started_at: string
          status: string
        }
        Insert: {
          character_id: string
          claimed_at?: string | null
          completed_at?: string
          mission_id: string
          progress?: Json
          started_at?: string
          status?: string
        }
        Update: {
          character_id?: string
          claimed_at?: string | null
          completed_at?: string
          mission_id?: string
          progress?: Json
          started_at?: string
          status?: string
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
      character_mounts: {
        Row: {
          acquired_at: string
          character_id: string
          id: string
          mount_id: string
          pose_id: string | null
          pose_offset_x: number
          pose_offset_y: number
          pose_scale: number
        }
        Insert: {
          acquired_at?: string
          character_id: string
          id?: string
          mount_id: string
          pose_id?: string | null
          pose_offset_x?: number
          pose_offset_y?: number
          pose_scale?: number
        }
        Update: {
          acquired_at?: string
          character_id?: string
          id?: string
          mount_id?: string
          pose_id?: string | null
          pose_offset_x?: number
          pose_offset_y?: number
          pose_scale?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_mounts_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_mounts_mount_id_fkey"
            columns: ["mount_id"]
            isOneToOne: false
            referencedRelation: "mounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_mounts_pose_id_fkey"
            columns: ["pose_id"]
            isOneToOne: false
            referencedRelation: "character_poses"
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
      character_poses: {
        Row: {
          character_id: string
          created_at: string
          id: string
          image_url: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          image_url: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_poses_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_presence: {
        Row: {
          character_id: string
          current_location_id: string | null
          last_seen: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          current_location_id?: string | null
          last_seen?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          current_location_id?: string | null
          last_seen?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_presence_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_presence_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      character_skill_poses: {
        Row: {
          character_id: string
          created_at: string
          pose_id: string
          skill_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          pose_id: string
          skill_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          pose_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_skill_poses_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_skill_poses_pose_id_fkey"
            columns: ["pose_id"]
            isOneToOne: false
            referencedRelation: "character_poses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_skill_poses_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
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
          archetype: string | null
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
          eyes_frame_url: string | null
          flaws: string[]
          history: string | null
          hp_current: number | null
          id: string
          inventory_bg_url: string | null
          last_spawn_roll_at: string | null
          location_entered_at: string | null
          nickname: string
          personality: string | null
          phone_e164: string
          proficiencies: Json
          qualities: string[]
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
          archetype?: string | null
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
          eyes_frame_url?: string | null
          flaws?: string[]
          history?: string | null
          hp_current?: number | null
          id?: string
          inventory_bg_url?: string | null
          last_spawn_roll_at?: string | null
          location_entered_at?: string | null
          nickname: string
          personality?: string | null
          phone_e164: string
          proficiencies?: Json
          qualities?: string[]
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
          archetype?: string | null
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
          eyes_frame_url?: string | null
          flaws?: string[]
          history?: string | null
          hp_current?: number | null
          id?: string
          inventory_bg_url?: string | null
          last_spawn_roll_at?: string | null
          location_entered_at?: string | null
          nickname?: string
          personality?: string | null
          phone_e164?: string
          proficiencies?: Json
          qualities?: string[]
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
      chest_permissions: {
        Row: {
          character_id: string
          chest_id: string
          created_at: string
          id: string
          is_owner: boolean
        }
        Insert: {
          character_id: string
          chest_id: string
          created_at?: string
          id?: string
          is_owner?: boolean
        }
        Update: {
          character_id?: string
          chest_id?: string
          created_at?: string
          id?: string
          is_owner?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chest_permissions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chest_permissions_chest_id_fkey"
            columns: ["chest_id"]
            isOneToOne: false
            referencedRelation: "npc_chests"
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
      clan_tree_edges: {
        Row: {
          clan_id: string
          created_at: string
          from_node_id: string
          id: string
          to_node_id: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          from_node_id: string
          id?: string
          to_node_id: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          from_node_id?: string
          id?: string
          to_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_tree_edges_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_tree_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "clan_tree_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_tree_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "clan_tree_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_tree_nodes: {
        Row: {
          buff_icon_url: string | null
          buff_label: string | null
          buff_type: Database["public"]["Enums"]["clan_buff_type"] | null
          buff_value: number | null
          clan_id: string
          created_at: string
          id: string
          kind: string
          min_prereqs: number | null
          rank_required: string | null
          skill_id: string | null
          x: number
          xp_required: number | null
          y: number
        }
        Insert: {
          buff_icon_url?: string | null
          buff_label?: string | null
          buff_type?: Database["public"]["Enums"]["clan_buff_type"] | null
          buff_value?: number | null
          clan_id: string
          created_at?: string
          id?: string
          kind: string
          min_prereqs?: number | null
          rank_required?: string | null
          skill_id?: string | null
          x?: number
          xp_required?: number | null
          y?: number
        }
        Update: {
          buff_icon_url?: string | null
          buff_label?: string | null
          buff_type?: Database["public"]["Enums"]["clan_buff_type"] | null
          buff_value?: number | null
          clan_id?: string
          created_at?: string
          id?: string
          kind?: string
          min_prereqs?: number | null
          rank_required?: string | null
          skill_id?: string | null
          x?: number
          xp_required?: number | null
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "clan_tree_nodes_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_tree_nodes_skill_id_fkey"
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
          mode: string
          npc_id: string | null
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
          mode?: string
          npc_id?: string | null
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
          mode?: string
          npc_id?: string | null
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
      global_broadcasts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          message: string
          variant: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          message: string
          variant?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          variant?: string
        }
        Relationships: []
      }
      global_reward_claims: {
        Row: {
          character_id: string
          claimed_at: string
          reward_id: string
          seen: boolean
        }
        Insert: {
          character_id: string
          claimed_at?: string
          reward_id: string
          seen?: boolean
        }
        Update: {
          character_id?: string
          claimed_at?: string
          reward_id?: string
          seen?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "global_reward_claims_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_reward_claims_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "global_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      global_rewards: {
        Row: {
          active: boolean
          amount: number | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          item_id: string | null
          kind: string
          note: string | null
          requirements: Json
          skill_id: string | null
          starts_at: string | null
        }
        Insert: {
          active?: boolean
          amount?: number | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          item_id?: string | null
          kind: string
          note?: string | null
          requirements?: Json
          skill_id?: string | null
          starts_at?: string | null
        }
        Update: {
          active?: boolean
          amount?: number | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          item_id?: string | null
          kind?: string
          note?: string | null
          requirements?: Json
          skill_id?: string | null
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_rewards_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_rewards_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
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
          primary_weapon_durability: number | null
          primary_weapon_id: string | null
          secondary_slots: Json
          secondary_unlocked: boolean
          secondary_weapon_durability: number | null
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
          primary_weapon_durability?: number | null
          primary_weapon_id?: string | null
          secondary_slots?: Json
          secondary_unlocked?: boolean
          secondary_weapon_durability?: number | null
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
          primary_weapon_durability?: number | null
          primary_weapon_id?: string | null
          secondary_slots?: Json
          secondary_unlocked?: boolean
          secondary_weapon_durability?: number | null
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
      jobs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          fire_after_days: number
          id: string
          image_url: string | null
          name: string
          salary_interval_hours: number
          salary_ryo: number
          salary_xp: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          fire_after_days?: number
          id?: string
          image_url?: string | null
          name: string
          salary_interval_hours?: number
          salary_ryo?: number
          salary_xp?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          fire_after_days?: number
          id?: string
          image_url?: string | null
          name?: string
          salary_interval_hours?: number
          salary_ryo?: number
          salary_xp?: number
          updated_at?: string
        }
        Relationships: []
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
      level_config: {
        Row: {
          base_xp: number
          created_at: string
          growth_factor: number
          id: boolean
          max_level: number
          updated_at: string
        }
        Insert: {
          base_xp?: number
          created_at?: string
          growth_factor?: number
          id?: boolean
          max_level?: number
          updated_at?: string
        }
        Update: {
          base_xp?: number
          created_at?: string
          growth_factor?: number
          id?: boolean
          max_level?: number
          updated_at?: string
        }
        Relationships: []
      }
      library_books: {
        Row: {
          active: boolean
          author: string | null
          blocks: Json
          content: string
          cover_url: string | null
          created_at: string
          id: string
          min_read_seconds: number
          proficiency_grants: Json
          required_level: number
          required_profs: Json
          required_rank: string | null
          rewards: Json
          section_id: string | null
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          author?: string | null
          blocks?: Json
          content?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          min_read_seconds?: number
          proficiency_grants?: Json
          required_level?: number
          required_profs?: Json
          required_rank?: string | null
          rewards?: Json
          section_id?: string | null
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          author?: string | null
          blocks?: Json
          content?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          min_read_seconds?: number
          proficiency_grants?: Json
          required_level?: number
          required_profs?: Json
          required_rank?: string | null
          rewards?: Json
          section_id?: string | null
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_books_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "library_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      library_sections: {
        Row: {
          active: boolean
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
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
      location_libraries: {
        Row: {
          created_at: string
          location_id: string
          section_id: string
        }
        Insert: {
          created_at?: string
          location_id: string
          section_id: string
        }
        Update: {
          created_at?: string
          location_id?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_libraries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_libraries_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "library_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      location_messages: {
        Row: {
          character_id: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean
          location_id: string
          npc_id: string | null
        }
        Insert: {
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          location_id: string
          npc_id?: string | null
        }
        Update: {
          character_id?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          location_id?: string
          npc_id?: string | null
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
          {
            foreignKeyName: "location_messages_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
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
          battle_bg_url: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_danger_zone: boolean
          map_x: number
          map_y: number
          music_url: string | null
          name: string
          parent_id: string | null
          spawn_chance: number
          spawn_group_ids: string[]
          spawn_tick_seconds: number
          updated_at: string
        }
        Insert: {
          battle_bg_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_danger_zone?: boolean
          map_x?: number
          map_y?: number
          music_url?: string | null
          name: string
          parent_id?: string | null
          spawn_chance?: number
          spawn_group_ids?: string[]
          spawn_tick_seconds?: number
          updated_at?: string
        }
        Update: {
          battle_bg_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_danger_zone?: boolean
          map_x?: number
          map_y?: number
          music_url?: string | null
          name?: string
          parent_id?: string | null
          spawn_chance?: number
          spawn_group_ids?: string[]
          spawn_tick_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      minigame_runs: {
        Row: {
          character_id: string
          completed_at: string | null
          context: Json
          id: string
          location_id: string | null
          minigame_id: string
          rewards_applied: Json
          score: number
          success: boolean
        }
        Insert: {
          character_id: string
          completed_at?: string | null
          context?: Json
          id?: string
          location_id?: string | null
          minigame_id: string
          rewards_applied?: Json
          score?: number
          success?: boolean
        }
        Update: {
          character_id?: string
          completed_at?: string | null
          context?: Json
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
          job_required: boolean
          kind: Database["public"]["Enums"]["minigame_kind"]
          name: string
          npc_name: string | null
          npc_portrait_url: string | null
          one_time: boolean
          required_job_id: string | null
          required_profs: Json
          required_rank: string | null
          reward_skills: Json
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
          job_required?: boolean
          kind?: Database["public"]["Enums"]["minigame_kind"]
          name: string
          npc_name?: string | null
          npc_portrait_url?: string | null
          one_time?: boolean
          required_job_id?: string | null
          required_profs?: Json
          required_rank?: string | null
          reward_skills?: Json
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
          job_required?: boolean
          kind?: Database["public"]["Enums"]["minigame_kind"]
          name?: string
          npc_name?: string | null
          npc_portrait_url?: string | null
          one_time?: boolean
          required_job_id?: string | null
          required_profs?: Json
          required_rank?: string | null
          reward_skills?: Json
          rewards?: Json
          slug?: string
          tileset_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "minigames_required_job_id_fkey"
            columns: ["required_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          active: boolean
          category: string
          cooldown_hours: number
          created_at: string
          description: string | null
          id: string
          name: string
          objectives: Json
          rank: Database["public"]["Enums"]["ninja_rank"]
          repeatable: boolean
          requirements: Json
          reward_ryo: number
          reward_xp: number
          rewards: Json
        }
        Insert: {
          active?: boolean
          category?: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          objectives?: Json
          rank?: Database["public"]["Enums"]["ninja_rank"]
          repeatable?: boolean
          requirements?: Json
          reward_ryo?: number
          reward_xp?: number
          rewards?: Json
        }
        Update: {
          active?: boolean
          category?: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          objectives?: Json
          rank?: Database["public"]["Enums"]["ninja_rank"]
          repeatable?: boolean
          requirements?: Json
          reward_ryo?: number
          reward_xp?: number
          rewards?: Json
        }
        Relationships: []
      }
      mounts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          rank: string | null
          speed_multiplier: number
          travel_gif_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          rank?: string | null
          speed_multiplier?: number
          travel_gif_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          rank?: string | null
          speed_multiplier?: number
          travel_gif_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      npc_ai_response_locks: {
        Row: {
          created_at: string
          npc_id: string
          trigger_message_id: string
        }
        Insert: {
          created_at?: string
          npc_id: string
          trigger_message_id: string
        }
        Update: {
          created_at?: string
          npc_id?: string
          trigger_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "npc_ai_response_locks_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_ai_response_locks_trigger_message_id_fkey"
            columns: ["trigger_message_id"]
            isOneToOne: false
            referencedRelation: "location_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_chests: {
        Row: {
          capacity: number
          contents: Json
          created_at: string
          id: string
          npc_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          contents?: Json
          created_at?: string
          id?: string
          npc_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          contents?: Json
          created_at?: string
          id?: string
          npc_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npc_chests_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: true
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_group_members: {
        Row: {
          group_id: string
          npc_id: string
          weight: number
        }
        Insert: {
          group_id: string
          npc_id: string
          weight?: number
        }
        Update: {
          group_id?: string
          npc_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "npc_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "npc_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_group_members_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_groups: {
        Row: {
          battle_bg_url: string | null
          created_at: string
          description: string | null
          id: string
          music_url: string | null
          name: string
        }
        Insert: {
          battle_bg_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          music_url?: string | null
          name: string
        }
        Update: {
          battle_bg_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          music_url?: string | null
          name?: string
        }
        Relationships: []
      }
      npc_learning_steps: {
        Row: {
          created_at: string
          id: string
          minigame_id: string
          npc_id: string
          position: number
          required_profs: Json
          required_rank: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          minigame_id: string
          npc_id: string
          position?: number
          required_profs?: Json
          required_rank?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          minigame_id?: string
          npc_id?: string
          position?: number
          required_profs?: Json
          required_rank?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "npc_learning_steps_minigame_id_fkey"
            columns: ["minigame_id"]
            isOneToOne: false
            referencedRelation: "minigames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_learning_steps_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_poses: {
        Row: {
          created_at: string
          id: string
          image_url: string
          name: string
          npc_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          name: string
          npc_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          npc_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npc_poses_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_private_messages: {
        Row: {
          character_id: string
          content: string
          created_at: string
          id: string
          npc_id: string
          role: string
        }
        Insert: {
          character_id: string
          content: string
          created_at?: string
          id?: string
          npc_id: string
          role: string
        }
        Update: {
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          npc_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "npc_private_messages_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_private_messages_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_skill_poses: {
        Row: {
          created_at: string
          npc_id: string
          pose_id: string
          skill_id: string
        }
        Insert: {
          created_at?: string
          npc_id: string
          pose_id: string
          skill_id: string
        }
        Update: {
          created_at?: string
          npc_id?: string
          pose_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "npc_skill_poses_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_skill_poses_pose_id_fkey"
            columns: ["pose_id"]
            isOneToOne: false
            referencedRelation: "npc_poses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_skill_poses_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
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
          ai_background: string | null
          ai_enabled: boolean
          ai_extra: string | null
          ai_goals: string | null
          ai_knowledge: string | null
          ai_mode: string
          ai_personality: string | null
          ai_tone: string | null
          avg_damage: number
          battle_bg_url: string | null
          buy_items: Json
          created_at: string
          crit_chance: number
          crit_multiplier: number
          defense: number
          description: string | null
          dialog_intro: string | null
          dialog_outro: string | null
          drop_table: Json
          energy_max: number
          hp_max: number
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["npc_kind"]
          learning_min_read_seconds: number
          linked_minigame_id: string | null
          max_hit_percent: number
          music_url: string | null
          name: string
          offer_mission_id: string | null
          offered_job_id: string | null
          required_mission_id: string | null
          reward_cooldown_hours: number
          reward_items: Json
          reward_ryo: number
          reward_xp: number
          shop_items: Json
          tutorial_blocks: Json
          updated_at: string
          xp: number
        }
        Insert: {
          ai_background?: string | null
          ai_enabled?: boolean
          ai_extra?: string | null
          ai_goals?: string | null
          ai_knowledge?: string | null
          ai_mode?: string
          ai_personality?: string | null
          ai_tone?: string | null
          avg_damage?: number
          battle_bg_url?: string | null
          buy_items?: Json
          created_at?: string
          crit_chance?: number
          crit_multiplier?: number
          defense?: number
          description?: string | null
          dialog_intro?: string | null
          dialog_outro?: string | null
          drop_table?: Json
          energy_max?: number
          hp_max?: number
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["npc_kind"]
          learning_min_read_seconds?: number
          linked_minigame_id?: string | null
          max_hit_percent?: number
          music_url?: string | null
          name: string
          offer_mission_id?: string | null
          offered_job_id?: string | null
          required_mission_id?: string | null
          reward_cooldown_hours?: number
          reward_items?: Json
          reward_ryo?: number
          reward_xp?: number
          shop_items?: Json
          tutorial_blocks?: Json
          updated_at?: string
          xp?: number
        }
        Update: {
          ai_background?: string | null
          ai_enabled?: boolean
          ai_extra?: string | null
          ai_goals?: string | null
          ai_knowledge?: string | null
          ai_mode?: string
          ai_personality?: string | null
          ai_tone?: string | null
          avg_damage?: number
          battle_bg_url?: string | null
          buy_items?: Json
          created_at?: string
          crit_chance?: number
          crit_multiplier?: number
          defense?: number
          description?: string | null
          dialog_intro?: string | null
          dialog_outro?: string | null
          drop_table?: Json
          energy_max?: number
          hp_max?: number
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["npc_kind"]
          learning_min_read_seconds?: number
          linked_minigame_id?: string | null
          max_hit_percent?: number
          music_url?: string | null
          name?: string
          offer_mission_id?: string | null
          offered_job_id?: string | null
          required_mission_id?: string | null
          reward_cooldown_hours?: number
          reward_items?: Json
          reward_ryo?: number
          reward_xp?: number
          shop_items?: Json
          tutorial_blocks?: Json
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "npcs_linked_minigame_id_fkey"
            columns: ["linked_minigame_id"]
            isOneToOne: false
            referencedRelation: "minigames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npcs_offer_mission_id_fkey"
            columns: ["offer_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npcs_offered_job_id_fkey"
            columns: ["offered_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
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
      proficiencies: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          is_element: boolean
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          is_element?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          is_element?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
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
      pvp_duels: {
        Row: {
          challenger_id: string
          combat_session_id: string | null
          created_at: string
          current_turn_character_id: string | null
          ended_at: string | null
          forfeit_by: string | null
          id: string
          location_id: string | null
          opponent_id: string
          started_at: string | null
          state: Json
          status: Database["public"]["Enums"]["pvp_status"]
          turn_number: number
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          challenger_id: string
          combat_session_id?: string | null
          created_at?: string
          current_turn_character_id?: string | null
          ended_at?: string | null
          forfeit_by?: string | null
          id?: string
          location_id?: string | null
          opponent_id: string
          started_at?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["pvp_status"]
          turn_number?: number
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string
          combat_session_id?: string | null
          created_at?: string
          current_turn_character_id?: string | null
          ended_at?: string | null
          forfeit_by?: string | null
          id?: string
          location_id?: string | null
          opponent_id?: string
          started_at?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["pvp_status"]
          turn_number?: number
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pvp_duels_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_duels_combat_session_id_fkey"
            columns: ["combat_session_id"]
            isOneToOne: false
            referencedRelation: "combat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_duels_current_turn_character_id_fkey"
            columns: ["current_turn_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_duels_forfeit_by_fkey"
            columns: ["forfeit_by"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_duels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_duels_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_duels_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      pvp_turns: {
        Row: {
          action: Database["public"]["Enums"]["pvp_action"]
          actor_character_id: string
          category: Database["public"]["Enums"]["pvp_category"] | null
          created_at: string
          crit: boolean
          damage: number
          duel_id: string
          effects: Json
          energy_invested_pct: number | null
          id: string
          item_id: string | null
          narrative: string
          skill_id: string | null
          target_character_id: string | null
          turn_number: number
        }
        Insert: {
          action: Database["public"]["Enums"]["pvp_action"]
          actor_character_id: string
          category?: Database["public"]["Enums"]["pvp_category"] | null
          created_at?: string
          crit?: boolean
          damage?: number
          duel_id: string
          effects?: Json
          energy_invested_pct?: number | null
          id?: string
          item_id?: string | null
          narrative: string
          skill_id?: string | null
          target_character_id?: string | null
          turn_number: number
        }
        Update: {
          action?: Database["public"]["Enums"]["pvp_action"]
          actor_character_id?: string
          category?: Database["public"]["Enums"]["pvp_category"] | null
          created_at?: string
          crit?: boolean
          damage?: number
          duel_id?: string
          effects?: Json
          energy_invested_pct?: number | null
          id?: string
          item_id?: string | null
          narrative?: string
          skill_id?: string | null
          target_character_id?: string | null
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "pvp_turns_actor_character_id_fkey"
            columns: ["actor_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_turns_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "pvp_duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_turns_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_turns_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_turns_target_character_id_fkey"
            columns: ["target_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
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
      server_config: {
        Row: {
          actions_hotkey_enabled: boolean
          chat_locked: boolean
          id: string
          initial_spawn_location_id: string | null
          maintenance_enabled: boolean
          maintenance_eta: string | null
          maintenance_image_url: string | null
          maintenance_message: string
          maintenance_title: string
          starter_kit: Json
          trade_tax_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actions_hotkey_enabled?: boolean
          chat_locked?: boolean
          id?: string
          initial_spawn_location_id?: string | null
          maintenance_enabled?: boolean
          maintenance_eta?: string | null
          maintenance_image_url?: string | null
          maintenance_message?: string
          maintenance_title?: string
          starter_kit?: Json
          trade_tax_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actions_hotkey_enabled?: boolean
          chat_locked?: boolean
          id?: string
          initial_spawn_location_id?: string | null
          maintenance_enabled?: boolean
          maintenance_eta?: string | null
          maintenance_image_url?: string | null
          maintenance_message?: string
          maintenance_title?: string
          starter_kit?: Json
          trade_tax_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_config_initial_spawn_location_id_fkey"
            columns: ["initial_spawn_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          accuracy: number
          animation_mode: string
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
          cost_percent: number
          defense_percent: number
          description: string | null
          element: Database["public"]["Enums"]["element"] | null
          energy_type: string
          id: string
          image_url: string | null
          is_defensive: boolean
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
          required_item_id: string | null
          skill_class: string | null
          sound_url: string | null
          type: string | null
        }
        Insert: {
          accuracy?: number
          animation_mode?: string
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
          cost_percent?: number
          defense_percent?: number
          description?: string | null
          element?: Database["public"]["Enums"]["element"] | null
          energy_type?: string
          id?: string
          image_url?: string | null
          is_defensive?: boolean
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
          required_item_id?: string | null
          skill_class?: string | null
          sound_url?: string | null
          type?: string | null
        }
        Update: {
          accuracy?: number
          animation_mode?: string
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
          cost_percent?: number
          defense_percent?: number
          description?: string | null
          element?: Database["public"]["Enums"]["element"] | null
          energy_type?: string
          id?: string
          image_url?: string | null
          is_defensive?: boolean
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
          required_item_id?: string | null
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
          {
            foreignKeyName: "skills_required_item_id_fkey"
            columns: ["required_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_sessions: {
        Row: {
          created_at: string
          fail_reason: string | null
          id: string
          initiator_confirmed: boolean
          initiator_id: string
          initiator_offer: Json
          location_id: string
          partner_confirmed: boolean
          partner_id: string
          partner_offer: Json
          status: string
          tax_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fail_reason?: string | null
          id?: string
          initiator_confirmed?: boolean
          initiator_id: string
          initiator_offer?: Json
          location_id: string
          partner_confirmed?: boolean
          partner_id: string
          partner_offer?: Json
          status?: string
          tax_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fail_reason?: string | null
          id?: string
          initiator_confirmed?: boolean
          initiator_id?: string
          initiator_offer?: Json
          location_id?: string
          partner_confirmed?: boolean
          partner_id?: string
          partner_offer?: Json
          status?: string
          tax_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_sessions_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_sessions: {
        Row: {
          arrives_at: string
          character_id: string
          created_at: string
          from_location_id: string | null
          id: string
          mount_id: string | null
          started_at: string
          status: string
          to_location_id: string
        }
        Insert: {
          arrives_at: string
          character_id: string
          created_at?: string
          from_location_id?: string | null
          id?: string
          mount_id?: string | null
          started_at?: string
          status?: string
          to_location_id: string
        }
        Update: {
          arrives_at?: string
          character_id?: string
          created_at?: string
          from_location_id?: string | null
          id?: string
          mount_id?: string | null
          started_at?: string
          status?: string
          to_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_sessions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_sessions_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_sessions_mount_id_fkey"
            columns: ["mount_id"]
            isOneToOne: false
            referencedRelation: "mounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_sessions_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
      add_proficiency: {
        Args: { _desc?: string; _label: string; _sort?: number; _value: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_duel_participant: {
        Args: { _duel: string; _user: string }
        Returns: boolean
      }
      is_trade_participant: {
        Args: { _trade: string; _user: string }
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
      clan_buff_type:
        | "hp_bonus"
        | "energy_bonus"
        | "skill_power_bonus"
        | "skill_cost_reduction"
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
        | "weapon"
        | "material"
      minigame_kind:
        | "cleanup"
        | "sequence"
        | "forge"
        | "tailoring"
        | "mining"
        | "logging"
        | "kenjutsu"
        | "kenjutsu_defense"
        | "kenjutsu_kata"
        | "hand_seals"
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
      npc_kind:
        | "aggressive"
        | "shop"
        | "reward"
        | "learning"
        | "object"
        | "dialogue"
        | "buyer"
        | "employer"
      proficiency_kind:
        | "kenjutsu"
        | "shurikenjutsu"
        | "taijutsu"
        | "ninjutsu"
        | "genjutsu"
        | "fuinjutsu"
        | "iryo"
      pvp_action: "attack" | "defend" | "item" | "pass" | "forfeit"
      pvp_category: "fisico" | "mental" | "ninjutsu"
      pvp_status: "pending" | "active" | "finished" | "cancelled"
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
        | "selos_de_mao"
        | "katon"
        | "suiton"
        | "fuuton"
        | "doton"
        | "raiton"
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
      clan_buff_type: [
        "hp_bonus",
        "energy_bonus",
        "skill_power_bonus",
        "skill_cost_reduction",
      ],
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
        "weapon",
        "material",
      ],
      minigame_kind: [
        "cleanup",
        "sequence",
        "forge",
        "tailoring",
        "mining",
        "logging",
        "kenjutsu",
        "kenjutsu_defense",
        "kenjutsu_kata",
        "hand_seals",
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
      npc_kind: [
        "aggressive",
        "shop",
        "reward",
        "learning",
        "object",
        "dialogue",
        "buyer",
        "employer",
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
      pvp_action: ["attack", "defend", "item", "pass", "forfeit"],
      pvp_category: ["fisico", "mental", "ninjutsu"],
      pvp_status: ["pending", "active", "finished", "cancelled"],
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
        "selos_de_mao",
        "katon",
        "suiton",
        "fuuton",
        "doton",
        "raiton",
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
