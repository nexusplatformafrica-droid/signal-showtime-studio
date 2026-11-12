
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','station_manager','broadcast_operator','media_manager','graphics_designer','advertising_manager','analyst');
CREATE TYPE public.media_category AS ENUM ('movie','series','episode','music_video','news','documentary','advertisement','trailer','promo','station_id','emergency','other');
CREATE TYPE public.media_status AS ENUM ('uploading','processing','ready','failed','archived');
CREATE TYPE public.schedule_mode AS ENUM ('fixed','follow_on','flexible_playlist');
CREATE TYPE public.schedule_status AS ENUM ('draft','published','cancelled');
CREATE TYPE public.channel_visibility AS ENUM ('public','registration','private');
CREATE TYPE public.playlist_kind AS ENUM ('morning','afternoon','prime_time','night','marathon','music','advertisement','emergency','standby','custom');
CREATE TYPE public.broadcast_source AS ENUM ('none','schedule','live','emergency','standby');
CREATE TYPE public.command_type AS ENUM ('play','pause','stop','skip','take_live','end_live','return_to_schedule','emergency_takeover','play_standby','switch_source','reload_schedule');
CREATE TYPE public.command_status AS ENUM ('queued','acknowledged','completed','failed','expired');
CREATE TYPE public.ingest_protocol AS ENUM ('rtmp','rtmps','srt','webrtc');
CREATE TYPE public.overlay_kind AS ENUM ('logo','on_air','now_showing','next_programme','clock','ticker','ad_banner','programme_title','breaking_news','live_indicator','countdown','station_id','lower_third');

-- ============ UPDATED_AT helper ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES & ROLES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE POLICY "own profile readable" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager']::public.app_role[]));
CREATE POLICY "own profile editable" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "read own roles or admin reads all" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin grants roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin revokes roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Signup: create profile; the very first account becomes Super Admin (station bootstrap).
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CHANNELS ============
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text,
  timezone text NOT NULL DEFAULT 'Africa/Kampala',
  language text NOT NULL DEFAULT 'en',
  visibility public.channel_visibility NOT NULL DEFAULT 'public',
  logo_url text,
  default_quality text NOT NULL DEFAULT 'auto',
  hls_url text,
  player_url text,
  website_url text,
  custom_domain text,
  streaming_provider text,
  output_resolution text NOT NULL DEFAULT '1920x1080',
  output_fps integer NOT NULL DEFAULT 25 CHECK (output_fps BETWEEN 10 AND 60),
  video_bitrate_kbps integer NOT NULL DEFAULT 4500 CHECK (video_bitrate_kbps BETWEEN 300 AND 50000),
  audio_bitrate_kbps integer NOT NULL DEFAULT 128 CHECK (audio_bitrate_kbps BETWEEN 32 AND 512),
  hls_segment_seconds integer NOT NULL DEFAULT 4 CHECK (hls_segment_seconds BETWEEN 1 AND 12),
  auto_restart boolean NOT NULL DEFAULT true,
  live_return_behaviour text NOT NULL DEFAULT 'resume_schedule' CHECK (live_return_behaviour IN ('resume_programme','skip_next','resume_schedule')),
  standby_media_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.channels TO anon;
GRANT SELECT, UPDATE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels are public" ON public.channels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "managers edit channel" ON public.channels FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager']::public.app_role[]));
CREATE TRIGGER channels_updated BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.channels (slug, name, description) VALUES
  ('movie-max', 'MOVIE MAX', 'MOVIE MAX — premium movies, series and entertainment, broadcasting 24 hours a day.');

