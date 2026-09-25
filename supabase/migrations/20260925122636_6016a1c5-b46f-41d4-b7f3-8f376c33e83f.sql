-- R3 GAME ENGINE
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS current_question int NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS question_ids uuid[],
  ADD COLUMN IF NOT EXISTS question_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS question_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS question_duration_s smallint NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS state_version int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS results jsonb;

ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS score_awarded int NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS answers_one_per_question_uidx ON public.answers(session_id, question_id, player_id);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS correct_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correct_time_ms bigint NOT NULL DEFAULT 0;

-- Server is authoritative: teachers no longer write session state / answers / scores directly.
REVOKE UPDATE ON public.game_sessions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.answers FROM authenticated;
REVOKE UPDATE ON public.players FROM authenticated;
GRANT UPDATE (team) ON public.players TO authenticated;

CREATE OR REPLACE FUNCTION public.game_session_status_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'finished' AND NEW.status <> 'finished' THEN RAISE EXCEPTION 'session_finished'; END IF;
  IF NEW.status <> OLD.status OR NEW.current_question <> OLD.current_question THEN
    NEW.state_version := OLD.state_version + 1;
  END IF;
  IF NEW.status <> OLD.status THEN
    IF NEW.status = 'finished' THEN NEW.ended_at := now();
      INSERT INTO game_events(session_id, event) VALUES (NEW.id, 'game_finished');
    ELSIF OLD.status = 'lobby' THEN NEW.started_at := COALESCE(NEW.started_at, now());
      INSERT INTO game_events(session_id, event) VALUES (NEW.id, 'game_started');
    ELSIF NEW.status = 'question' THEN
      INSERT INTO game_events(session_id, event) VALUES (NEW.id, 'question_started');
    ELSIF NEW.status = 'reveal' THEN
      INSERT INTO game_events(session_id, event) VALUES (NEW.id, 'question_finished');
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Pure scoring formula (single source of truth).
-- correct: 1000 + round(500 * remaining/duration); wrong or no answer: 0.
CREATE OR REPLACE FUNCTION public.calculate_score(_correct boolean, _elapsed_ms int, _duration_s int) RETURNS int
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN NOT _correct THEN 0
    ELSE 1000 + round(500 * greatest(0, least(1, 1 - _elapsed_ms::numeric / (_duration_s * 1000))))::int END
$$;

