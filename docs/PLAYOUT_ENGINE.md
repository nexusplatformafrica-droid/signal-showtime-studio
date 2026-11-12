# MOVIE MAX Playout Engine Contract (v1)

The playout engine is a **separate, persistent server** (e.g. Ubuntu + FFmpeg + MediaMTX/nginx-rtmp, supervised by systemd).
It must never run inside the web app or serverless functions. The web app stores schedules and settings; the engine executes them.

## Authentication
Create a token in **Settings → Playout engine** (Super Admin). Send it on every request:

    Authorization: Bearer mmx_eng_...

Base URL: `https://<your-site>/api/public/engine/v1`

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/config` | Channel output settings, `destination` (where to push the programme, e.g. Wowza `rtmp_url` + `stream_name`; the publish password, if any, stays on the engine host), published graphics overlays, live inputs (with stream keys), standby media (signed URL) |
| GET | `/schedule?from=ISO&to=ISO` | Published schedule entries, playlists with ordered items, media with signed download URLs (6 h) |
| POST | `/heartbeat` | Report real broadcast state every 5–10 s. The dashboard shows ON AIR only while heartbeats are < 30 s old and `on_air` is true |
| POST | `/events` | `{ events: [{ event_type, severity, message, entry_id?, media_id?, details?, occurred_at? }] }` |
| GET | `/commands` | Claims queued operator commands (each delivered once; commands older than 2 min expire) |
| POST | `/commands/{id}/result` | `{ status: "completed" \| "failed", result? }` |
| POST | `/ingest/auth` | Stream-key check for publish hooks: `{ stream_key }` or MediaMTX `{ action, password/name }` → 200 / 401 |
| GET | `/media/{id}/url` | Fresh media URL: signed for files in the connected R2 bucket, or the pasted public link (`source_url`) for linked files |

### Heartbeat body
```json
{
  "on_air": true, "source": "schedule",
  "current_entry_id": "uuid", "current_media_id": "uuid",
  "current_title": "Film title", "next_title": "Next film",
  "position_seconds": 812.4, "duration_seconds": 5400,
  "output_resolution": "1920x1080", "output_bitrate_kbps": 4500, "output_fps": 25,
  "encoder_status": "running", "destination_status": "connected",
  "engine_version": "1.0.0", "engine_host": "playout-01",
  "live_inputs": [{ "id": "uuid", "connected": true, "bitrate_kbps": 5200, "resolution": "1920x1080", "fps": 25, "audio_ok": true }]
}
```

### Recommended event types
`programme_started`, `programme_completed`, `programme_interrupted`, `live_input_connected`, `live_input_disconnected`,
`schedule_changed`, `emergency_takeover`, `encoder_error`, `media_missing`, `fallback_played`, `engine_restarted`.

### Commands
`play, pause, stop, skip, take_live {live_input_id}, end_live, return_to_schedule, emergency_takeover {source, live_input_id?},
play_standby, switch_source {source}, reload_schedule`. After live ends, follow `channel.live_return_behaviour`
(`resume_programme` | `skip_next` | `resume_schedule`).

## Engine responsibilities
Poll `/schedule` (e.g. every 60 s and on `reload_schedule`), build the playlist, switch at exact UTC times, insert commercial
breaks, honour live-input priority, composite published graphics, play standby on failure, record history via `/events`,
survive restarts (persist the current item locally), keep the clock in sync (NTP), and publish HLS to the URL configured in
**Streaming Endpoints**. Use the stream health checker there to verify the public link.
