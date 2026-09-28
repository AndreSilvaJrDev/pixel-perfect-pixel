import { createOpenAI } from "@ai-sdk/openai";

export function getAIModel() {
  if (process.env["AI_ENABLED"] !== "true") {
    throw new Error("A IA está desativada. Você pode criar e editar suas perguntas manualmente.");
  }
  const apiKey = process.env["AI_API_KEY"]?.trim();
  const baseURL = process.env["AI_BASE_URL"]?.trim();
  const model = process.env["AI_MODEL"]?.trim();
  if (!apiKey || !baseURL || !model) {
    throw new Error("A IA ainda não foi configurada. Use a criação manual por enquanto.");
  }
  if (new URL(baseURL).protocol !== "https:")
    throw new Error("O provedor de IA precisa usar HTTPS.");
  return createOpenAI({ apiKey, baseURL }).chat(model);
}
