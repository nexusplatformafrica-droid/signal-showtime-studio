// Generated from src/lib/db-types.ts: column lists, nullable columns and insert defaults per collection.
// Reads fill missing columns with null and inserts apply these defaults, so rows look exactly like before.
export type TableSchema = { columns: string[]; nullable: string[]; defaults: Record<string, unknown>; now: string[] };

export const SCHEMA: Record<string, TableSchema> = {
  "audit_logs": {
    "columns": [
      "action",
      "actor_id",
      "created_at",
      "details",
      "entity",
      "entity_id",
      "id"
    ],
    "nullable": [
      "actor_id",
      "entity_id"
    ],
    "defaults": {
      "details": {}
    },
    "now": [
      "created_at"
    ]
  },
  "broadcast_commands": {
    "columns": [
      "acknowledged_at",
      "channel_id",
      "command",
      "completed_at",
      "created_at",
      "id",
      "issued_by",
      "payload",
      "result",
      "status"
    ],
    "nullable": [
      "acknowledged_at",
      "completed_at",
      "result"
    ],
    "defaults": {
      "payload": {},
      "status": "queued"
    },
    "now": [
      "created_at"
    ]
  },
  "broadcast_events": {
    "columns": [
      "channel_id",
      "details",
      "entry_id",
      "event_type",
      "id",
      "media_id",
      "message",
      "occurred_at",
      "severity"
    ],
    "nullable": [
      "entry_id",
      "media_id"
    ],
    "defaults": {
      "details": {},
      "severity": "info"
    },
    "now": [
      "occurred_at"
    ]
  },
  "broadcast_status": {
    "columns": [
      "active_live_input_id",
      "channel_id",
      "current_entry_id",
      "current_media_id",
      "current_title",
      "destination_status",
      "duration_seconds",
      "encoder_status",
      "engine_host",
      "engine_version",
      "last_error",
      "last_heartbeat_at",
      "next_title",
      "on_air",
      "output_bitrate_kbps",
      "output_fps",
      "output_resolution",
      "position_seconds",
      "source",
      "updated_at"
    ],
    "nullable": [
      "active_live_input_id",
      "current_entry_id",
      "current_media_id",
      "current_title",
      "destination_status",
      "duration_seconds",
      "encoder_status",
      "engine_host",
      "engine_version",
      "last_error",
      "last_heartbeat_at",
      "next_title",
      "output_bitrate_kbps",
      "output_fps",
      "output_resolution",
      "position_seconds"
    ],
    "defaults": {
      "on_air": false,
      "source": "none"
    },
    "now": [
      "updated_at"
    ]
  },
  "channels": {
    "columns": [
      "audio_bitrate_kbps",
      "auto_restart",
      "created_at",
      "custom_domain",
      "default_quality",
      "description",
      "hls_segment_seconds",
      "hls_url",
      "id",
      "language",
      "live_return_behaviour",
      "logo_url",
      "name",
      "output_fps",
      "output_resolution",
      "player_url",
      "slug",
      "standby_media_id",
      "streaming_provider",
      "timezone",
      "updated_at",
      "video_bitrate_kbps",
      "visibility",
      "website_url"
    ],
    "nullable": [
      "custom_domain",
      "description",
      "hls_url",
      "logo_url",
      "player_url",
      "standby_media_id",
      "streaming_provider",
      "website_url"
    ],
    "defaults": {
      "audio_bitrate_kbps": 128,
      "auto_restart": true,
      "default_quality": "auto",
      "hls_segment_seconds": 4,
      "language": "en",
      "live_return_behaviour": "resume_schedule",
      "output_fps": 25,
      "output_resolution": "1920x1080",
      "timezone": "Africa/Kampala",
      "video_bitrate_kbps": 4500,
      "visibility": "public"
    },
    "now": [
      "created_at",
      "updated_at"
    ]
  },
  "engine_tokens": {
    "columns": [
      "channel_id",
      "created_at",
      "created_by",
      "email",
      "id",
      "label",
      "last_used_at",
      "revoked_at",
      "token_hash",
      "token_prefix"
    ],
    "nullable": [
      "created_by",
      "email",
      "last_used_at",
      "revoked_at"
    ],
    "defaults": {},
    "now": [
      "created_at"
    ]
  },
  "graphics_overlays": {
    "columns": [
      "channel_id",
      "config",
      "created_at",
      "enabled",
      "id",
      "kind",
      "name",
      "published_at",
      "published_config",
      "published_enabled",
      "show_from",
      "show_until",
      "updated_at"
    ],
    "nullable": [
      "published_at",
      "published_config",
      "show_from",
      "show_until"
    ],
    "defaults": {
      "config": {},
      "enabled": false,
      "published_enabled": false
    },
    "now": [
      "created_at",
      "updated_at"
    ]
  },
  "live_inputs": {
    "columns": [
      "audio_ok",
      "bitrate_kbps",
      "channel_id",
      "connected",
      "created_at",
      "enabled",
      "fps",
      "id",
      "ingest_url",
      "last_seen_at",
      "name",
      "protocol",
      "resolution",
      "stream_key",
      "updated_at"
    ],
    "nullable": [
      "audio_ok",
      "bitrate_kbps",
      "fps",
      "ingest_url",
      "last_seen_at",
      "resolution"
    ],
    "defaults": {
      "connected": false,
      "enabled": true,
      "protocol": "rtmps"
    },
    "now": [
      "created_at",
      "updated_at"
    ]
  },
  "media_assets": {
    "columns": [
      "archived_at",
      "audio_info",
      "available",
      "category",
      "channel_id",
      "classification",
      "container",
      "created_at",
      "created_by",
      "description",
      "duration_seconds",
      "file_size",
      "fingerprint",
      "folder_id",
      "height",
      "id",
      "mime_type",
      "original_filename",
      "source_url",
      "status",
      "storage_bucket",
      "storage_key",
      "tags",
      "thumbnail_url",
      "title",
      "updated_at",
      "upload_id",
      "width"
    ],
    "nullable": [
      "archived_at",
      "audio_info",
      "classification",
      "container",
      "created_by",
      "description",
      "duration_seconds",
      "file_size",
      "fingerprint",
      "folder_id",
      "height",
      "mime_type",
      "original_filename",
      "source_url",
      "storage_bucket",
      "storage_key",
      "thumbnail_url",
      "upload_id",
      "width"
    ],
    "defaults": {
      "available": true,
      "category": "other",
      "status": "uploading",
      "tags": []
    },
    "now": [
      "created_at",
      "updated_at"
    ]
  },
  "media_folders": {
    "columns": [
      "channel_id",
      "created_at",
      "id",
      "name",
      "parent_id"
    ],
    "nullable": [
      "parent_id"
    ],
    "defaults": {},
    "now": [
      "created_at"
    ]
  },
  "playlist_items": {
    "columns": [
      "created_at",
      "id",
      "media_id",
      "playlist_id",
      "position"
    ],
    "nullable": [],
    "defaults": {},
    "now": [
      "created_at"
    ]
  },
  "playlists": {
    "columns": [
      "channel_id",
      "created_at",
      "created_by",
      "id",
      "kind",
      "name",
      "notes",
      "published",
      "repeat",
      "shuffle",
      "updated_at"
    ],
    "nullable": [
      "created_by",
      "notes"
    ],
    "defaults": {
      "kind": "custom",
      "published": false,
      "repeat": false,
      "shuffle": false
    },
    "now": [
      "created_at",
      "updated_at"
    ]
  },
  "profiles": {
    "columns": [
      "created_at",
      "display_name",
      "email",
      "id",
      "updated_at"
    ],
    "nullable": [
      "display_name",
      "email"
    ],
    "defaults": {},
    "now": [
      "created_at",
      "updated_at"
    ]
  },
  "recurring_schedules": {
    "columns": [
      "channel_id",
      "created_at",
      "created_by",
      "id",
      "rule"
    ],
    "nullable": [
      "created_by"
    ],
    "defaults": {},
    "now": [
      "created_at"
    ]
  },
  "schedule_entries": {
    "columns": [
      "category",
      "channel_id",
      "created_at",
      "created_by",
      "description",
      "ends_at",
      "id",
      "is_commercial_break",
      "media_id",
      "mode",
      "notes",
      "playlist_id",
      "priority",
      "published_at",
      "recurrence_id",
      "starts_at",
      "status",
      "thumbnail_url",
      "title",
      "updated_at"
    ],
    "nullable": [
      "created_by",
      "description",
      "media_id",
      "notes",
      "playlist_id",
      "published_at",
      "recurrence_id",
      "thumbnail_url"
    ],
    "defaults": {
      "category": "other",
      "is_commercial_break": false,
      "mode": "fixed",
      "priority": 0,
      "status": "draft"
    },
    "now": [
      "created_at",
      "updated_at"
    ]
  },
  "stream_destinations": {
    "columns": [
      "channel_id",
      "enabled",
      "id",
      "provider",
      "rtmp_url",
      "stream_name",
      "updated_at",
      "username"
    ],
    "nullable": [
      "rtmp_url",
      "stream_name",
      "username"
    ],
    "defaults": {
      "enabled": true,
      "provider": "Wowza Streaming Engine"
    },
    "now": [
      "updated_at"
    ]
  },
  "stream_health_checks": {
    "columns": [
      "channel_id",
      "checked_at",
      "checked_by",
      "details",
      "id",
      "status",
      "url"
    ],
    "nullable": [
      "checked_by"
    ],
    "defaults": {
      "details": {}
    },
    "now": [
      "checked_at"
    ]
  },
  "user_roles": {
    "columns": [
      "created_at",
      "email",
      "id",
      "roles",
      "updated_at",
      "user_id"
    ],
    "nullable": [
      "email"
    ],
    "defaults": {
      "roles": []
    },
    "now": [
      "created_at",
      "updated_at"
    ]
  },
  "viewer_sessions": {
    "columns": [
      "channel_id",
      "country",
      "device",
      "id",
      "last_seen_at",
      "platform",
      "started_at",
      "user_id",
      "watch_seconds"
    ],
    "nullable": [
      "country",
      "device",
      "platform",
      "user_id"
    ],
    "defaults": {
      "watch_seconds": 0
    },
    "now": [
      "started_at",
      "last_seen_at"
    ]
  }
};

/** Collections whose document id is a column instead of a random uuid (one row per channel). */
export const DOC_KEY: Record<string, string> = { broadcast_status: "channel_id", stream_destinations: "channel_id", user_roles: "user_id", profiles: "id" };
