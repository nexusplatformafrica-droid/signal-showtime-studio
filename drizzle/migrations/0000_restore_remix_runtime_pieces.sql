-- Signup: profile creation + first account becomes Super Admin (trigger was not carried over by the remix)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime for live broadcast status, events, commands and live inputs
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['broadcast_status','broadcast_events','broadcast_commands','live_inputs'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Required station rows: the MOVIE MAX channel, its Wowza output and default on-screen graphics
INSERT INTO public.channels (slug, name, description, hls_url, streaming_provider)
VALUES ('movie-max', 'MOVIE MAX', 'MOVIE MAX — premium movies, series and entertainment, broadcasting 24 hours a day.',
        'https://5caf24a595d94.streamlock.net:1937/sykapjxrcp/sykapjxrcp/playlist.m3u8', 'Wowza Streaming Engine')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.stream_destinations (channel_id, provider, rtmp_url, stream_name, username)
SELECT id, 'Wowza Streaming Engine', 'rtmp://www.wowzacontrol.com:1935/sykapjxrcp', 'sykapjxrcp', 'sykapjxrcp'
FROM public.channels WHERE slug = 'movie-max'
ON CONFLICT (channel_id) DO NOTHING;

INSERT INTO public.graphics_overlays (channel_id, kind, name, enabled, config)
SELECT c.id, v.kind::public.overlay_kind, v.name, v.enabled, v.config::jsonb FROM public.channels c,
(VALUES
  ('logo','Channel logo / watermark', true, '{"position":"top-right","size":12,"opacity":0.85,"text":"MOVIE MAX"}'),
  ('on_air','ON AIR indicator', false, '{"position":"top-left","size":6,"opacity":1,"color":"#e5322d","text":"ON AIR"}'),
  ('now_showing','Now showing', false, '{"position":"bottom-left","size":30,"opacity":0.95,"duration":10}'),
  ('next_programme','Next programme', false, '{"position":"bottom-left","size":30,"opacity":0.95,"duration":10}'),
  ('clock','Local time', false, '{"position":"top-left","size":8,"opacity":0.9}'),
  ('ticker','Scrolling ticker', false, '{"position":"bottom","size":100,"opacity":0.95,"text":"Welcome to MOVIE MAX","speed":60,"color":"#e5322d"}'),
  ('breaking_news','Breaking news banner', false, '{"position":"bottom","size":100,"opacity":1,"text":"BREAKING NEWS","color":"#e5322d"}'),
  ('lower_third','Lower third', false, '{"position":"bottom-left","size":40,"opacity":0.95,"title":"Name","subtitle":"Role","color":"#e5322d"}')
) AS v(kind, name, enabled, config)
WHERE c.slug = 'movie-max'
  AND NOT EXISTS (SELECT 1 FROM public.graphics_overlays g WHERE g.channel_id = c.id);

INSERT INTO public.graphics_overlays (channel_id, kind, name, enabled, config)
SELECT c.id, 'ad_banner', 'Pop-up card', false,
  '{"position":"bottom-left","opacity":1,"size":44,"design":"step-left","badge":"STEP\n01","kicker":"DID YOU KNOW","title":"Your message here","duration":15,"show_mode":"once"}'::jsonb
FROM public.channels c
WHERE NOT EXISTS (SELECT 1 FROM public.graphics_overlays g WHERE g.channel_id = c.id AND g.kind = 'ad_banner');