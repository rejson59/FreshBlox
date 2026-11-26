-- Aligns the social tables with what the client actually queries.
--
-- `supabase/schema.sql` used to describe these tables with different column names than
-- src/lib/socialApi.ts selects (`body`/`invite_room`/`invite_world`/`code`/`world` versus
-- `content`/`room_invite_code`/`room_invite_world`/`room_code`/`world_kind`). A database
-- rebuilt from this repository therefore served empty DM threads and empty private-room
-- lists. This migration is defensive in both directions:
--
--   * on a database that already uses the client's names it is a no-op,
--   * on a database created from the old description it renames the columns in place,
--   * the CHECK constraints are widened for the arena and frisbee worlds either way.
--
-- Verified against a PGlite instance in tests/schema.test.mjs (applied twice).
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_private_rooms' AND column_name = 'code'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_private_rooms' AND column_name = 'room_code'
  ) THEN
    ALTER TABLE public.fb_private_rooms RENAME COLUMN code TO room_code;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_private_rooms' AND column_name = 'world'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_private_rooms' AND column_name = 'world_kind'
  ) THEN
    ALTER TABLE public.fb_private_rooms RENAME COLUMN world TO world_kind;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_direct_messages' AND column_name = 'body'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_direct_messages' AND column_name = 'content'
  ) THEN
    ALTER TABLE public.fb_direct_messages RENAME COLUMN body TO content;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_direct_messages' AND column_name = 'invite_room'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_direct_messages' AND column_name = 'room_invite_code'
  ) THEN
    ALTER TABLE public.fb_direct_messages RENAME COLUMN invite_room TO room_invite_code;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_direct_messages' AND column_name = 'invite_world'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_direct_messages' AND column_name = 'room_invite_world'
  ) THEN
    ALTER TABLE public.fb_direct_messages RENAME COLUMN invite_world TO room_invite_world;
  END IF;
END $$;

-- Old CHECK constraints referred to the old column names and only knew about lobby/obby.
ALTER TABLE public.fb_private_rooms DROP CONSTRAINT IF EXISTS fb_private_rooms_world_check;
ALTER TABLE public.fb_private_rooms DROP CONSTRAINT IF EXISTS fb_private_rooms_world_kind_check;
ALTER TABLE public.fb_private_rooms
  ADD CONSTRAINT fb_private_rooms_world_kind_check
  CHECK (world_kind IN ('lobby', 'obby', 'arena', 'frisbee'));

ALTER TABLE public.fb_direct_messages DROP CONSTRAINT IF EXISTS fb_direct_messages_invite_world_check;
ALTER TABLE public.fb_direct_messages DROP CONSTRAINT IF EXISTS fb_direct_messages_room_invite_world_check;
ALTER TABLE public.fb_direct_messages
  ADD CONSTRAINT fb_direct_messages_room_invite_world_check
  CHECK (room_invite_world IS NULL OR room_invite_world IN ('lobby', 'obby', 'arena', 'frisbee'));

ALTER TABLE public.fb_direct_messages DROP CONSTRAINT IF EXISTS fb_direct_messages_body_check;
ALTER TABLE public.fb_direct_messages DROP CONSTRAINT IF EXISTS fb_direct_messages_content_check;
ALTER TABLE public.fb_direct_messages
  ADD CONSTRAINT fb_direct_messages_content_check
  CHECK (char_length(content) BETWEEN 1 AND 240);

COMMIT;
