import { streamText, Output } from "ai";
import { z } from "zod";

import { getAIModel } from "./ai-provider.server";
import {
  isTrueFalseMode,
  optionsCountFor,
  suggestedTitle,
  type DraftQuestion,
  type GenerateInput,
} from "./ai-questions";

/** Modelo/provedor em uso. Trocar aqui é suficiente para migrar de modelo. */

const DIFFICULTY_LABEL: Record<string, string> = {
  facil: "fácil",
  medio: "média",
  dificil: "difícil",
};

/**
 * Saída estruturada exigida do modelo.
 * `correctAnswer` é índice base 0 (0 = primeira alternativa).
 * Schema mantido "strict-compatible": todo campo é obrigatório, sem limites numéricos.
 */
const aiQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.number(),
  explanation: z.string(),
  difficulty: z.string(),
});

const aiActivitySchema = z.object({
  title: z.string(),
  questions: z.array(aiQuestionSchema),
});

type AiQuestion = z.infer<typeof aiQuestionSchema>;

function systemPrompt(input: GenerateInput) {
  const count = optionsCountFor(input.gameMode);
  const vf = isTrueFalseMode(input.gameMode);
  return [
    "Você é um assistente pedagógico especializado em criar atividades escolares gamificadas para escolas brasileiras.",
    "Escreva sempre em português brasileiro, com linguagem adequada à série informada.",
    vf
      ? 'Formato: afirmações de Verdadeiro ou Falso. Cada pergunta deve ter exatamente 2 alternativas, nesta ordem: ["Verdadeiro", "Falso"].'
      : `Formato: múltipla escolha com exatamente ${count} alternativas curtas e de tamanho parecido.`,
    "Regras obrigatórias:",
    "- apenas uma resposta correta, sem ambiguidade;",
    "- alternativas erradas plausíveis, nunca absurdas nem obviamente descartáveis;",
    "- nunca usar 'Todas as alternativas acima' ou 'Nenhuma das alternativas';",
    "- não repetir perguntas nem reformular a mesma ideia;",
    "- explicação curta (até 2 frases) explicando por que a resposta está correta;",
    "- evitar pegadinhas, conteúdo inadequado para crianças e afirmações factualmente duvidosas;",
    "- correctAnswer é o índice da alternativa correta começando em 0;",
    "- difficulty deve ser exatamente 'facil', 'medio' ou 'dificil'.",
  ].join("\n");
}

function userPrompt(input: GenerateInput, extra?: { avoidPrompts?: string[]; single?: boolean }) {
  const lines = [
    `Série: ${input.grade}º ano do Ensino Fundamental`,
    `Matéria: ${input.subject}`,
    `Tema: ${input.topic}`,
    `Dificuldade: ${DIFFICULTY_LABEL[input.difficulty] ?? input.difficulty} (use difficulty="${input.difficulty}")`,
  ];
  if (extra?.single) {
    lines.push("Gere exatamente 1 pergunta nova sobre esse tema.");
    if (extra.avoidPrompts?.length) {
      lines.push(
        "Não repita nem reformule nenhuma destas perguntas já existentes:",
        ...extra.avoidPrompts.map((p) => `- ${p}`),
      );
    }
    lines.push('O campo "title" deve conter apenas o tema.');
  } else {
    lines.push(`Gere exatamente ${input.questionCount} perguntas diferentes entre si.`);
    lines.push(`O campo "title" deve ser um título curto para a atividade, baseado no tema.`);
  }
  return lines.join("\n");
}

async function callModel(
  input: GenerateInput,
  extra?: { avoidPrompts?: string[]; single?: boolean },
) {
  const result = streamText({
    model: getAIModel(),
    maxRetries: 0,
    maxOutputTokens: 6000,
    abortSignal: AbortSignal.timeout(45000),
    system: systemPrompt(input),
    prompt: userPrompt(input, extra),
    output: Output.object({ schema: aiActivitySchema }),
  });

  return await result.output;
}

function normalizeDifficulty(value: string, fallback: string) {
  const map: Record<string, string> = {
    easy: "facil",
    medium: "medio",
    hard: "dificil",
    facil: "facil",
    medio: "medio",
    dificil: "dificil",
    fácil: "facil",
    média: "medio",
    difícil: "dificil",
  };
  return map[value?.toLowerCase?.().trim()] ?? fallback;
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Valida e higieniza a saída do modelo. Descarta perguntas inválidas ou duplicadas. */
export function validateQuestions(
  raw: AiQuestion[],
  input: GenerateInput,
  seen: Set<string> = new Set(),
): DraftQuestion[] {
  const expectedOptions = optionsCountFor(input.gameMode);
  const vf = isTrueFalseMode(input.gameMode);
  const valid: DraftQuestion[] = [];

  for (const item of raw ?? []) {
    const prompt = String(item?.question ?? "").trim();
    if (prompt.length < 5) continue;

    let options = Array.isArray(item?.options)
      ? item.options.map((option) => String(option ?? "").trim())
      : [];
    if (vf) options = ["Verdadeiro", "Falso"];
    if (options.length !== expectedOptions) continue;
    if (options.some((option) => option.length === 0)) continue;
    if (new Set(options.map(normalizeKey)).size !== options.length) continue;

    const correctIndex = Number(item?.correctAnswer);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      continue;
    }

    const key = normalizeKey(prompt);
    if (seen.has(key)) continue;
    seen.add(key);

    valid.push({
      id: crypto.randomUUID(),
      prompt,
      options,
      correctIndex,
      explanation: String(item?.explanation ?? "").trim(),
      difficulty: normalizeDifficulty(String(item?.difficulty ?? ""), input.difficulty),
    });
  }

  return valid;
}

/** Gera a atividade completa. Faz no máximo uma chamada extra para completar faltantes. */
export async function generateQuestions(input: GenerateInput) {
  const first = await callModel(input);
  const seen = new Set<string>();
  let questions = validateQuestions(first?.questions ?? [], input, seen);

  if (questions.length < input.questionCount) {
    const missing = input.questionCount - questions.length;
    const retry = await callModel({ ...input, questionCount: missing });
    questions = questions.concat(validateQuestions(retry?.questions ?? [], input, seen));
  }

  if (questions.length === 0) {
    throw new Error("A IA não retornou perguntas válidas.");
  }

  const title = String(first?.title ?? "").trim();
  return {
    title: title.length >= 3 ? title : suggestedTitle(input.topic, input.subject, input.grade),
    questions: questions.slice(0, input.questionCount),
  };
}

/** Gera uma única pergunta nova, evitando repetir as existentes. */
export async function generateSingleQuestion(input: GenerateInput, avoidPrompts: string[]) {
  const trimmed = avoidPrompts.slice(-25).map((prompt) => prompt.slice(0, 300));
  const seen = new Set(trimmed.map(normalizeKey));

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callModel(
      { ...input, questionCount: 1 },
      {
        single: true,
        avoidPrompts: trimmed,
      },
    );
    const [question] = validateQuestions(result?.questions ?? [], input, seen);
    if (question) return question;
  }

  throw new Error("A IA não conseguiu criar uma pergunta válida agora.");
}
