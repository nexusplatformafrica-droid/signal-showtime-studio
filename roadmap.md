# MOVIE MAX roadmap

## Done (phase 1)
- [x] Database, roles, staff sign-in, audit log
- [x] Admin: Overview, Control Room, Live Inputs/OBS, Schedule (day/week/month/list), Playlists, Media Library, Graphics, Streaming Endpoints, Settings
- [x] Public site: home with live player, /watch, 7-day /guide, viewer counting
- [x] Playout engine API + contract (docs/PLAYOUT_ENGINE.md)

## Open
- [ ] Connect Cloudflare R2 (needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET from the user)
- [x] Add media by pasting an R2 link (public or connected-bucket)
- [x] Wowza connected as streaming provider (destination + secure relay link saved)
- [x] Downloadable playout engine (public/engine/movie-max-engine.mjs) + setup guide in Settings → Playout engine
- [x] Website plays the published schedule itself (LIVE, in sync for all viewers) — no extra server needed for the website
- [x] Real on-screen graphics (published state only) on website + /output page; OBS → Wowza guide in Streaming Endpoints
- [x] Up next branding studio: 16 designs, text templates, own picture, colours, appear/disappear transitions, timing, live preview
- [x] News branding studio: 15 lower-third designs, wording templates, rotating headlines, scrolling description, logo upload, transitions, repeat timing
- [ ] Send /output to Wowza with OBS on an always-on computer (needs user's computer + Wowza Live Broadcast password)
- [ ] Optional: run the engine on a 24/7 server with the Wowza live password, then verify the Wowza link for apps/TV boxes (needs user's server + Wowza password; site must be published)
- [ ] Phase 2: Advertisement campaigns & commercial breaks manager
- [ ] Phase 2: Viewer management & analytics (reports, CSV/PDF export)