-- Close current question exactly once (caller must hold row lock).
CREATE OR REPLACE FUNCTION public._room_close_question(_sid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; qid uuid;
BEGIN
  SELECT * INTO s FROM game_sessions WHERE id = _sid;
  IF s.status <> 'question' THEN RETURN; END IF;
  qid := s.question_ids[s.current_question + 1];
  UPDATE players p SET score = p.score + a.score_awarded,
      correct_count = p.correct_count + (CASE WHEN a.is_correct THEN 1 ELSE 0 END),
      correct_time_ms = p.correct_time_ms + (CASE WHEN a.is_correct THEN coalesce(a.response_ms,0) ELSE 0 END)
    FROM answers a WHERE a.session_id = _sid AND a.question_id = qid AND a.player_id = p.id;
  UPDATE game_sessions SET status = 'reveal' WHERE id = _sid;
END $$;

-- Lazy, idempotent time-based transitions.
CREATE OR REPLACE FUNCTION public._room_tick(_sid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; np int; na int; need boolean := false;
BEGIN
  SELECT * INTO s FROM game_sessions WHERE id = _sid;
  IF NOT FOUND THEN RETURN; END IF;
  IF s.status = 'starting' AND now() >= s.question_started_at THEN need := true; END IF;
  IF s.status = 'question' THEN
    IF now() >= s.question_ends_at THEN need := true;
    ELSE
      SELECT count(*) INTO np FROM players WHERE session_id = _sid;
      SELECT count(*) INTO na FROM answers WHERE session_id = _sid AND question_id = s.question_ids[s.current_question + 1];
      IF np > 0 AND na >= np THEN need := true; END IF;
    END IF;
  END IF;
  IF NOT need THEN RETURN; END IF;

  SELECT * INTO s FROM game_sessions WHERE id = _sid FOR UPDATE;
  IF s.status = 'starting' AND now() >= s.question_started_at THEN
    UPDATE game_sessions SET status = 'question' WHERE id = _sid;
    s.status := 'question';
  END IF;
  IF s.status = 'question' THEN
    SELECT count(*) INTO np FROM players WHERE session_id = _sid;
    SELECT count(*) INTO na FROM answers WHERE session_id = _sid AND question_id = s.question_ids[s.current_question + 1];
    IF now() >= s.question_ends_at OR (np > 0 AND na >= np) THEN PERFORM _room_close_question(_sid); END IF;
  END IF;
END $$;

-- Final results (persisted on game_sessions.results).
CREATE OR REPLACE FUNCTION public._room_results(_sid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; asked int; np int; per_q jsonb; ranking jsonb; ta int; tb int; tot_ans int; tot_ok int;
BEGIN
  SELECT g.*, a.game_mode INTO s FROM game_sessions g JOIN activities a ON a.id = g.activity_id WHERE g.id = _sid;
  asked := greatest(0, s.current_question + 1);
  SELECT count(*) INTO np FROM players WHERE session_id = _sid;
  SELECT count(*), count(*) FILTER (WHERE is_correct) INTO tot_ans, tot_ok FROM answers WHERE session_id = _sid;
  SELECT coalesce(jsonb_agg(x ORDER BY x.position), '[]') INTO per_q FROM (
    SELECT i AS position, q.prompt,
      (SELECT count(*) FROM answers an WHERE an.session_id = _sid AND an.question_id = q.id AND an.is_correct) AS correct,
      (SELECT count(*) FROM answers an WHERE an.session_id = _sid AND an.question_id = q.id) AS answered
    FROM unnest(s.question_ids[1:asked]) WITH ORDINALITY AS u(qid, i) JOIN questions q ON q.id = u.qid) x;
  SELECT coalesce(jsonb_agg(r ORDER BY r.rank, r.nickname), '[]') INTO ranking FROM (
    SELECT nickname, team, score, correct_count,
      rank() OVER (ORDER BY score DESC, correct_count DESC, correct_time_ms ASC) AS rank
    FROM players WHERE session_id = _sid) r;
  SELECT coalesce(sum(score) FILTER (WHERE team='a'),0), coalesce(sum(score) FILTER (WHERE team='b'),0) INTO ta, tb FROM players WHERE session_id = _sid;
  RETURN jsonb_build_object(
    'participants', np, 'questions_asked', asked, 'total_answers', tot_ans,
    'accuracy_pct', CASE WHEN np * asked = 0 THEN 0 ELSE round(100.0 * tot_ok / (np * asked)) END,
    'per_question', per_q, 'ranking', ranking,
    'team_a_score', ta, 'team_b_score', tb,
    'duration_s', greatest(0, extract(epoch FROM (now() - coalesce(s.started_at, s.created_at)))::int));
END $$;

-- Shared authorized view of the room. Correct answer/explanation only after the question closes.
CREATE OR REPLACE FUNCTION public._room_view(_sid uuid, _player_id uuid, _host boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; q record; v jsonb; revealed boolean; total int; qid uuid; dist jsonb; ranking jsonb; me jsonb; my_ans record;
  ta int; tb int; ra int; rb int; answered int; np int;
BEGIN
  SELECT g.*, a.title, a.game_mode, a.team_a_name, a.team_b_name, a.team_a_color, a.team_b_color
    INTO s FROM game_sessions g JOIN activities a ON a.id = g.activity_id WHERE g.id = _sid;
  total := coalesce(array_length(s.question_ids, 1), 0);
  revealed := s.status IN ('reveal','leaderboard','finished');
  SELECT count(*) INTO np FROM players WHERE session_id = _sid;
  SELECT coalesce(sum(score) FILTER (WHERE team='a'),0), coalesce(sum(score) FILTER (WHERE team='b'),0) INTO ta, tb FROM players WHERE session_id = _sid;

  v := jsonb_build_object('session_id', s.id, 'status', s.status, 'version', s.state_version, 'server_now', now(),
    'title', s.title, 'game_mode', s.game_mode, 'pin', s.pin,
    'team_a_name', s.team_a_name, 'team_b_name', s.team_b_name, 'team_a_color', s.team_a_color, 'team_b_color', s.team_b_color,
    'question_index', s.current_question, 'total_questions', total, 'players_count', np,
    'question_started_at', s.question_started_at, 'question_ends_at', s.question_ends_at, 'duration_s', s.question_duration_s,
    'max_score', total * 1500, 'team_a_score', ta, 'team_b_score', tb);

  IF s.current_question >= 0 AND s.status <> 'finished' THEN
    qid := s.question_ids[s.current_question + 1];
    SELECT id, prompt, options, correct_index, explanation INTO q FROM questions WHERE id = qid;
    SELECT count(*) INTO answered FROM answers WHERE session_id = _sid AND question_id = qid;
    v := v || jsonb_build_object('answered_count', answered,
      'question', jsonb_build_object('id', q.id, 'prompt', q.prompt, 'options', q.options));
    IF revealed THEN
      SELECT coalesce(jsonb_agg(c ORDER BY i), '[]') INTO dist FROM (
        SELECT i, (SELECT count(*) FROM answers an WHERE an.session_id = _sid AND an.question_id = qid AND an.selected_index = i - 1) c
        FROM generate_series(1, jsonb_array_length(q.options)) i) d;
      SELECT coalesce(sum(an.score_awarded) FILTER (WHERE p.team='a'),0), coalesce(sum(an.score_awarded) FILTER (WHERE p.team='b'),0)
        INTO ra, rb FROM answers an JOIN players p ON p.id = an.player_id WHERE an.session_id = _sid AND an.question_id = qid;
      v := v || jsonb_build_object('correct_index', q.correct_index, 'explanation', q.explanation, 'distribution', dist,
        'round_team_a', ra, 'round_team_b', rb);
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(r ORDER BY r.rank, r.nickname), '[]') INTO ranking FROM (
    SELECT id, nickname, team, score, correct_count,
      rank() OVER (ORDER BY score DESC, correct_count DESC, correct_time_ms ASC) AS rank
    FROM players WHERE session_id = _sid ORDER BY 6, 2 LIMIT CASE WHEN _host THEN 500 ELSE 8 END) r;
  v := v || jsonb_build_object('ranking', ranking);

  IF s.status = 'finished' THEN v := v || jsonb_build_object('results', s.results); END IF;

  IF _player_id IS NOT NULL THEN
    SELECT * INTO me FROM (
      SELECT jsonb_build_object('id', id, 'nickname', nickname, 'team', team, 'score', score, 'correct_count', correct_count, 'rank', rank) AS j
      FROM (SELECT *, rank() OVER (ORDER BY score DESC, correct_count DESC, correct_time_ms ASC) AS rank FROM players WHERE session_id = _sid) t
      WHERE id = _player_id) z;
    IF qid IS NOT NULL THEN
      SELECT selected_index, is_correct, score_awarded INTO my_ans FROM answers WHERE session_id = _sid AND question_id = qid AND player_id = _player_id;
      IF FOUND THEN
        me := me || jsonb_build_object('answered', true, 'selected_index', my_ans.selected_index);
        IF revealed THEN me := me || jsonb_build_object('is_correct', my_ans.is_correct, 'score_awarded', my_ans.score_awarded); END IF;
      ELSE
        me := me || jsonb_build_object('answered', false);
      END IF;
    END IF;
    v := v || jsonb_build_object('me', me);
  END IF;
  RETURN v;
END $$;

-- ——— Player RPCs (token-authenticated) ———
CREATE OR REPLACE FUNCTION public._player_session(_player_id uuid, _token text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT session_id FROM players WHERE id = _player_id AND token_hash = encode(digest(coalesce(_token,''), 'sha256'), 'hex')
$$;

DROP FUNCTION IF EXISTS public.get_player_state(uuid, text);
CREATE FUNCTION public.get_player_state(_player_id uuid, _token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  sid := _player_session(_player_id, _token);
  IF sid IS NULL THEN RETURN jsonb_build_object('error','invalid'); END IF;
  PERFORM _room_tick(sid);
  UPDATE players SET last_seen_at = now() WHERE id = _player_id;
  RETURN _room_view(sid, _player_id, false);
END $$;

CREATE OR REPLACE FUNCTION public.submit_answer(_player_id uuid, _token text, _question_id uuid, _selected int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; s record; q record; elapsed int; ok boolean; ins uuid; existing record;
BEGIN
  sid := _player_session(_player_id, _token);
  IF sid IS NULL THEN RETURN jsonb_build_object('error','invalid'); END IF;
  PERFORM _room_tick(sid);
  SELECT * INTO existing FROM answers WHERE session_id = sid AND question_id = _question_id AND player_id = _player_id;
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'already', true, 'selected_index', existing.selected_index); END IF;
  SELECT * INTO s FROM game_sessions WHERE id = sid;
  IF s.status <> 'question' THEN RETURN jsonb_build_object('error','closed'); END IF;
  IF s.question_ids[s.current_question + 1] IS DISTINCT FROM _question_id THEN RETURN jsonb_build_object('error','not_current'); END IF;
  -- 750ms network grace
  IF now() > s.question_ends_at + interval '750 milliseconds' THEN RETURN jsonb_build_object('error','closed'); END IF;
  SELECT * INTO q FROM questions WHERE id = _question_id;
  IF _selected IS NULL OR _selected < 0 OR _selected >= jsonb_array_length(q.options) THEN RETURN jsonb_build_object('error','bad_option'); END IF;
  elapsed := least(s.question_duration_s * 1000, greatest(0, (extract(epoch FROM (now() - s.question_started_at)) * 1000)::int));
  ok := _selected = q.correct_index;
  INSERT INTO answers(session_id, player_id, question_id, selected_index, is_correct, response_ms, score_awarded)
    VALUES (sid, _player_id, _question_id, _selected, ok, elapsed, calculate_score(ok, elapsed, s.question_duration_s))
    ON CONFLICT (session_id, question_id, player_id) DO NOTHING RETURNING id INTO ins;
  IF ins IS NULL THEN
    SELECT * INTO existing FROM answers WHERE session_id = sid AND question_id = _question_id AND player_id = _player_id;
    RETURN jsonb_build_object('ok', true, 'already', true, 'selected_index', existing.selected_index);
  END IF;
  INSERT INTO game_events(session_id, event, player_id) VALUES (sid, 'answer_submitted', _player_id);
  PERFORM _room_tick(sid);
  RETURN jsonb_build_object('ok', true, 'already', false, 'selected_index', _selected);
END $$;

-- ——— Host RPCs (auth + ownership) ———
CREATE OR REPLACE FUNCTION public._assert_host(_sid uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM game_sessions WHERE id = _sid AND host_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.host_get_state(_sid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _assert_host(_sid);
  PERFORM _room_tick(_sid);
  RETURN _room_view(_sid, NULL, true);
END $$;

CREATE OR REPLACE FUNCTION public.host_start_game(_sid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; qs uuid[];
BEGIN
  PERFORM _assert_host(_sid);
  SELECT * INTO s FROM game_sessions WHERE id = _sid FOR UPDATE;
  IF s.status = 'lobby' THEN
    IF NOT EXISTS (SELECT 1 FROM players WHERE session_id = _sid) THEN RAISE EXCEPTION 'no_players'; END IF;
    SELECT array_agg(id ORDER BY position, created_at) INTO qs FROM questions WHERE activity_id = s.activity_id;
    IF qs IS NULL THEN RAISE EXCEPTION 'no_questions'; END IF;
    UPDATE game_sessions SET status = 'starting', question_ids = qs, current_question = 0,
      question_started_at = now() + interval '3 seconds',
      question_ends_at = now() + interval '3 seconds' + make_interval(secs => question_duration_s)
    WHERE id = _sid;
  END IF;
  RETURN _room_view(_sid, NULL, true);
END $$;

CREATE OR REPLACE FUNCTION public.host_close_question(_sid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  PERFORM _assert_host(_sid);
  PERFORM _room_tick(_sid);
  SELECT * INTO s FROM game_sessions WHERE id = _sid FOR UPDATE;
  IF s.status = 'question' THEN PERFORM _room_close_question(_sid); END IF;
  RETURN _room_view(_sid, NULL, true);
END $$;

CREATE OR REPLACE FUNCTION public.host_show_leaderboard(_sid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _assert_host(_sid);
  UPDATE game_sessions SET status = 'leaderboard' WHERE id = _sid AND status = 'reveal';
  RETURN _room_view(_sid, NULL, true);
END $$;

CREATE OR REPLACE FUNCTION public.host_next_question(_sid uuid, _from_index int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  PERFORM _assert_host(_sid);
  SELECT * INTO s FROM game_sessions WHERE id = _sid FOR UPDATE;
  IF s.status = 'leaderboard' AND s.current_question = _from_index THEN
    IF s.current_question + 1 < array_length(s.question_ids, 1) THEN
      UPDATE game_sessions SET status = 'starting', current_question = current_question + 1,
        question_started_at = now() + interval '3 seconds',
        question_ends_at = now() + interval '3 seconds' + make_interval(secs => question_duration_s)
      WHERE id = _sid;
    ELSE
      UPDATE game_sessions SET results = _room_results(_sid) WHERE id = _sid;
      UPDATE game_sessions SET status = 'finished' WHERE id = _sid;
    END IF;
  END IF;
  RETURN _room_view(_sid, NULL, true);
END $$;

CREATE OR REPLACE FUNCTION public.host_finish_game(_sid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  PERFORM _assert_host(_sid);
  SELECT * INTO s FROM game_sessions WHERE id = _sid FOR UPDATE;
  IF s.status <> 'finished' THEN
    IF s.status = 'question' THEN PERFORM _room_close_question(_sid); END IF;
    IF s.status <> 'lobby' THEN UPDATE game_sessions SET results = _room_results(_sid) WHERE id = _sid; END IF;
    UPDATE game_sessions SET status = 'finished' WHERE id = _sid;
  END IF;
  RETURN _room_view(_sid, NULL, true);
END $$;

-- Grants: internals private; player RPCs public (token-checked); host RPCs signed-in (ownership-checked)
REVOKE EXECUTE ON FUNCTION public._room_close_question(uuid), public._room_tick(uuid), public._room_results(uuid),
  public._room_view(uuid, uuid, boolean), public._player_session(uuid, text), public._assert_host(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.host_get_state(uuid), public.host_start_game(uuid), public.host_close_question(uuid),
  public.host_show_leaderboard(uuid), public.host_next_question(uuid, int), public.host_finish_game(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_get_state(uuid), public.host_start_game(uuid), public.host_close_question(uuid),
  public.host_show_leaderboard(uuid), public.host_next_question(uuid, int), public.host_finish_game(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_player_state(uuid, text), public.submit_answer(uuid, text, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_state(uuid, text), public.submit_answer(uuid, text, uuid, int) TO anon, authenticated;