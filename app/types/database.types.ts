export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      apps: {
        Row: {
          achievements: number | null
          alt_titles: string[] | null
          blacklists: number | null
          bundles: number | null
          cards: number | null
          change_number: number | null
          created_at: string | null
          description: string | null
          developers: string[] | null
          discounted_price: number | null
          exfgls: boolean | null
          free: boolean | null
          giveaways: number | null
          header: string | null
          historical_low: number | null
          id: number
          languages: string[] | null
          libraries: number | null
          market_price: number | null
          negative_reviews: number | null
          parent_id: number | null
          platforms: string[] | null
          plus_one: boolean | null
          positive_reviews: number | null
          publishers: string[] | null
          released_at: string | null
          removed_as: string | null
          removed_at: string | null
          retail_price: number | null
          screenshots: string[] | null
          steam_bundles: number | null
          steam_packages: number | null
          steamdeck: string | null
          tags: string[] | null
          title: string | null
          tradelists: number | null
          type: Database["public"]["Enums"]["app_type"]
          updated_at: string | null
          videos: string[] | null
          website: string | null
          wishlists: number | null
        }
        Insert: {
          achievements?: number | null
          alt_titles?: string[] | null
          blacklists?: number | null
          bundles?: number | null
          cards?: number | null
          change_number?: number | null
          created_at?: string | null
          description?: string | null
          developers?: string[] | null
          discounted_price?: number | null
          exfgls?: boolean | null
          free?: boolean | null
          giveaways?: number | null
          header?: string | null
          historical_low?: number | null
          id: number
          languages?: string[] | null
          libraries?: number | null
          market_price?: number | null
          negative_reviews?: number | null
          parent_id?: number | null
          platforms?: string[] | null
          plus_one?: boolean | null
          positive_reviews?: number | null
          publishers?: string[] | null
          released_at?: string | null
          removed_as?: string | null
          removed_at?: string | null
          retail_price?: number | null
          screenshots?: string[] | null
          steam_bundles?: number | null
          steam_packages?: number | null
          steamdeck?: string | null
          tags?: string[] | null
          title?: string | null
          tradelists?: number | null
          type?: Database["public"]["Enums"]["app_type"]
          updated_at?: string | null
          videos?: string[] | null
          website?: string | null
          wishlists?: number | null
        }
        Update: {
          achievements?: number | null
          alt_titles?: string[] | null
          blacklists?: number | null
          bundles?: number | null
          cards?: number | null
          change_number?: number | null
          created_at?: string | null
          description?: string | null
          developers?: string[] | null
          discounted_price?: number | null
          exfgls?: boolean | null
          free?: boolean | null
          giveaways?: number | null
          header?: string | null
          historical_low?: number | null
          id?: number
          languages?: string[] | null
          libraries?: number | null
          market_price?: number | null
          negative_reviews?: number | null
          parent_id?: number | null
          platforms?: string[] | null
          plus_one?: boolean | null
          positive_reviews?: number | null
          publishers?: string[] | null
          released_at?: string | null
          removed_as?: string | null
          removed_at?: string | null
          retail_price?: number | null
          screenshots?: string[] | null
          steam_bundles?: number | null
          steam_packages?: number | null
          steamdeck?: string | null
          tags?: string[] | null
          title?: string | null
          tradelists?: number | null
          type?: Database["public"]["Enums"]["app_type"]
          updated_at?: string | null
          videos?: string[] | null
          website?: string | null
          wishlists?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apps_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_apps: {
        Row: {
          app_id: number
          collection_id: string
          source: Database["public"]["Enums"]["collection_apps_source"]
        }
        Insert: {
          app_id: number
          collection_id: string
          source?: Database["public"]["Enums"]["collection_apps_source"]
        }
        Update: {
          app_id?: number
          collection_id?: string
          source?: Database["public"]["Enums"]["collection_apps_source"]
        }
        Relationships: [
          {
            foreignKeyName: "collection_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_apps_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_relations: {
        Row: {
          collection_id: string
          parent_id: string
        }
        Insert: {
          collection_id: string
          parent_id: string
        }
        Update: {
          collection_id?: string
          parent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_relations_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_relations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_tags: {
        Row: {
          app_id: number
          body: string | null
          collection_id: string
          tag_id: number
        }
        Insert: {
          app_id: number
          body?: string | null
          collection_id: string
          tag_id: number
        }
        Update: {
          app_id?: number
          body?: string | null
          collection_id?: string
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_tags_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tags_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          description: string | null
          ends_at: string | null
          id: string
          links: Json | null
          master: boolean | null
          private: boolean | null
          starts_at: string | null
          title: string
          type: Database["public"]["Enums"]["collection_type"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          links?: Json | null
          master?: boolean | null
          private?: boolean | null
          starts_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["collection_type"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          links?: Json | null
          master?: boolean | null
          private?: boolean | null
          starts_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["collection_type"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          created_at: string | null
          encrypted_data: string
          iv: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_data: string
          iv: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_data?: string
          iv?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          read: boolean
          type: Database["public"]["Enums"]["notification"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          read?: boolean
          type: Database["public"]["Enums"]["notification"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          read?: boolean
          type?: Database["public"]["Enums"]["notification"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          app_columns: string[] | null
          app_links: Json | null
          created_at: string | null
          dark_mode: boolean | null
          dashboard_widgets: Database["public"]["Enums"]["widget"][] | null
          enabled_notifications:
            | Database["public"]["Enums"]["notification"][]
            | null
          incoming_criteria: Json | null
          track_vault_copies: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_columns?: string[] | null
          app_links?: Json | null
          created_at?: string | null
          dark_mode?: boolean | null
          dashboard_widgets?: Database["public"]["Enums"]["widget"][] | null
          enabled_notifications?:
            | Database["public"]["Enums"]["notification"][]
            | null
          incoming_criteria?: Json | null
          track_vault_copies?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_columns?: string[] | null
          app_links?: Json | null
          created_at?: string | null
          dark_mode?: boolean | null
          dashboard_widgets?: Database["public"]["Enums"]["widget"][] | null
          enabled_notifications?:
            | Database["public"]["Enums"]["notification"][]
            | null
          incoming_criteria?: Json | null
          track_vault_copies?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          communication: number
          created_at: string | null
          fairness: number
          helpfulness: number
          id: string
          speed: number
          subject_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          communication: number
          created_at?: string | null
          fairness: number
          helpfulness: number
          id?: string
          speed: number
          subject_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          communication?: number
          created_at?: string | null
          fairness?: number
          helpfulness?: number
          id?: string
          speed?: number
          subject_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string | null
          id: number
          title: string
          type: Database["public"]["Enums"]["tag_type"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          title: string
          type?: Database["public"]["Enums"]["tag_type"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          title?: string
          type?: Database["public"]["Enums"]["tag_type"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trade_activity: {
        Row: {
          created_at: string | null
          id: string
          trade_id: string
          type: Database["public"]["Enums"]["trade_activity_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          trade_id: string
          type: Database["public"]["Enums"]["trade_activity_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          trade_id?: string
          type?: Database["public"]["Enums"]["trade_activity_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_activity_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trade_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_apps: {
        Row: {
          app_id: number
          collection_id: string | null
          created_at: string | null
          mandatory: boolean | null
          selected: boolean | null
          snapshot: Json | null
          total: number
          trade_id: string
          updated_at: string | null
          user_id: string
          vault_entries: string[] | null
        }
        Insert: {
          app_id: number
          collection_id?: string | null
          created_at?: string | null
          mandatory?: boolean | null
          selected?: boolean | null
          snapshot?: Json | null
          total?: number
          trade_id: string
          updated_at?: string | null
          user_id: string
          vault_entries?: string[] | null
        }
        Update: {
          app_id?: number
          collection_id?: string | null
          created_at?: string | null
          mandatory?: boolean | null
          selected?: boolean | null
          snapshot?: Json | null
          total?: number
          trade_id?: string
          updated_at?: string | null
          user_id?: string
          vault_entries?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_apps_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_apps_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_apps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trade_apps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          trade_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          trade_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          trade_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_messages_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trade_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_views: {
        Row: {
          created_at: string | null
          trade_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          trade_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          trade_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_views_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trade_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string | null
          criteria: Json | null
          id: string
          original_id: string | null
          receiver_disputed: boolean | null
          receiver_id: string | null
          receiver_total: number | null
          receiver_vaultless: boolean | null
          sender_disputed: boolean | null
          sender_id: string | null
          sender_total: number | null
          sender_vaultless: boolean | null
          status: Database["public"]["Enums"]["trade_status"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria?: Json | null
          id?: string
          original_id?: string | null
          receiver_disputed?: boolean | null
          receiver_id?: string | null
          receiver_total?: number | null
          receiver_vaultless?: boolean | null
          sender_disputed?: boolean | null
          sender_id?: string | null
          sender_total?: number | null
          sender_vaultless?: boolean | null
          status: Database["public"]["Enums"]["trade_status"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json | null
          id?: string
          original_id?: string | null
          receiver_disputed?: boolean | null
          receiver_id?: string | null
          receiver_total?: number | null
          receiver_vaultless?: boolean | null
          sender_disputed?: boolean | null
          sender_id?: string | null
          sender_total?: number | null
          sender_vaultless?: boolean | null
          status?: Database["public"]["Enums"]["trade_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_original_id_fkey"
            columns: ["original_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trades_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trades_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      updater_queue: {
        Row: {
          created_at: string | null
          id: string
          type: Database["public"]["Enums"]["updater_queue_type"]
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          type: Database["public"]["Enums"]["updater_queue_type"]
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          type?: Database["public"]["Enums"]["updater_queue_type"]
          value?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar: string | null
          background: string | null
          bio: string | null
          created_at: string | null
          custom_url: string | null
          discord_id: string | null
          display_name: string | null
          id: string
          public_key: string | null
          region: Database["public"]["Enums"]["country_code"] | null
          steam_id: string
          updated_at: string | null
        }
        Insert: {
          avatar?: string | null
          background?: string | null
          bio?: string | null
          created_at?: string | null
          custom_url?: string | null
          discord_id?: string | null
          display_name?: string | null
          id: string
          public_key?: string | null
          region?: Database["public"]["Enums"]["country_code"] | null
          steam_id: string
          updated_at?: string | null
        }
        Update: {
          avatar?: string | null
          background?: string | null
          bio?: string | null
          created_at?: string | null
          custom_url?: string | null
          discord_id?: string | null
          display_name?: string | null
          id?: string
          public_key?: string | null
          region?: Database["public"]["Enums"]["country_code"] | null
          steam_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      vault_entries: {
        Row: {
          app_id: number
          created_at: string | null
          id: string
          revealed_at: string | null
          trade_id: string | null
          type: Database["public"]["Enums"]["vault_entry_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_id: number
          created_at?: string | null
          id?: string
          revealed_at?: string | null
          trade_id?: string | null
          type: Database["public"]["Enums"]["vault_entry_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_id?: number
          created_at?: string | null
          id?: string
          revealed_at?: string | null
          trade_id?: string | null
          type?: Database["public"]["Enums"]["vault_entry_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_entries_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_entries_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vault_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_tags: {
        Row: {
          body: string | null
          created_at: string | null
          tag_id: number
          vault_entry_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          tag_id: number
          vault_entry_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          tag_id?: number
          vault_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_tags_vault_entry_id_fkey"
            columns: ["vault_entry_id"]
            isOneToOne: false
            referencedRelation: "vault_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_values: {
        Row: {
          created_at: string | null
          receiver_id: string
          value: string
          vault_entry_id: string
        }
        Insert: {
          created_at?: string | null
          receiver_id: string
          value: string
          vault_entry_id: string
        }
        Update: {
          created_at?: string | null
          receiver_id?: string
          value?: string
          vault_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_values_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "user_statistics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vault_values_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_values_vault_entry_id_fkey"
            columns: ["vault_entry_id"]
            isOneToOne: false
            referencedRelation: "vault_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      app_facets: {
        Row: {
          developers: string[] | null
          languages: string[] | null
          platforms: string[] | null
          publishers: string[] | null
          removed_as: string[] | null
          steamdeck: string[] | null
          tags: string[] | null
        }
        Relationships: []
      }
      site_statistics: {
        Row: {
          avg_trades: number | null
          disputed_trades: number | null
          top_region1: Database["public"]["Enums"]["country_code"] | null
          top_region2: Database["public"]["Enums"]["country_code"] | null
          top_region3: Database["public"]["Enums"]["country_code"] | null
          total_traded_volume: number | null
          total_trades: number | null
          total_users: number | null
          total_vault_entries: number | null
          trades_aborted: number | null
          trades_accepted: number | null
          trades_completed: number | null
          trades_declined: number | null
          trades_pending: number | null
          vault_entries_mine: number | null
          vault_entries_received: number | null
        }
        Relationships: []
      }
      trade_partners: {
        Row: {
          partner_id: string | null
          total_completed_trades: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_statistics: {
        Row: {
          avg_communication: number | null
          avg_fairness: number | null
          avg_helpfulness: number | null
          avg_speed: number | null
          completed_trades_distinct_users: number | null
          last_active_at: string | null
          last_given_review_id: string | null
          last_received_review_id: string | null
          latest_received_app_id: number | null
          latest_trade_id: string | null
          master_blacklist_apps: number | null
          master_library_apps: number | null
          master_tradelist_apps: number | null
          master_wishlist_apps: number | null
          reviews_given: number | null
          reviews_received: number | null
          total_collections: number | null
          total_reviews: number | null
          trades_aborted: number | null
          trades_accepted: number | null
          trades_completed: number | null
          trades_countered: number | null
          trades_declined: number | null
          trades_disputed: number | null
          trades_pending: number | null
          user_id: string | null
          vault_entries_mine: number | null
          vault_entries_received: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_collection_app: {
        Args: { p_app_id: number; p_collection_id: string; p_title: string }
        Returns: undefined
      }
      bulk_insert: {
        Args: { p_records: Json; p_table: string }
        Returns: undefined
      }
      bulk_remove_collection_apps: {
        Args: { p_apps: number[]; p_collection_id: string }
        Returns: undefined
      }
      bulk_upsert: {
        Args: {
          p_conflict_fields: string[]
          p_records: Json
          p_table: string
          p_update_fields: string[]
        }
        Returns: number
      }
      clean_app_collections: {
        Args: { p_do_collections?: boolean; p_do_counts?: boolean }
        Returns: undefined
      }
      get_apps_metadata: { Args: never; Returns: Json }
      get_master_collections_apps: {
        Args: {
          p_source?: Database["public"]["Enums"]["collection_apps_source"]
          p_user_id: string
        }
        Returns: {
          blacklist: Json
          library: Json
          tradelist: Json
          wishlist: Json
        }[]
      }
      get_vault_entries: {
        Args: { p_user_id: string }
        Returns: {
          app_id: number
          created_at: string
          revealed_at: string
          trade_id: string
          type: Database["public"]["Enums"]["vault_entry_type"]
          updated_at: string
          value: string
        }[]
      }
      is_allowed_host: {
        Args: { allowed_hosts: string[]; url: string }
        Returns: boolean
      }
      is_sent: {
        Args: { ve: Database["public"]["Tables"]["vault_entries"]["Row"] }
        Returns: boolean
      }
      process_unread_message_notifications: { Args: never; Returns: undefined }
      remove_collection_app: {
        Args: { p_app_id: number; p_collection_id: string }
        Returns: undefined
      }
      send_discord_notification: {
        Args: {
          p_notification_type: string
          p_trade: Database["public"]["Tables"]["trades"]["Row"]
        }
        Returns: undefined
      }
      slugify: { Args: { v: string }; Returns: string }
      update_vault_count: {
        Args: { p_app_id: number; p_delta: number; p_user_id: string }
        Returns: undefined
      }
      updater_dequeue: { Args: { p_count: number }; Returns: number[] }
      updater_enqueue: { Args: { p_appids: number[] }; Returns: undefined }
    }
    Enums: {
      app_type:
        | "unknown"
        | "advertising"
        | "application"
        | "beta"
        | "comic"
        | "config"
        | "demo"
        | "depotonly"
        | "dlc"
        | "driver"
        | "episode"
        | "franchise"
        | "game"
        | "guide"
        | "hardware"
        | "media"
        | "mod"
        | "movie"
        | "music"
        | "plugin"
        | "series"
        | "shortcut"
        | "software"
        | "tool"
        | "video"
      collection_apps_source: "user" | "sync"
      collection_type:
        | "app"
        | "blacklist"
        | "bundle"
        | "custom"
        | "giveaway"
        | "library"
        | "steambundle"
        | "steampackage"
        | "tradelist"
        | "wishlist"
      country_code:
        | "AF"
        | "AL"
        | "DZ"
        | "AS"
        | "AD"
        | "AO"
        | "AI"
        | "AQ"
        | "AG"
        | "AR"
        | "AM"
        | "AW"
        | "AU"
        | "AT"
        | "AZ"
        | "BS"
        | "BH"
        | "BD"
        | "BB"
        | "BY"
        | "BE"
        | "BZ"
        | "BJ"
        | "BM"
        | "BT"
        | "BO"
        | "BQ"
        | "BA"
        | "BW"
        | "BV"
        | "BR"
        | "IO"
        | "BN"
        | "BG"
        | "BF"
        | "BI"
        | "CV"
        | "KH"
        | "CM"
        | "CA"
        | "KY"
        | "CF"
        | "TD"
        | "CL"
        | "CN"
        | "CX"
        | "CC"
        | "CO"
        | "KM"
        | "CD"
        | "CG"
        | "CK"
        | "CR"
        | "HR"
        | "CU"
        | "CW"
        | "CY"
        | "CZ"
        | "CI"
        | "DK"
        | "DJ"
        | "DM"
        | "DO"
        | "EC"
        | "EG"
        | "SV"
        | "GQ"
        | "ER"
        | "EE"
        | "SZ"
        | "ET"
        | "FK"
        | "FO"
        | "FJ"
        | "FI"
        | "FR"
        | "GF"
        | "PF"
        | "TF"
        | "GA"
        | "GM"
        | "GE"
        | "DE"
        | "GH"
        | "GI"
        | "GR"
        | "GL"
        | "GD"
        | "GP"
        | "GU"
        | "GT"
        | "GG"
        | "GN"
        | "GW"
        | "GY"
        | "HT"
        | "HM"
        | "VA"
        | "HN"
        | "HK"
        | "HU"
        | "IS"
        | "IN"
        | "ID"
        | "IR"
        | "IQ"
        | "IE"
        | "IM"
        | "IL"
        | "IT"
        | "JM"
        | "JP"
        | "JE"
        | "JO"
        | "KZ"
        | "KE"
        | "KI"
        | "KP"
        | "KR"
        | "KW"
        | "KG"
        | "LA"
        | "LV"
        | "LB"
        | "LS"
        | "LR"
        | "LY"
        | "LI"
        | "LT"
        | "LU"
        | "MO"
        | "MG"
        | "MW"
        | "MY"
        | "MV"
        | "ML"
        | "MT"
        | "MH"
        | "MQ"
        | "MR"
        | "MU"
        | "YT"
        | "MX"
        | "FM"
        | "MD"
        | "MC"
        | "MN"
        | "ME"
        | "MS"
        | "MA"
        | "MZ"
        | "MM"
        | "NA"
        | "NR"
        | "NP"
        | "NL"
        | "NC"
        | "NZ"
        | "NI"
        | "NE"
        | "NG"
        | "NU"
        | "NF"
        | "MP"
        | "NO"
        | "OM"
        | "PK"
        | "PW"
        | "PS"
        | "PA"
        | "PG"
        | "PY"
        | "PE"
        | "PH"
        | "PN"
        | "PL"
        | "PT"
        | "PR"
        | "QA"
        | "MK"
        | "RO"
        | "RU"
        | "RW"
        | "RE"
        | "BL"
        | "SH"
        | "KN"
        | "LC"
        | "MF"
        | "PM"
        | "VC"
        | "WS"
        | "SM"
        | "ST"
        | "SA"
        | "SN"
        | "RS"
        | "SC"
        | "SL"
        | "SG"
        | "SX"
        | "SK"
        | "SI"
        | "SB"
        | "SO"
        | "ZA"
        | "GS"
        | "SS"
        | "ES"
        | "LK"
        | "SD"
        | "SR"
        | "SJ"
        | "SE"
        | "CH"
        | "SY"
        | "TW"
        | "TJ"
        | "TZ"
        | "TH"
        | "TL"
        | "TG"
        | "TK"
        | "TO"
        | "TT"
        | "TN"
        | "TR"
        | "TM"
        | "TC"
        | "TV"
        | "UG"
        | "UA"
        | "AE"
        | "GB"
        | "UM"
        | "US"
        | "UY"
        | "UZ"
        | "VU"
        | "VE"
        | "VN"
        | "VG"
        | "VI"
        | "WF"
        | "EH"
        | "YE"
        | "ZM"
        | "ZW"
        | "AX"
      notification:
        | "new_trade"
        | "accepted_trade"
        | "new_vault_entry"
        | "unread_messages"
        | "disputed_trade"
        | "resolved_trade"
      tag_type:
        | "vault"
        | "blacklist"
        | "bundle"
        | "custom"
        | "giveaway"
        | "library"
        | "steam_bundle"
        | "steam_package"
        | "tradelist"
        | "wishlist"
      trade_activity_type:
        | "edited"
        | "created"
        | "accepted"
        | "declined"
        | "aborted"
        | "completed"
        | "disputed"
        | "resolved"
        | "countered"
      trade_status:
        | "pending"
        | "accepted"
        | "declined"
        | "aborted"
        | "completed"
      updater_queue_type:
        | "app_names_check"
        | "app_types_check"
        | "app_cards_check"
        | "app_removals_check"
        | "app_list_check"
        | "change_number"
        | "ggdeals_deals_check"
        | "ggdeals_bundles_check"
        | "app_update"
      vault_entry_type: "key" | "gift" | "link" | "curator"
      widget: "welcome" | "stats" | "trade_activity" | "users_online"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_type: [
        "unknown",
        "advertising",
        "application",
        "beta",
        "comic",
        "config",
        "demo",
        "depotonly",
        "dlc",
        "driver",
        "episode",
        "franchise",
        "game",
        "guide",
        "hardware",
        "media",
        "mod",
        "movie",
        "music",
        "plugin",
        "series",
        "shortcut",
        "software",
        "tool",
        "video",
      ],
      collection_apps_source: ["user", "sync"],
      collection_type: [
        "app",
        "blacklist",
        "bundle",
        "custom",
        "giveaway",
        "library",
        "steambundle",
        "steampackage",
        "tradelist",
        "wishlist",
      ],
      country_code: [
        "AF",
        "AL",
        "DZ",
        "AS",
        "AD",
        "AO",
        "AI",
        "AQ",
        "AG",
        "AR",
        "AM",
        "AW",
        "AU",
        "AT",
        "AZ",
        "BS",
        "BH",
        "BD",
        "BB",
        "BY",
        "BE",
        "BZ",
        "BJ",
        "BM",
        "BT",
        "BO",
        "BQ",
        "BA",
        "BW",
        "BV",
        "BR",
        "IO",
        "BN",
        "BG",
        "BF",
        "BI",
        "CV",
        "KH",
        "CM",
        "CA",
        "KY",
        "CF",
        "TD",
        "CL",
        "CN",
        "CX",
        "CC",
        "CO",
        "KM",
        "CD",
        "CG",
        "CK",
        "CR",
        "HR",
        "CU",
        "CW",
        "CY",
        "CZ",
        "CI",
        "DK",
        "DJ",
        "DM",
        "DO",
        "EC",
        "EG",
        "SV",
        "GQ",
        "ER",
        "EE",
        "SZ",
        "ET",
        "FK",
        "FO",
        "FJ",
        "FI",
        "FR",
        "GF",
        "PF",
        "TF",
        "GA",
        "GM",
        "GE",
        "DE",
        "GH",
        "GI",
        "GR",
        "GL",
        "GD",
        "GP",
        "GU",
        "GT",
        "GG",
        "GN",
        "GW",
        "GY",
        "HT",
        "HM",
        "VA",
        "HN",
        "HK",
        "HU",
        "IS",
        "IN",
        "ID",
        "IR",
        "IQ",
        "IE",
        "IM",
        "IL",
        "IT",
        "JM",
        "JP",
        "JE",
        "JO",
        "KZ",
        "KE",
        "KI",
        "KP",
        "KR",
        "KW",
        "KG",
        "LA",
        "LV",
        "LB",
        "LS",
        "LR",
        "LY",
        "LI",
        "LT",
        "LU",
        "MO",
        "MG",
        "MW",
        "MY",
        "MV",
        "ML",
        "MT",
        "MH",
        "MQ",
        "MR",
        "MU",
        "YT",
        "MX",
        "FM",
        "MD",
        "MC",
        "MN",
        "ME",
        "MS",
        "MA",
        "MZ",
        "MM",
        "NA",
        "NR",
        "NP",
        "NL",
        "NC",
        "NZ",
        "NI",
        "NE",
        "NG",
        "NU",
        "NF",
        "MP",
        "NO",
        "OM",
        "PK",
        "PW",
        "PS",
        "PA",
        "PG",
        "PY",
        "PE",
        "PH",
        "PN",
        "PL",
        "PT",
        "PR",
        "QA",
        "MK",
        "RO",
        "RU",
        "RW",
        "RE",
        "BL",
        "SH",
        "KN",
        "LC",
        "MF",
        "PM",
        "VC",
        "WS",
        "SM",
        "ST",
        "SA",
        "SN",
        "RS",
        "SC",
        "SL",
        "SG",
        "SX",
        "SK",
        "SI",
        "SB",
        "SO",
        "ZA",
        "GS",
        "SS",
        "ES",
        "LK",
        "SD",
        "SR",
        "SJ",
        "SE",
        "CH",
        "SY",
        "TW",
        "TJ",
        "TZ",
        "TH",
        "TL",
        "TG",
        "TK",
        "TO",
        "TT",
        "TN",
        "TR",
        "TM",
        "TC",
        "TV",
        "UG",
        "UA",
        "AE",
        "GB",
        "UM",
        "US",
        "UY",
        "UZ",
        "VU",
        "VE",
        "VN",
        "VG",
        "VI",
        "WF",
        "EH",
        "YE",
        "ZM",
        "ZW",
        "AX",
      ],
      notification: [
        "new_trade",
        "accepted_trade",
        "new_vault_entry",
        "unread_messages",
        "disputed_trade",
        "resolved_trade",
      ],
      tag_type: [
        "vault",
        "blacklist",
        "bundle",
        "custom",
        "giveaway",
        "library",
        "steam_bundle",
        "steam_package",
        "tradelist",
        "wishlist",
      ],
      trade_activity_type: [
        "edited",
        "created",
        "accepted",
        "declined",
        "aborted",
        "completed",
        "disputed",
        "resolved",
        "countered",
      ],
      trade_status: ["pending", "accepted", "declined", "aborted", "completed"],
      updater_queue_type: [
        "app_names_check",
        "app_types_check",
        "app_cards_check",
        "app_removals_check",
        "app_list_check",
        "change_number",
        "ggdeals_deals_check",
        "ggdeals_bundles_check",
        "app_update",
      ],
      vault_entry_type: ["key", "gift", "link", "curator"],
      widget: ["welcome", "stats", "trade_activity", "users_online"],
    },
  },
} as const