-- ============ MEDIA ============
CREATE TABLE public.media_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.media_folders(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_folders TO authenticated;
GRANT ALL ON public.media_folders TO service_role;
ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read folders" ON public.media_folders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "media roles write folders" ON public.media_folders FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager']::public.app_role[]));

CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.media_folders(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text,
  category public.media_category NOT NULL DEFAULT 'other',
  classification text,
  tags text[] NOT NULL DEFAULT '{}',
  duration_seconds numeric(12,3) CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  width integer,
  height integer,
  container text,
  mime_type text,
  audio_info text,
  original_filename text,
  fingerprint text,
  storage_bucket text,
  storage_key text,
  thumbnail_url text,
  status public.media_status NOT NULL DEFAULT 'uploading',
  available boolean NOT NULL DEFAULT true,
  upload_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX media_assets_channel_idx ON public.media_assets (channel_id, created_at DESC);
CREATE INDEX media_assets_category_idx ON public.media_assets (channel_id, category);
CREATE INDEX media_assets_fingerprint_idx ON public.media_assets (channel_id, fingerprint);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read media" ON public.media_assets FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "media roles insert" ON public.media_assets FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager']::public.app_role[]));
CREATE POLICY "media roles update" ON public.media_assets FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager']::public.app_role[]));
CREATE POLICY "media roles delete" ON public.media_assets FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager']::public.app_role[]));
CREATE TRIGGER media_updated BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.channels ADD CONSTRAINT channels_standby_fk FOREIGN KEY (standby_media_id) REFERENCES public.media_assets(id) ON DELETE SET NULL;

-- ============ PLAYLISTS ============
CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  kind public.playlist_kind NOT NULL DEFAULT 'custom',
  shuffle boolean NOT NULL DEFAULT false,
  repeat boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read playlists" ON public.playlists FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "programming roles write playlists" ON public.playlists FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager']::public.app_role[]));
CREATE TRIGGER playlists_updated BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX playlist_items_pl_idx ON public.playlist_items (playlist_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_items TO authenticated;
GRANT ALL ON public.playlist_items TO service_role;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read playlist items" ON public.playlist_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "programming roles write playlist items" ON public.playlist_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager']::public.app_role[]));

-- ============ SCHEDULE ============
CREATE TABLE public.recurring_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  rule jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_schedules TO authenticated;
GRANT ALL ON public.recurring_schedules TO service_role;
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read recurrences" ON public.recurring_schedules FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "schedulers write recurrences" ON public.recurring_schedules FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','advertising_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','advertising_manager']::public.app_role[]));

CREATE TABLE public.schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text,
  category public.media_category NOT NULL DEFAULT 'other',
  thumbnail_url text,
  mode public.schedule_mode NOT NULL DEFAULT 'fixed',
  media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  playlist_id uuid REFERENCES public.playlists(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 100),
  status public.schedule_status NOT NULL DEFAULT 'draft',
  notes text,
  recurrence_id uuid REFERENCES public.recurring_schedules(id) ON DELETE SET NULL,
  is_commercial_break boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_time_order CHECK (ends_at > starts_at)
);
CREATE INDEX schedule_entries_time_idx ON public.schedule_entries (channel_id, starts_at);
CREATE INDEX schedule_entries_status_idx ON public.schedule_entries (channel_id, status, starts_at);
GRANT SELECT ON public.schedule_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_entries TO authenticated;
GRANT ALL ON public.schedule_entries TO service_role;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published schedule is public" ON public.schedule_entries FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "staff read all schedule" ON public.schedule_entries FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "schedulers write schedule" ON public.schedule_entries FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','advertising_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','advertising_manager']::public.app_role[]));
CREATE TRIGGER schedule_updated BEFORE UPDATE ON public.schedule_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LIVE INPUTS (private stream keys) ============
CREATE TABLE public.live_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  protocol public.ingest_protocol NOT NULL DEFAULT 'rtmps',
  ingest_url text,
  stream_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  connected boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  bitrate_kbps integer,
  resolution text,
  fps numeric(6,2),
  audio_ok boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_inputs TO authenticated;
GRANT ALL ON public.live_inputs TO service_role;
ALTER TABLE public.live_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators manage live inputs" ON public.live_inputs FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','broadcast_operator']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','broadcast_operator']::public.app_role[]));
CREATE TRIGGER live_inputs_updated BEFORE UPDATE ON public.live_inputs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BROADCAST STATUS (written only by the playout engine) ============
CREATE TABLE public.broadcast_status (
  channel_id uuid PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
  on_air boolean NOT NULL DEFAULT false,
  source public.broadcast_source NOT NULL DEFAULT 'none',
  current_entry_id uuid,
  current_media_id uuid,
  current_title text,
  next_title text,
  position_seconds numeric(12,3),
  duration_seconds numeric(12,3),
  output_resolution text,
  output_bitrate_kbps integer,
  output_fps numeric(6,2),
  encoder_status text,
  destination_status text,
  active_live_input_id uuid,
  engine_version text,
  engine_host text,
  last_error text,
  last_heartbeat_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broadcast_status TO anon, authenticated;
GRANT ALL ON public.broadcast_status TO service_role;
ALTER TABLE public.broadcast_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broadcast status is public" ON public.broadcast_status FOR SELECT TO anon, authenticated USING (true);

-- ============ COMMANDS (dashboard -> engine queue) ============
CREATE TABLE public.broadcast_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  command public.command_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.command_status NOT NULL DEFAULT 'queued',
  result text,
  issued_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX broadcast_commands_queue_idx ON public.broadcast_commands (channel_id, status, created_at);
GRANT SELECT, INSERT ON public.broadcast_commands TO authenticated;
GRANT ALL ON public.broadcast_commands TO service_role;
ALTER TABLE public.broadcast_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read commands" ON public.broadcast_commands FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operators issue commands" ON public.broadcast_commands FOR INSERT TO authenticated
  WITH CHECK (
    issued_by = auth.uid() AND status = 'queued' AND
    public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','broadcast_operator']::public.app_role[]) AND
    (command <> 'emergency_takeover' OR public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager']::public.app_role[]))
  );

-- ============ EVENTS / LOGS ============
CREATE TABLE public.broadcast_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  entry_id uuid,
  media_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX broadcast_events_time_idx ON public.broadcast_events (channel_id, occurred_at DESC);
GRANT SELECT ON public.broadcast_events TO authenticated;
GRANT ALL ON public.broadcast_events TO service_role;
ALTER TABLE public.broadcast_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read events" ON public.broadcast_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ============ STREAM HEALTH CHECKS ============
CREATE TABLE public.stream_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text NOT NULL CHECK (status IN ('on_air','connected','offline','error','not_configured')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_by uuid,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stream_health_checks_idx ON public.stream_health_checks (channel_id, checked_at DESC);
GRANT SELECT ON public.stream_health_checks TO authenticated;
GRANT ALL ON public.stream_health_checks TO service_role;
ALTER TABLE public.stream_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read health" ON public.stream_health_checks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ============ ENGINE TOKENS (hashed) ============
CREATE TABLE public.engine_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  label text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
GRANT SELECT, UPDATE ON public.engine_tokens TO authenticated;
GRANT ALL ON public.engine_tokens TO service_role;
ALTER TABLE public.engine_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin reads tokens" ON public.engine_tokens FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin revokes tokens" ON public.engine_tokens FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============ GRAPHICS ============
CREATE TABLE public.graphics_overlays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  kind public.overlay_kind NOT NULL,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  show_from timestamptz,
  show_until timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.graphics_overlays TO authenticated;
GRANT ALL ON public.graphics_overlays TO service_role;
ALTER TABLE public.graphics_overlays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read graphics" ON public.graphics_overlays FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "graphics roles write" ON public.graphics_overlays FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','graphics_designer']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','graphics_designer']::public.app_role[]));
CREATE TRIGGER graphics_updated BEFORE UPDATE ON public.graphics_overlays FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
WHERE c.slug = 'movie-max';

-- ============ VIEWER SESSIONS ============
CREATE TABLE public.viewer_sessions (
  id uuid PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid,
  device text,
  platform text,
  country text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  watch_seconds integer NOT NULL DEFAULT 0
);
CREATE INDEX viewer_sessions_seen_idx ON public.viewer_sessions (channel_id, last_seen_at DESC);
GRANT SELECT ON public.viewer_sessions TO authenticated;
GRANT ALL ON public.viewer_sessions TO service_role;
ALTER TABLE public.viewer_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read viewers" ON public.viewer_sessions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_time_idx ON public.audit_logs (created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager']::public.app_role[]));

CREATE OR REPLACE FUNCTION public.audit_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec jsonb; label text;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := to_jsonb(OLD); ELSE rec := to_jsonb(NEW); END IF;
  rec := rec - 'stream_key' - 'token_hash';
  label := COALESCE(rec->>'title', rec->>'name', rec->>'command', rec->>'role');
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, COALESCE(rec->>'id', rec->>'channel_id'),
          jsonb_build_object('label', label, 'status', rec->>'status'));
  RETURN NULL;
END; $$;

CREATE TRIGGER audit_media AFTER INSERT OR UPDATE OR DELETE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_schedule AFTER INSERT OR UPDATE OR DELETE ON public.schedule_entries FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_playlists AFTER INSERT OR UPDATE OR DELETE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_live_inputs AFTER INSERT OR UPDATE OR DELETE ON public.live_inputs FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_channels AFTER UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_roles AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_commands AFTER INSERT ON public.broadcast_commands FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_graphics AFTER INSERT OR UPDATE OR DELETE ON public.graphics_overlays FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_tokens AFTER INSERT OR UPDATE ON public.engine_tokens FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_inputs;
