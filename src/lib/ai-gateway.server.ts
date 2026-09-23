/**
 * Camada de acesso ao provedor de IA (Lovable AI Gateway).
 *
 * Todo o resto do app conversa com `src/lib/question-generator.server.ts`,
 * que por sua vez usa este arquivo. Trocar de modelo/provedor no futuro
 * significa mudar apenas estes dois arquivos.
 */

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      const response = await fetch(input, { ...init, headers });
      const next = response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim();
      if (!runId && next) runId = next;
      return response;
    },
    getRunId: () => runId,
  };
}

export function requireLovableApiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("CREDENCIAL_PENDENTE: LOVABLE_API_KEY ausente no servidor.");
  return key;
}
