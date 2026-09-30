import { createOpenAI } from "@ai-sdk/openai";

export function getAIModel() {
  if (process.env["AI_ENABLED"] === "false") {
    throw new Error("A IA está desativada. Você pode criar e editar suas perguntas manualmente.");
  }
  const apiKey = process.env["AI_API_KEY"]?.trim();
  const baseURL = process.env["AI_BASE_URL"]?.trim();
  const model = process.env["AI_MODEL"]?.trim();

  if (apiKey || baseURL || model) {
    if (!apiKey || !baseURL || !model) {
      throw new Error("A configuração personalizada da IA está incompleta.");
    }
    if (new URL(baseURL).protocol !== "https:") {
      throw new Error("O provedor de IA precisa usar HTTPS.");
    }
    return createOpenAI({ apiKey, baseURL }).chat(model);
  }

  // On Vercel, the AI SDK authenticates this Gateway model automatically
  // through VERCEL_OIDC_TOKEN. No provider API key is exposed to the browser.
  return "google/gemini-3.1-flash-lite";
}
