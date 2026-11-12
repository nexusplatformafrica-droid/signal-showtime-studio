# MOVIE MAX roadmap

## Done (phase 1)
- [x] Database, roles, staff sign-in, audit log
- [x] Admin: Overview, Control Room, Live Inputs/OBS, Schedule (day/week/month/list), Playlists, Media Library, Graphics, Streaming Endpoints, Settings
- [x] Public site: home with live player, /watch, 7-day /guide, viewer counting
- [x] Playout engine API + contract (docs/PLAYOUT_ENGINE.md)

## Open
- [ ] Connect Cloudflare R2 (needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET from the user)
- [x] Wowza connected as streaming provider (destination + secure relay link saved)
- [ ] Deploy the playout engine server pushing to Wowza, then verify the public HLS link (user infrastructure)
- [ ] Phase 2: Advertisement campaigns & commercial breaks manager
- [ ] Phase 2: Viewer management & analytics (reports, CSV/PDF export)
