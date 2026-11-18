-- Casual solo training only. One live race per user; clients never write a balance or submit a price/prize.
-- Apply to staging first. Independent of the legacy profile sync and of public profile SELECT policies.
BEGIN;
CREATE TABLE public.fb_coin_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  owned text[] NOT NULL DEFAULT '{}',
  run_id uuid, lap integer NOT NULL DEFAULT 0 CHECK (lap BETWEEN 0 AND 3),
  started_at timestamptz, last_lap_at timestamptz
);
ALTER TABLE public.fb_coin_wallets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fb_coin_wallets FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, balance, owned) ON public.fb_coin_wallets TO authenticated;
CREATE POLICY fb_read_own_wallet ON public.fb_coin_wallets FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE TABLE public.fb_coin_prices (item text PRIMARY KEY, price integer NOT NULL CHECK (price > 0));
ALTER TABLE public.fb_coin_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fb_coin_prices FROM PUBLIC, anon, authenticated;
-- Only normal purchasable cosmetics. Keep in step with catalog.ts (covered by the migration test).
INSERT INTO public.fb_coin_prices (item,price) VALUES
  ('classic-remaster',340),
  ('arctic-frost',540),
  ('midnight-slate',720),
  ('glacier-captain',990),
  ('crystal-royal',1530),
  ('wink-pro',360),
  ('arctic-visor',410),
  ('cool-shades',500),
  ('star-eyes',680),
  ('fresh-cap',360),
  ('headphones',630),
  ('crystal-halo',860),
  ('frost-horns',1040),
  ('arctic-crown',1580),
  ('arctic-sparks',360),
  ('portal-duality',360),
  ('neon-comet',360),
  ('emerald-pulse',360),
  ('crystal-wings',360),
  ('portal-jetpack',360),
  ('arctic-backpack',360),
  ('cyber-cape',360),
  ('frost-cube',360),
  ('portal-drone',360),
  ('star-owl',360),
  ('plasma-orb',360);

CREATE FUNCTION public.fb_kart_begin() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); token uuid := gen_random_uuid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  INSERT INTO public.fb_coin_wallets (user_id,run_id,started_at,last_lap_at) VALUES(uid,token,now(),now())
    ON CONFLICT(user_id) DO UPDATE SET run_id=EXCLUDED.run_id, lap=0, started_at=now(), last_lap_at=now();
  RETURN token;
END $$;

CREATE FUNCTION public.fb_kart_lap(p_run uuid, p_lap integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.fb_coin_wallets; prize integer;
BEGIN
  SELECT * INTO w FROM public.fb_coin_wallets WHERE user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR p_run IS NULL OR w.run_id IS DISTINCT FROM p_run OR p_lap IS NULL OR p_lap NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Invalid race'; END IF;
  prize := CASE p_lap WHEN 3 THEN 80 ELSE 15 END;
  -- Retry after a lost response: report the current balance but never credit the same lap twice.
  IF p_lap <= w.lap THEN RETURN jsonb_build_object('balance', w.balance, 'reward', prize, 'new_credit', false); END IF;
  IF p_lap <> w.lap+1 OR now()-w.last_lap_at < interval '6 seconds' OR now()-w.started_at > interval '2 hours' THEN RAISE EXCEPTION 'Invalid lap'; END IF;
  UPDATE public.fb_coin_wallets SET lap=p_lap,last_lap_at=now(),balance=balance+prize WHERE user_id=w.user_id RETURNING balance INTO w.balance;
  RETURN jsonb_build_object('balance',w.balance,'reward',prize,'new_credit',true);
END $$;

CREATE FUNCTION public.fb_coin_buy(p_item text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.fb_coin_wallets; cost integer;
BEGIN
  SELECT price INTO cost FROM public.fb_coin_prices WHERE item=p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not sold for FreshCoins'; END IF;
  SELECT * INTO w FROM public.fb_coin_wallets WHERE user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No wallet'; END IF;
  IF NOT p_item=ANY(w.owned) THEN
    IF cost > w.balance THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
    UPDATE public.fb_coin_wallets SET balance=balance-cost,owned=array_append(owned,p_item) WHERE user_id=w.user_id RETURNING * INTO w;
  END IF;
  RETURN jsonb_build_object('balance', w.balance, 'owned', w.owned);
END $$;
REVOKE ALL ON FUNCTION public.fb_kart_begin(), public.fb_kart_lap(uuid,integer), public.fb_coin_buy(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fb_kart_begin(), public.fb_kart_lap(uuid,integer), public.fb_coin_buy(text) TO authenticated;
COMMIT;
