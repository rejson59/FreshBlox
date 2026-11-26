-- The hardware signature must not decide on its own whether a device already has an account.
--
-- `fb_device_registrations.core_hw_ip_hash` was UNIQUE and the registration function matched
-- on any of (device token, browser fingerprint + IP, hardware signature + IP). The hardware
-- payload is deliberately coarse — screen, cores, memory, timezone, language, OS, GPU family —
-- so two identical machines on the same network (siblings, a school lab, an office) produced
-- the same value. The second person was denied registration for a device they never used, and
-- the account the server had just created for them was rolled back.
--
-- The column stays as a recorded signal for analysis, but it is no longer unique and is no
-- longer accepted as proof on its own by api/register-account.js: only the mirrored device
-- token or the browser fingerprint + IP can block a registration.
BEGIN;

ALTER TABLE public.fb_device_registrations
  DROP CONSTRAINT IF EXISTS fb_device_registrations_core_hw_ip_hash_key;
DROP INDEX IF EXISTS public.fb_device_registrations_core_hw_ip_hash_key;

COMMENT ON COLUMN public.fb_device_registrations.core_hw_ip_hash IS
  'Coarse hardware signature (screen, CPU, memory, timezone, language, OS, GPU family) hashed with the client IP. Recorded for analysis only — it is shared by identical machines and must never block a registration by itself.';

COMMIT;
