-- R2 room engine
DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.game_sessions'::regclass AND contype='u' LOOP
    EXECUTE format('ALTER TABLE public.game_sessions DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT now() + interval '4 hours',
  ADD COLUMN IF NOT EXISTS allow_late_join boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_status_chk CHECK (status IN ('lobby','starting','question','answering','reveal','leaderboard','finished'));
CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_active_pin_uidx ON public.game_sessions(pin) WHERE status <> 'finished';
CREATE INDEX IF NOT EXISTS game_sessions_host_idx ON public.game_sessions(host_id, created_at DESC);
CREATE TRIGGER game_sessions_updated_at BEFORE UPDATE ON public.game_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.players ADD CONSTRAINT players_team_chk CHECK (team IS NULL OR team IN ('a','b'));
CREATE UNIQUE INDEX IF NOT EXISTS players_session_nick_uidx ON public.players(session_id, lower(nickname));
CREATE INDEX IF NOT EXISTS players_session_idx ON public.players(session_id);

CREATE TABLE public.game_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  event text NOT NULL,
  player_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_events TO authenticated;
GRANT ALL ON public.game_events TO service_role;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY game_events_host_select ON public.game_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.host_id = auth.uid()));
CREATE INDEX game_events_session_idx ON public.game_events(session_id);

-- status transitions + analytics
CREATE OR REPLACE FUNCTION public.game_session_status_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'finished' AND NEW.status <> 'finished' THEN RAISE EXCEPTION 'session_finished'; END IF;
  IF NEW.status <> OLD.status THEN
    IF NEW.status = 'finished' THEN NEW.ended_at := now();
      INSERT INTO game_events(session_id, event) VALUES (NEW.id, 'game_finished');
    ELSIF OLD.status = 'lobby' THEN NEW.started_at := COALESCE(NEW.started_at, now());
      INSERT INTO game_events(session_id, event) VALUES (NEW.id, 'game_started');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER game_sessions_status_guard BEFORE UPDATE ON public.game_sessions FOR EACH ROW EXECUTE FUNCTION public.game_session_status_guard();
REVOKE EXECUTE ON FUNCTION public.game_session_status_guard() FROM PUBLIC, anon, authenticated;

