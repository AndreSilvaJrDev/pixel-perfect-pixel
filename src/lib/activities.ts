import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Activity = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  topic: string | null;
  difficulty: string;
  game_mode: string;
  is_demo: boolean;
  team_a_name: string;
  team_b_name: string;
  team_a_color: string;
  team_b_color: string;
  team_distribution: string;
  created_at: string;
  questions: { count: number }[];
};

export type Question = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  difficulty: string;
};

export const SUBJECTS = [
  "Português",
  "Matemática",
  "Ciências",
  "História",
  "Geografia",
  "Inglês",
  "Artes",
  "Educação Física",
  "Física",
  "Química",
  "Biologia",
  "Redação",
  "Ensino Religioso",
  "Tecnologia e Computação",
] as const;
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const DIFFICULTIES = [
  { value: "facil", label: "Fácil" },
  { value: "medio", label: "Médio" },
  { value: "dificil", label: "Difícil" },
] as const;
export const GAME_MODES = [
  { value: "batalha", label: "Batalha do Saber" },
  { value: "vf", label: "Verdadeiro ou Falso" },
  { value: "corrida", label: "Corrida do Saber" },
  { value: "cabo", label: "Cabo de Guerra" },
] as const;

/** Modos jogados em equipe (dois times disputando pontos). */
export const TEAM_GAME_MODES = ["cabo"] as const;

export function isTeamMode(gameMode: string) {
  return (TEAM_GAME_MODES as readonly string[]).includes(gameMode);
}

export const TEAM_COLORS = [
  { value: "azul", label: "Azul" },
  { value: "vermelho", label: "Vermelho" },
  { value: "roxo", label: "Roxo" },
  { value: "amarelo", label: "Amarelo" },
  { value: "verde", label: "Verde" },
] as const;

export function teamColorVar(color: string) {
  const known = TEAM_COLORS.some((item) => item.value === color);
  return `var(--team-${known ? color : "azul"})`;
}

export const TEAM_DISTRIBUTIONS = [
  { value: "automatica", label: "Automática", hint: "O sistema divide a turma nos dois times." },
  { value: "manual", label: "Manual", hint: "O professor move os alunos no lobby." },
] as const;

export type TeamSetup = { name: string; color: string };

export function teamsFromActivity(activity: {
  team_a_name?: string | null;
  team_b_name?: string | null;
  team_a_color?: string | null;
  team_b_color?: string | null;
}): [TeamSetup, TeamSetup] {
  return [
    { name: activity.team_a_name || "Time Azul", color: activity.team_a_color || "azul" },
    { name: activity.team_b_name || "Time Vermelho", color: activity.team_b_color || "vermelho" },
  ];
}

export function gameModeLabel(value: string) {
  return GAME_MODES.find((mode) => mode.value === value)?.label ?? value;
}

export function difficultyLabel(value: string) {
  return DIFFICULTIES.find((item) => item.value === value)?.label ?? value;
}

export const activitiesQuery = queryOptions({
  queryKey: ["activities"],
  queryFn: async (): Promise<Activity[]> => {
    const { data, error } = await supabase
      .from("activities")
      .select(
        "id,title,subject,grade,topic,difficulty,game_mode,is_demo,created_at,team_a_name,team_b_name,team_a_color,team_b_color,team_distribution,questions(count)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Activity[];
  },
});

export function activityQuery(id: string) {
  return queryOptions({
    queryKey: ["activity", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(
          "id,title,subject,grade,topic,difficulty,game_mode,is_demo,created_at,team_a_name,team_b_name,team_a_color,team_b_color,team_distribution",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;

      const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("id,position,prompt,options,correct_index,explanation,difficulty")
        .eq("activity_id", id)
        .order("position");
      if (questionsError) throw questionsError;

      return {
        activity: data,
        questions: (questions ?? []) as unknown as Question[],
      };
    },
  });
}

export const dashboardStatsQuery = queryOptions({
  queryKey: ["dashboard-stats"],
  queryFn: async () => {
    const [activities, sessions, players, answers] = await Promise.all([
      supabase.from("activities").select("id", { count: "exact", head: true }),
      supabase.from("game_sessions").select("id", { count: "exact", head: true }),
      supabase.from("players").select("id", { count: "exact", head: true }),
      supabase.from("answers").select("is_correct"),
    ]);

    const answerRows = (answers.data ?? []) as { is_correct: boolean }[];
    const accuracy = answerRows.length
      ? Math.round((answerRows.filter((row) => row.is_correct).length / answerRows.length) * 100)
      : 0;

    return {
      activities: activities.count ?? 0,
      sessions: sessions.count ?? 0,
      players: players.count ?? 0,
      accuracy,
    };
  },
});
