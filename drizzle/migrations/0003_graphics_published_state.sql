ALTER TABLE public.graphics_overlays
  ADD COLUMN IF NOT EXISTS published_config jsonb,
  ADD COLUMN IF NOT EXISTS published_enabled boolean NOT NULL DEFAULT false;

-- Whatever was last published becomes the live state, so drafts never leak on air.
UPDATE public.graphics_overlays
SET published_config = config, published_enabled = enabled
WHERE published_at IS NOT NULL AND published_config IS NULL;