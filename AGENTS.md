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
- The playout engine is an external persistent server talking to `/api/public/engine/v1/*` with hashed bearer tokens (contract in docs/PLAYOUT_ENGINE.md) — FFmpeg cannot run in the web app runtime.
- Operator actions are queued rows in `broadcast_commands` that the engine claims and reports on — keeps the browser out of the playout path.
- Media files live in Cloudflare R2 via server-signed URLs (src/lib/r2.server.ts); thumbnails/logos live in the private `media-thumbnails` bucket served through `/api/public/thumbnails/*` — credentials never reach the browser.
- Permissions are enforced by database policies using `has_any_role`; `src/lib/permissions.ts` mirrors them only to enable/disable UI controls.
- Store timestamps in UTC and convert with the channel timezone helpers in src/lib/broadcast.ts (default Africa/Kampala).
- Public site pages use the `theme-public` token scope; the admin uses the default dark broadcast tokens in src/styles.css.
