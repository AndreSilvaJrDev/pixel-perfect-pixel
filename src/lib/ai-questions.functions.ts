import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

import { generateInputSchema, regenerateInputSchema } from "./ai-questions";

/** Limite simples de abuso: gerações por usuário na última hora. */
const HOURLY_LIMIT = 20;

async function assertQuota(supabase: SupabaseClient<Database>, userId: string, cost: number) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) return; // falha de contagem não bloqueia o professor
  if ((count ?? 0) + cost > HOURLY_LIMIT) {
    throw new Error(
      "Você atingiu o limite de gerações desta hora. Tente novamente mais tarde ou edite as perguntas manualmente.",
    );
  }
}

async function recordUsage(
  supabase: SupabaseClient<Database>,
  userId: string,
  values: { kind: string; question_count: number; subject: string; topic: string },
) {
  await supabase.from("ai_generations").insert({ user_id: userId, ...values });
}

export const generateActivityWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertQuota(supabase as SupabaseClient<Database>, userId, 1);

    const { generateQuestions } = await import("./question-generator.server");
    const result = await generateQuestions(data);

    await recordUsage(supabase as SupabaseClient<Database>, userId, {
      kind: "activity",
      question_count: result.questions.length,
      subject: data.subject,
      topic: data.topic,
    });

    return result;
  });

export const regenerateQuestionWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => regenerateInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertQuota(supabase as SupabaseClient<Database>, userId, 1);

    const { generateSingleQuestion } = await import("./question-generator.server");
    const question = await generateSingleQuestion({ ...data, questionCount: 1 }, data.avoidPrompts);

    await recordUsage(supabase as SupabaseClient<Database>, userId, {
      kind: "question",
      question_count: 1,
      subject: data.subject,
      topic: data.topic,
    });

    return question;
  });
