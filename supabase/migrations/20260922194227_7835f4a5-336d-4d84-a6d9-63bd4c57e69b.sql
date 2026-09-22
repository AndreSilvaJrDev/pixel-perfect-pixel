
-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  school text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ACTIVITIES
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  subject text NOT NULL,
  grade smallint NOT NULL,
  topic text,
  difficulty text NOT NULL DEFAULT 'medio',
  game_mode text NOT NULL DEFAULT 'batalha',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activities_owner_idx ON public.activities(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_own" ON public.activities FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- QUESTIONS
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 1,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  correct_index smallint NOT NULL DEFAULT 0,
  explanation text,
  difficulty text NOT NULL DEFAULT 'medio',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_activity_idx ON public.questions(activity_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_own" ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.activities a WHERE a.id = activity_id AND a.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.activities a WHERE a.id = activity_id AND a.owner_id = auth.uid()));

-- GAME SESSIONS
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  pin text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_sessions_host_idx ON public.game_sessions(host_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_sessions_own" ON public.game_sessions FOR ALL TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

-- PLAYERS
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX players_session_idx ON public.players(session_id, score DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_host_access" ON public.players FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.host_id = auth.uid()));

-- ANSWERS
CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_index smallint,
  is_correct boolean NOT NULL DEFAULT false,
  response_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX answers_session_idx ON public.answers(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "answers_host_access" ON public.answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = session_id AND s.host_id = auth.uid()));

-- ENTITLEMENTS
CREATE TABLE public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product text NOT NULL DEFAULT 'professor_play_v1',
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'manual',
  external_reference text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX entitlements_user_idx ON public.entitlements(user_id);
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entitlements_select_own" ON public.entitlements FOR SELECT TO authenticated USING (user_id = auth.uid());

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- new user: profile + demo activity
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.activities (owner_id, title, subject, grade, topic, difficulty, game_mode, is_demo)
  VALUES (NEW.id, 'Sistema Solar — 5º ano', 'Ciências', 5, 'Sistema Solar', 'medio', 'batalha', true)
  RETURNING id INTO demo_id;

  INSERT INTO public.questions (activity_id, position, prompt, options, correct_index, explanation, difficulty) VALUES
    (demo_id, 1, 'Qual é o planeta mais próximo do Sol?', '["Mercúrio","Vênus","Terra","Marte"]'::jsonb, 0, 'Mercúrio é o primeiro planeta do Sistema Solar.', 'facil'),
    (demo_id, 2, 'Qual planeta é conhecido como Planeta Vermelho?', '["Júpiter","Marte","Saturno","Netuno"]'::jsonb, 1, 'Marte parece vermelho por causa do óxido de ferro no solo.', 'facil'),
    (demo_id, 3, 'Quantos planetas existem no Sistema Solar?', '["7","8","9","10"]'::jsonb, 1, 'São 8 planetas desde que Plutão virou planeta anão.', 'medio'),
    (demo_id, 4, 'Qual é o maior planeta do Sistema Solar?', '["Terra","Saturno","Júpiter","Urano"]'::jsonb, 2, 'Júpiter é o maior planeta, um gigante gasoso.', 'medio'),
    (demo_id, 5, 'O que faz a Terra ter dia e noite?', '["A rotação da Terra","A translação da Terra","O movimento da Lua","As estações do ano"]'::jsonb, 0, 'A Terra gira em torno do próprio eixo: isso é a rotação.', 'medio');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
