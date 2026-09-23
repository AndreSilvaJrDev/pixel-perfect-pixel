ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS team_a_name text NOT NULL DEFAULT 'Time Azul',
  ADD COLUMN IF NOT EXISTS team_b_name text NOT NULL DEFAULT 'Time Vermelho',
  ADD COLUMN IF NOT EXISTS team_a_color text NOT NULL DEFAULT 'azul',
  ADD COLUMN IF NOT EXISTS team_b_color text NOT NULL DEFAULT 'vermelho',
  ADD COLUMN IF NOT EXISTS team_distribution text NOT NULL DEFAULT 'automatica';

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team text;