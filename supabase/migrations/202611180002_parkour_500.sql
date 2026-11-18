-- Preserve the old 100-stage PB separately; times from different courses are not comparable.
ALTER TABLE public.fb_profiles ADD COLUMN IF NOT EXISTS parkour_500_best_time_ms integer;