-- create session (teacher)
CREATE OR REPLACE FUNCTION public.create_game_session(_activity_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pin text; _id uuid; _tries int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM activities WHERE id = _activity_id AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'not_found'; END IF;
  -- expire stale sessions so their PINs free up
  UPDATE game_sessions SET status = 'finished' WHERE status <> 'finished' AND expires_at < now();
  LOOP
    _tries := _tries + 1;
    _pin := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    BEGIN
      INSERT INTO game_sessions(activity_id, host_id, pin, status) VALUES (_activity_id, auth.uid(), _pin, 'lobby') RETURNING id INTO _id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF _tries > 20 THEN RAISE EXCEPTION 'pin_exhausted'; END IF;
    END;
  END LOOP;
  INSERT INTO game_events(session_id, event) VALUES (_id, 'game_created');
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_game_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game_session(uuid) TO authenticated;

-- public PIN lookup (minimal fields)
CREATE OR REPLACE FUNCTION public.lookup_game_pin(_pin text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF _pin !~ '^[0-9]{6}$' THEN RETURN jsonb_build_object('status','not_found'); END IF;
  SELECT g.*, a.title, a.game_mode INTO s FROM game_sessions g JOIN activities a ON a.id = g.activity_id
   WHERE g.pin = _pin ORDER BY (g.status <> 'finished') DESC, g.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF s.status = 'finished' THEN RETURN jsonb_build_object('status','finished'); END IF;
  IF s.expires_at < now() THEN RETURN jsonb_build_object('status','expired'); END IF;
  IF s.status <> 'lobby' AND NOT s.allow_late_join THEN RETURN jsonb_build_object('status','started'); END IF;
  RETURN jsonb_build_object('status','open','title',s.title,'game_mode',s.game_mode);
END $$;
GRANT EXECUTE ON FUNCTION public.lookup_game_pin(text) TO anon, authenticated;

-- join / reconnect
CREATE OR REPLACE FUNCTION public.join_game(_pin text, _nickname text, _token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE s record; p record; _nick text; _new_token text; _team text; _ca int; _cb int;
BEGIN
  IF _pin !~ '^[0-9]{6}$' THEN RETURN jsonb_build_object('error','not_found'); END IF;
  SELECT g.*, a.game_mode INTO s FROM game_sessions g JOIN activities a ON a.id = g.activity_id
   WHERE g.pin = _pin AND g.status <> 'finished' ORDER BY g.created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM game_sessions WHERE pin = _pin) THEN RETURN jsonb_build_object('error','finished'); END IF;
    RETURN jsonb_build_object('error','not_found');
  END IF;
  IF s.expires_at < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext(s.id::text));

  -- reconnect with token
  IF _token IS NOT NULL AND length(_token) BETWEEN 32 AND 128 THEN
    SELECT * INTO p FROM players WHERE session_id = s.id AND token_hash = encode(digest(_token, 'sha256'), 'hex');
    IF FOUND THEN
      UPDATE players SET last_seen_at = now() WHERE id = p.id;
      RETURN jsonb_build_object('player_id', p.id, 'session_id', s.id, 'token', _token, 'reconnected', true);
    END IF;
  END IF;

  IF s.status <> 'lobby' AND NOT s.allow_late_join THEN RETURN jsonb_build_object('error','started'); END IF;
  _nick := regexp_replace(btrim(coalesce(_nickname,'')), '\s+', ' ', 'g');
  _nick := regexp_replace(_nick, '[<>\x00-\x1F]', '', 'g');
  IF length(_nick) < 2 THEN RETURN jsonb_build_object('error','nick_short'); END IF;
  IF length(_nick) > 20 THEN RETURN jsonb_build_object('error','nick_long'); END IF;
  IF EXISTS (SELECT 1 FROM players WHERE session_id = s.id AND lower(nickname) = lower(_nick)) THEN
    RETURN jsonb_build_object('error','nick_taken');
  END IF;
  IF (SELECT count(*) FROM players WHERE session_id = s.id) >= 200 THEN RETURN jsonb_build_object('error','full'); END IF;

  IF s.game_mode = 'cabo' THEN
    SELECT count(*) FILTER (WHERE team='a'), count(*) FILTER (WHERE team='b') INTO _ca, _cb FROM players WHERE session_id = s.id;
    _team := CASE WHEN _ca <= _cb THEN 'a' ELSE 'b' END;
  END IF;
  _new_token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO players(session_id, nickname, team, token_hash)
    VALUES (s.id, _nick, _team, encode(digest(_new_token, 'sha256'), 'hex')) RETURNING * INTO p;
  INSERT INTO game_events(session_id, event, player_id) VALUES (s.id, 'player_joined', p.id);
  RETURN jsonb_build_object('player_id', p.id, 'session_id', s.id, 'token', _new_token, 'reconnected', false);
END $$;
GRANT EXECUTE ON FUNCTION public.join_game(text, text, text) TO anon, authenticated;

-- player state (token-authenticated; never includes answers)
CREATE OR REPLACE FUNCTION public.get_player_state(_player_id uuid, _token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r record;
BEGIN
  SELECT p.id, p.nickname, p.team, p.score, g.id AS session_id, g.status, g.expires_at, g.pin,
         a.title, a.game_mode, a.team_a_name, a.team_b_name, a.team_a_color, a.team_b_color
    INTO r FROM players p JOIN game_sessions g ON g.id = p.session_id JOIN activities a ON a.id = g.activity_id
   WHERE p.id = _player_id AND p.token_hash = encode(digest(coalesce(_token,''), 'sha256'), 'hex');
  IF NOT FOUND THEN RETURN jsonb_build_object('error','invalid'); END IF;
  UPDATE players SET last_seen_at = now() WHERE id = _player_id;
  RETURN to_jsonb(r) - 'expires_at';
END $$;
GRANT EXECUTE ON FUNCTION public.get_player_state(uuid, text) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;