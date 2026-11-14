# MOVIE MAX roadmap

## Done (phase 1)
- [x] Database, roles, staff sign-in, audit log
- [x] Admin: Overview, Control Room, Live Inputs/OBS, Schedule (day/week/month/list), Playlists, Media Library, Graphics, Streaming Endpoints, Settings
- [x] Public site: home with live player, /watch, 7-day /guide, viewer counting
- [x] Playout engine API + contract (docs/PLAYOUT_ENGINE.md)

## Open
- [x] Connect Cloudflare R2 through the user's upload Worker
- [x] Switch all data and sign-in to Firebase (Super Admin fixed to mainplatform.nexus@gmail.com; Settings → Firebase tab with rules)
- [ ] Publish firestore.rules in the Firebase console and switch on Email/Password + Google sign-in (user action, steps in Settings → Firebase)
- [ ] Replace the upload token `*` with a long random one on the Cloudflare Worker (user action)
- [x] Add media by pasting an R2 link (public or connected-bucket)
- [x] Wowza connected as streaming provider (destination + secure relay link saved)
- [x] Downloadable playout engine (public/engine/movie-max-engine.mjs) + setup guide in Settings → Playout engine
- [x] Website plays the published schedule itself (LIVE, in sync for all viewers) — no extra server needed for the website
- [x] Real on-screen graphics (published state only) on website + /output page; OBS → Wowza guide in Streaming Endpoints
- [x] Up next branding studio: 16 designs, text templates, own picture, colours, appear/disappear transitions, timing, live preview
- [x] News branding studio: 15 lower-third designs, wording templates, rotating headlines, scrolling description, logo upload, transitions, repeat timing
- [x] Rolling ticker (11), breaking news (16) and pop-up (10) designs: branding studios, on-air drawing on website + /output + preview, Show now / Take off air buttons, publish only restarts changed graphics
- [x] Public website (home, watch, guide, sign-in) restyled to the glassy light theme (warm white, orange gradients, emerald green, soft rounded cards)
- [x] Now showing (12), local time (12), ON AIR (12) designs and logo watermark text (TV etc., 14 styles, under/beside the logo) with wording templates, colours and transitions
- [x] Every graphic has Show now / Take off air and the same timing choices (stays up, once, repeat); graphics stay on screen between programmes; display window uses local time
- [x] Connect HostHerb: engine/OBS push to RTMPS server, website + apps watch https://watch.hostherb.com/tv-257/index.m3u8 (applied on next station-manager sign-in)
- [x] Railway option in Settings → Playout engine (stock node image + start command that fetches the engine)
- [x] Dashboard and website use real online time (not the device clock); schedule form: Start now / After last programme / end by real video length
- [x] Update the Railway broadcaster with the final site link (moviemaxlivetv.nexusplatformafrica.workers.dev)
- [x] Broadcaster v2.3: crash watchdog (reopens page after "Aw, Snap"), lower memory, Oracle Always Free install option
- [ ] Start sending to HostHerb 24/7 from a server with enough memory (Oracle Always Free or Railway with 2 GB) — needs the user's account
- [ ] Phase 2: Advertisement campaigns & commercial breaks manager
- [ ] Phase 2: Viewer management & analytics (reports, CSV/PDF export)
