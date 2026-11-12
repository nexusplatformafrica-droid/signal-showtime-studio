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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      broadcast_commands: {
        Row: {
          acknowledged_at: string | null
          channel_id: string
          command: Database["public"]["Enums"]["command_type"]
          completed_at: string | null
          created_at: string
          id: string
          issued_by: string
          payload: Json
          result: string | null
          status: Database["public"]["Enums"]["command_status"]
        }
        Insert: {
          acknowledged_at?: string | null
          channel_id: string
          command: Database["public"]["Enums"]["command_type"]
          completed_at?: string | null
          created_at?: string
          id?: string
          issued_by: string
          payload?: Json
          result?: string | null
          status?: Database["public"]["Enums"]["command_status"]
        }
        Update: {
          acknowledged_at?: string | null
          channel_id?: string
          command?: Database["public"]["Enums"]["command_type"]
          completed_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string
          payload?: Json
          result?: string | null
          status?: Database["public"]["Enums"]["command_status"]
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_commands_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_events: {
        Row: {
          channel_id: string
          details: Json
          entry_id: string | null
          event_type: string
          id: string
          media_id: string | null
          message: string
          occurred_at: string
          severity: string
        }
        Insert: {
          channel_id: string
          details?: Json
          entry_id?: string | null
          event_type: string
          id?: string
          media_id?: string | null
          message: string
          occurred_at?: string
          severity?: string
        }
        Update: {
          channel_id?: string
          details?: Json
          entry_id?: string | null
          event_type?: string
          id?: string
          media_id?: string | null
          message?: string
          occurred_at?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_status: {
        Row: {
          active_live_input_id: string | null
          channel_id: string
          current_entry_id: string | null
          current_media_id: string | null
          current_title: string | null
          destination_status: string | null
          duration_seconds: number | null
          encoder_status: string | null
          engine_host: string | null
          engine_version: string | null
          last_error: string | null
          last_heartbeat_at: string | null
          next_title: string | null
          on_air: boolean
          output_bitrate_kbps: number | null
          output_fps: number | null
          output_resolution: string | null
          position_seconds: number | null
          source: Database["public"]["Enums"]["broadcast_source"]
          updated_at: string
        }
        Insert: {
          active_live_input_id?: string | null
          channel_id: string
          current_entry_id?: string | null
          current_media_id?: string | null
          current_title?: string | null
          destination_status?: string | null
          duration_seconds?: number | null
          encoder_status?: string | null
          engine_host?: string | null
          engine_version?: string | null
          last_error?: string | null
          last_heartbeat_at?: string | null
          next_title?: string | null
          on_air?: boolean
          output_bitrate_kbps?: number | null
          output_fps?: number | null
          output_resolution?: string | null
          position_seconds?: number | null
          source?: Database["public"]["Enums"]["broadcast_source"]
          updated_at?: string
        }
        Update: {
          active_live_input_id?: string | null
          channel_id?: string
          current_entry_id?: string | null
          current_media_id?: string | null
          current_title?: string | null
          destination_status?: string | null
          duration_seconds?: number | null
          encoder_status?: string | null
          engine_host?: string | null
          engine_version?: string | null
          last_error?: string | null
          last_heartbeat_at?: string | null
          next_title?: string | null
          on_air?: boolean
          output_bitrate_kbps?: number | null
          output_fps?: number | null
          output_resolution?: string | null
          position_seconds?: number | null
          source?: Database["public"]["Enums"]["broadcast_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_status_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          audio_bitrate_kbps: number
          auto_restart: boolean
          created_at: string
          custom_domain: string | null
          default_quality: string
          description: string | null
          hls_segment_seconds: number
          hls_url: string | null
          id: string
          language: string
          live_return_behaviour: string
          logo_url: string | null
          name: string
          output_fps: number
          output_resolution: string
          player_url: string | null
          slug: string
          standby_media_id: string | null
          streaming_provider: string | null
          timezone: string
          updated_at: string
          video_bitrate_kbps: number
          visibility: Database["public"]["Enums"]["channel_visibility"]
          website_url: string | null
        }
        Insert: {
          audio_bitrate_kbps?: number
          auto_restart?: boolean
          created_at?: string
          custom_domain?: string | null
          default_quality?: string
          description?: string | null
          hls_segment_seconds?: number
          hls_url?: string | null
          id?: string
          language?: string
          live_return_behaviour?: string
          logo_url?: string | null
          name: string
          output_fps?: number
          output_resolution?: string
          player_url?: string | null
          slug: string
          standby_media_id?: string | null
          streaming_provider?: string | null
          timezone?: string
          updated_at?: string
          video_bitrate_kbps?: number
          visibility?: Database["public"]["Enums"]["channel_visibility"]
          website_url?: string | null
        }
        Update: {
          audio_bitrate_kbps?: number
          auto_restart?: boolean
          created_at?: string
          custom_domain?: string | null
          default_quality?: string
          description?: string | null
          hls_segment_seconds?: number
          hls_url?: string | null
          id?: string
          language?: string
          live_return_behaviour?: string
          logo_url?: string | null
          name?: string
          output_fps?: number
          output_resolution?: string
          player_url?: string | null
          slug?: string
          standby_media_id?: string | null
          streaming_provider?: string | null
          timezone?: string
          updated_at?: string
          video_bitrate_kbps?: number
          visibility?: Database["public"]["Enums"]["channel_visibility"]
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_standby_fk"
            columns: ["standby_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_tokens: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_tokens_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      graphics_overlays: {
        Row: {
          channel_id: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["overlay_kind"]
          name: string
          published_at: string | null
          show_from: string | null
          show_until: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind: Database["public"]["Enums"]["overlay_kind"]
          name: string
          published_at?: string | null
          show_from?: string | null
          show_until?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["overlay_kind"]
          name?: string
          published_at?: string | null
          show_from?: string | null
          show_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "graphics_overlays_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      live_inputs: {
        Row: {
          audio_ok: boolean | null
          bitrate_kbps: number | null
          channel_id: string
          connected: boolean
          created_at: string
          enabled: boolean
          fps: number | null
          id: string
          ingest_url: string | null
          last_seen_at: string | null
          name: string
          protocol: Database["public"]["Enums"]["ingest_protocol"]
          resolution: string | null
          stream_key: string
          updated_at: string
        }
        Insert: {
          audio_ok?: boolean | null
          bitrate_kbps?: number | null
          channel_id: string
          connected?: boolean
          created_at?: string
          enabled?: boolean
          fps?: number | null
          id?: string
          ingest_url?: string | null
          last_seen_at?: string | null
          name: string
          protocol?: Database["public"]["Enums"]["ingest_protocol"]
          resolution?: string | null
          stream_key: string
          updated_at?: string
        }
        Update: {
          audio_ok?: boolean | null
          bitrate_kbps?: number | null
          channel_id?: string
          connected?: boolean
          created_at?: string
          enabled?: boolean
          fps?: number | null
          id?: string
          ingest_url?: string | null
          last_seen_at?: string | null
          name?: string
          protocol?: Database["public"]["Enums"]["ingest_protocol"]
          resolution?: string | null
          stream_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_inputs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          archived_at: string | null
          audio_info: string | null
          available: boolean
          category: Database["public"]["Enums"]["media_category"]
          channel_id: string
          classification: string | null
          container: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          file_size: number | null
          fingerprint: string | null
          folder_id: string | null
          height: number | null
          id: string
          mime_type: string | null
          original_filename: string | null
          status: Database["public"]["Enums"]["media_status"]
          storage_bucket: string | null
          storage_key: string | null
          tags: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
          upload_id: string | null
          width: number | null
        }
        Insert: {
          archived_at?: string | null
          audio_info?: string | null
          available?: boolean
          category?: Database["public"]["Enums"]["media_category"]
          channel_id: string
          classification?: string | null
          container?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_size?: number | null
          fingerprint?: string | null
          folder_id?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_bucket?: string | null
          storage_key?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          upload_id?: string | null
          width?: number | null
        }
        Update: {
          archived_at?: string | null
          audio_info?: string | null
          available?: boolean
          category?: Database["public"]["Enums"]["media_category"]
          channel_id?: string
          classification?: string | null
          container?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_size?: number | null
          fingerprint?: string | null
          folder_id?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_bucket?: string | null
          storage_key?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          upload_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      media_folders: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_folders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          created_at: string
          id: string
          media_id: string
          playlist_id: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          playlist_id: string
          position: number
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          playlist_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["playlist_kind"]
          name: string
          notes: string | null
          published: boolean
          repeat: boolean
          shuffle: boolean
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["playlist_kind"]
          name: string
          notes?: string | null
          published?: boolean
          repeat?: boolean
          shuffle?: boolean
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["playlist_kind"]
          name?: string
          notes?: string | null
          published?: boolean
          repeat?: boolean
          shuffle?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_schedules: {
        Row: {
          channel_id: string
          created_at: string
          created_by: string | null
          id: string
          rule: Json
        }
        Insert: {
          channel_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          rule: Json
        }
        Update: {
          channel_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          rule?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_entries: {
        Row: {
          category: Database["public"]["Enums"]["media_category"]
          channel_id: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          is_commercial_break: boolean
          media_id: string | null
          mode: Database["public"]["Enums"]["schedule_mode"]
          notes: string | null
          playlist_id: string | null
          priority: number
          published_at: string | null
          recurrence_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["schedule_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["media_category"]
          channel_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          is_commercial_break?: boolean
          media_id?: string | null
          mode?: Database["public"]["Enums"]["schedule_mode"]
          notes?: string | null
          playlist_id?: string | null
          priority?: number
          published_at?: string | null
          recurrence_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["schedule_status"]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["media_category"]
          channel_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          is_commercial_break?: boolean
          media_id?: string | null
          mode?: Database["public"]["Enums"]["schedule_mode"]
          notes?: string | null
          playlist_id?: string | null
          priority?: number
          published_at?: string | null
          recurrence_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurring_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_destinations: {
        Row: {
          channel_id: string
          enabled: boolean
          id: string
          provider: string
          rtmp_url: string | null
          stream_name: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          channel_id: string
          enabled?: boolean
          id?: string
          provider?: string
          rtmp_url?: string | null
          stream_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          channel_id?: string
          enabled?: boolean
          id?: string
          provider?: string
          rtmp_url?: string | null
          stream_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stream_destinations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_health_checks: {
        Row: {
          channel_id: string
          checked_at: string
          checked_by: string | null
          details: Json
          id: string
          status: string
          url: string
        }
        Insert: {
          channel_id: string
          checked_at?: string
          checked_by?: string | null
          details?: Json
          id?: string
          status: string
          url: string
        }
        Update: {
          channel_id?: string
          checked_at?: string
          checked_by?: string | null
          details?: Json
          id?: string
          status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_health_checks_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
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
          role: Database["public"]["Enums"]["app_role"]
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
      viewer_sessions: {
        Row: {
          channel_id: string
          country: string | null
          device: string | null
          id: string
          last_seen_at: string
          platform: string | null
          started_at: string
          user_id: string | null
          watch_seconds: number
        }
        Insert: {
          channel_id: string
          country?: string | null
          device?: string | null
          id: string
          last_seen_at?: string
          platform?: string | null
          started_at?: string
          user_id?: string | null
          watch_seconds?: number
        }
        Update: {
          channel_id?: string
          country?: string | null
          device?: string | null
          id?: string
          last_seen_at?: string
          platform?: string | null
          started_at?: string
          user_id?: string | null
          watch_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "viewer_sessions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "station_manager"
        | "broadcast_operator"
        | "media_manager"
        | "graphics_designer"
        | "advertising_manager"
        | "analyst"
      broadcast_source: "none" | "schedule" | "live" | "emergency" | "standby"
      channel_visibility: "public" | "registration" | "private"
      command_status:
        | "queued"
        | "acknowledged"
        | "completed"
        | "failed"
        | "expired"
      command_type:
        | "play"
        | "pause"
        | "stop"
        | "skip"
        | "take_live"
        | "end_live"
        | "return_to_schedule"
        | "emergency_takeover"
        | "play_standby"
        | "switch_source"
        | "reload_schedule"
      ingest_protocol: "rtmp" | "rtmps" | "srt" | "webrtc"
      media_category:
        | "movie"
        | "series"
        | "episode"
        | "music_video"
        | "news"
        | "documentary"
        | "advertisement"
        | "trailer"
        | "promo"
        | "station_id"
        | "emergency"
        | "other"
      media_status: "uploading" | "processing" | "ready" | "failed" | "archived"
      overlay_kind:
        | "logo"
        | "on_air"
        | "now_showing"
        | "next_programme"
        | "clock"
        | "ticker"
        | "ad_banner"
        | "programme_title"
        | "breaking_news"
        | "live_indicator"
        | "countdown"
        | "station_id"
        | "lower_third"
      playlist_kind:
        | "morning"
        | "afternoon"
        | "prime_time"
        | "night"
        | "marathon"
        | "music"
        | "advertisement"
        | "emergency"
        | "standby"
        | "custom"
      schedule_mode: "fixed" | "follow_on" | "flexible_playlist"
      schedule_status: "draft" | "published" | "cancelled"
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
      app_role: [
        "super_admin",
        "station_manager",
        "broadcast_operator",
        "media_manager",
        "graphics_designer",
        "advertising_manager",
        "analyst",
      ],
      broadcast_source: ["none", "schedule", "live", "emergency", "standby"],
      channel_visibility: ["public", "registration", "private"],
      command_status: [
        "queued",
        "acknowledged",
        "completed",
        "failed",
        "expired",
      ],
      command_type: [
        "play",
        "pause",
        "stop",
        "skip",
        "take_live",
        "end_live",
        "return_to_schedule",
        "emergency_takeover",
        "play_standby",
        "switch_source",
        "reload_schedule",
      ],
      ingest_protocol: ["rtmp", "rtmps", "srt", "webrtc"],
      media_category: [
        "movie",
        "series",
        "episode",
        "music_video",
        "news",
        "documentary",
        "advertisement",
        "trailer",
        "promo",
        "station_id",
        "emergency",
        "other",
      ],
      media_status: ["uploading", "processing", "ready", "failed", "archived"],
      overlay_kind: [
        "logo",
        "on_air",
        "now_showing",
        "next_programme",
        "clock",
        "ticker",
        "ad_banner",
        "programme_title",
        "breaking_news",
        "live_indicator",
        "countdown",
        "station_id",
        "lower_third",
      ],
      playlist_kind: [
        "morning",
        "afternoon",
        "prime_time",
        "night",
        "marathon",
        "music",
        "advertisement",
        "emergency",
        "standby",
        "custom",
      ],
      schedule_mode: ["fixed", "follow_on", "flexible_playlist"],
      schedule_status: ["draft", "published", "cancelled"],
    },
  },
} as const
