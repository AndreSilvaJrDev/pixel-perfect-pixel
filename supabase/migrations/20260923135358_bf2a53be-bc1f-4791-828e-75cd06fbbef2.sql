CREATE TABLE public.ai_generations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'activity',
  question_count smallint NOT NULL DEFAULT 1,
  subject text,
  topic text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX ai_generations_user_created_idx ON public.ai_generations (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.ai_generations TO authenticated;
GRANT ALL ON public.ai_generations TO service_role;

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_generations_select_own" ON public.ai_generations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "ai_generations_insert_own" ON public.ai_generations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());