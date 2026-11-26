-- Progress counters may only grow.
--
-- The client syncs its whole profile with a 650 ms debounce and the last write wins. Two
-- tabs, a tab restored from the back/forward cache, or a laptop that wakes up after a long
-- sleep can therefore push a stale snapshot over newer progress: XP and unlocked stages
-- silently went backwards. This trigger makes the database the arbiter: a stale write can
-- never undo a record.
--
-- Deliberately NOT covered:
--   * `fresh_gems` — spending gems legitimately lowers the balance,
--   * `obby_stage`  — the player moves back and forth between checkpoints,
--   * `saved_outfits` / `badges` / `unlocked_items` — the player can delete or unequip, and
--     merging arrays here would resurrect data an administrator removed.
--
-- This is a correctness guard, not an anti-cheat measure: a client can still raise these
-- numbers directly (see README, "Co jeszcze wymaga decyzji produktowej").
BEGIN;

CREATE OR REPLACE FUNCTION public.fb_keep_profile_counters_monotonic()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.xp := GREATEST(COALESCE(NEW.xp, 0), COALESCE(OLD.xp, 0));
  NEW.obby_best_stage := GREATEST(COALESCE(NEW.obby_best_stage, 1), COALESCE(OLD.obby_best_stage, 1));
  NEW.obby_completions := GREATEST(COALESCE(NEW.obby_completions, 0), COALESCE(OLD.obby_completions, 0));
  NEW.arena_eliminations := GREATEST(COALESCE(NEW.arena_eliminations, 0), COALESCE(OLD.arena_eliminations, 0));
  NEW.arena_wins := GREATEST(COALESCE(NEW.arena_wins, 0), COALESCE(OLD.arena_wins, 0));
  NEW.arena_best_speed := GREATEST(COALESCE(NEW.arena_best_speed, 0), COALESCE(OLD.arena_best_speed, 0));
  NEW.frisbee_wins := GREATEST(COALESCE(NEW.frisbee_wins, 0), COALESCE(OLD.frisbee_wins, 0));
  NEW.frisbee_slices := GREATEST(COALESCE(NEW.frisbee_slices, 0), COALESCE(OLD.frisbee_slices, 0));
  NEW.frisbee_catches := GREATEST(COALESCE(NEW.frisbee_catches, 0), COALESCE(OLD.frisbee_catches, 0));

  -- A best time gets better by getting smaller; NULL means "never finished".
  IF OLD.parkour_500_best_time_ms IS NOT NULL THEN
    NEW.parkour_500_best_time_ms := LEAST(
      COALESCE(NEW.parkour_500_best_time_ms, OLD.parkour_500_best_time_ms),
      OLD.parkour_500_best_time_ms
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fb_monotonic_counters ON public.fb_profiles;
CREATE TRIGGER trg_fb_monotonic_counters
  BEFORE UPDATE ON public.fb_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fb_keep_profile_counters_monotonic();

COMMIT;
