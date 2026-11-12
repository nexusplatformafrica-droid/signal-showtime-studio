INSERT INTO public.graphics_overlays (channel_id, kind, name, enabled, config)
SELECT c.id, 'ad_banner', 'Pop-up card', false,
  '{"position":"bottom-left","opacity":1,"size":44,"design":"step-left","badge":"STEP\n01","kicker":"DID YOU KNOW","title":"Your message here","duration":15,"show_mode":"once"}'::jsonb
FROM public.channels c
WHERE NOT EXISTS (SELECT 1 FROM public.graphics_overlays g WHERE g.channel_id = c.id AND g.kind = 'ad_banner');