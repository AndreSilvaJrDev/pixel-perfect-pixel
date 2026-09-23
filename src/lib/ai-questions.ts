import { z } from "zod";

/**
 * Contrato único de pergunta usado entre IA, revisão e banco.
 *
 * Padrão documentado: `correctIndex` é um índice baseado em ZERO.
 * 0 = primeira alternativa, 1 = segunda, 2 = terceira, 3 = quarta.
 * No banco esse valor é gravado em `questions.correct_index`, também base 0.
 */
export type DraftQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
};

export const TOPIC_MAX_LENGTH = 120;
export const QUESTION_COUNTS = [5, 10, 15, 20] as const;
export const DEFAULT_QUESTION_COUNT = 10;

/** Modos que usam apenas Verdadeiro/Falso (2 alternativas). */
export function isTrueFalseMode(gameMode: string) {
  return gameMode === "vf";
}

export function optionsCountFor(gameMode: string) {
  return isTrueFalseMode(gameMode) ? 2 : 4;
}

/** Entrada validada do gerador (a mesma forma usada pelo backend). */
export const generateInputSchema = z.object({
  grade: z.number().int().min(1).max(9),
  subject: z.string().min(2).max(40),
  topic: z.string().trim().min(2).max(TOPIC_MAX_LENGTH),
  difficulty: z.enum(["facil", "medio", "dificil"]),
  questionCount: z.number().int().min(1).max(20),
  gameMode: z.enum(["batalha", "vf", "corrida", "cabo"]),
});

export type GenerateInput = z.infer<typeof generateInputSchema>;

export const regenerateInputSchema = generateInputSchema
  .omit({ questionCount: true })
  .extend({ avoidPrompts: z.array(z.string().max(300)).max(25).default([]) });

export type RegenerateInput = z.input<typeof regenerateInputSchema>;

export function emptyDraftQuestion(gameMode: string, difficulty: string): DraftQuestion {
  return {
    id: crypto.randomUUID(),
    prompt: "",
    options: isTrueFalseMode(gameMode) ? ["Verdadeiro", "Falso"] : ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
    difficulty,
  };
}

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export function suggestedTitle(topic: string, subject: string, grade: number) {
  return `${topic.trim()} — ${subject} — ${grade}º ano`;
}
