<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (MOVIE MAX)
- Broadcast state shown as ON AIR must come only from the external playout engine's heartbeat (`isOnAir` in src/lib/broadcast.ts) — schedule time alone never counts, so the UI never fakes a live broadcast.
- The playout engine is an external persistent server talking to `/api/public/engine/v1/*`; its token wraps a dedicated Firebase login with the `playout_engine` role (src/lib/engine-login.ts, engine-auth.server.ts), so firestore.rules govern it like any user — FFmpeg cannot run in the web app runtime.
- Operator actions are queued rows in `broadcast_commands` that the engine claims and reports on — keeps the browser out of the playout path.
- Media files and pictures (thumbnails, logos, card images via `uploadPicture`) live in Cloudflare R2, reached only server-side through src/lib/r2.server.ts; the station's upload Worker address and token are built into that server-only file and win over project secrets, so remixes upload without setup — they never reach the browser.
- All app data lives in Firebase Firestore (project config in src/lib/firebase-config.ts, shared by every remix) through the query builder in src/lib/db (browser SDK in the client, REST with the caller's ID token on the server); Lovable Cloud tables are unused. Permissions are enforced by firestore.rules (owner email + `user_roles` doc per user); `src/lib/permissions.ts` mirrors them only for UI controls.
- Firestore queries push only equality filters; ranges, ordering, limits and `where(fn)` run after loading, so no composite indexes are ever needed.
- Store timestamps in UTC and convert with the channel timezone helpers in src/lib/broadcast.ts (default Africa/Kampala).
- Public site pages use the `theme-public` token scope (light glass look; video screens inside wrap in `theme-screen` to keep dark tokens); the admin uses the default dark broadcast tokens in src/styles.css.
- Players get their URL from `playbackUrl` (src/lib/stream-url.ts): http-only HLS origins are served through the folder-locked relay `/api/public/hls/{slug}/*` because https pages block mixed content; never turn it into an open proxy.
- The engine's push destination lives in `stream_destinations` (staff-only rules), not `channels`, because `channels` is publicly readable and publish details must stay private; the station's built-in server (stream key included) lives in server-only src/lib/station-destination.server.ts and `ensureStationDestination` writes it only over an empty/legacy destination, so remixes need no setup and the key never reaches the browser bundle.
- Media can be linked instead of uploaded (`media_assets.source_url`, parsed by src/lib/media-link.ts); links into the connected bucket store `storage_key` so access stays signed, and deleting a linked entry never deletes the file — staff already own those files.
- The reference playout engine ships as one dependency-free Node file in public/engine/ (downloadable by staff); its pure schedule/FFmpeg helpers are exported and unit-tested, and it computes the play offset from the clock so restarts resume in place.
- Website playout (src/lib/web-playout.ts, `ScheduledPlayer`) plays the published schedule straight from the media files when no engine is ON AIR, positioned from the server-corrected clock so every viewer sees the same moment; it is labelled LIVE, never ON AIR, and only appears when a playable file is scheduled now — it covers the website only, not the HLS output.
- On-screen graphics go on air only from `graphics_overlays.published_config`/`published_enabled` (copied on Publish) so draft edits never reach viewers; timing lives in src/lib/graphics.ts and one `GraphicsLayer` draws them for the website, the `/output` page and the admin preview.
- The streaming server only receives RTMP/RTMPS (no browser publishing), so its stream is fed by OBS capturing the clean `/output` page (picture + graphics + sound); the reference engine does not burn graphics in yet.
- Branded broadcast cards (Up next) are data-driven: designs, text templates and transitions live in src/lib/brand-cards.ts and one `BrandCard` draws them for every surface; enter/exit phases are computed from the clock (`overlayRemainingMs`) so the website and /output stay in sync — news lower thirds follow the same pattern in src/lib/news-cards.ts + `NewsCard` (drawn for the `lower_third` overlay); add new card types the same way instead of one-off overlays.
- Rolling ticker, breaking news and pop-up cards share one kit pattern (src/lib/card-kits.ts + `TickerCard`/`BreakingCard`/`PopupCard`, edited in `KitStudio`); Publish only restarts the on-air timer of graphics that changed (`publishPatch`), and per-graphic Show now / Take off air write one row — so putting one card on air never re-triggers the others.
- Small always-on graphics (Now showing, local-time clock, ON AIR tag, logo watermark text) follow the same kit pattern in src/lib/badge-kits.ts + `BadgeCards` (edited in `BadgeStudio`), so every screen draws them from one renderer.
- Graphic timing lives only in `timingMode`/`hiddenReason` (src/lib/graphics.ts) and every studio uses the shared `TimingStep`, so all graphics offer the same stay-up / once / repeat choices plus Show now / Take off air; graphics draw over the standby picture too, so the clock, logo and bars stay on air between programmes.
