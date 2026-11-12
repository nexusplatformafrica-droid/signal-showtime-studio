-- Where the playout engine pushes the channel (e.g. Wowza RTMP). Private: publish details must never be public.
CREATE TABLE public.stream_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL UNIQUE REFERENCES public.channels(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'Wowza Streaming Engine',
  rtmp_url text,
  stream_name text,
  username text,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stream_destinations TO authenticated;
GRANT ALL ON public.stream_destinations TO service_role;
ALTER TABLE public.stream_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators read stream destination" ON public.stream_destinations FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'station_manager'::app_role, 'broadcast_operator'::app_role]));
CREATE POLICY "managers manage stream destination" ON public.stream_destinations FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'station_manager'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'station_manager'::app_role]));

INSERT INTO public.stream_destinations (channel_id, provider, rtmp_url, stream_name, username)
SELECT id, 'Wowza Streaming Engine', 'rtmp://www.wowzacontrol.com:1935/sykapjxrcp', 'sykapjxrcp', 'sykapjxrcp'
FROM public.channels WHERE slug = 'movie-max'
ON CONFLICT (channel_id) DO NOTHING;

UPDATE public.channels
SET hls_url = 'http://www.wowzacontrol.com:1935/sykapjxrcp/sykapjxrcp/playlist.m3u8',
    streaming_provider = 'Wowza Streaming Engine'
WHERE slug = 'movie-max' AND hls_url IS NULL;