import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, displayName } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Minha conta — Professor Play" },
      { name: "description", content: "Seus dados de professor e situação do acesso." },
      { property: "og:title", content: "Minha conta — Professor Play" },
      { property: "og:description", content: "Seus dados de professor e situação do acesso." },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const { user } = useAuth();

  const entitlement = useQuery({
    queryKey: ["entitlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entitlements")
        .select("product,status,source,granted_at")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Minha conta</h1>
        <p className="mt-1 text-muted-foreground">Seus dados e situação do acesso.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nome</p>
          <p className="mt-1 font-semibold">{displayName(user)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">E-mail</p>
          <p className="mt-1 font-semibold">{user?.email}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Acesso ao Professor Play</h2>
        {entitlement.isLoading ? (
          <Skeleton className="mt-4 h-8 w-40" />
        ) : entitlement.data ? (
          <div className="mt-3 flex items-center gap-2">
            <Badge>Liberado</Badge>
            <span className="text-sm text-muted-foreground">
              Compra registrada via {entitlement.data.source}
            </span>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <Badge variant="secondary">Fase de lançamento</Badge>
            <p className="text-sm text-muted-foreground">
              Durante o lançamento o acesso está liberado para você testar. O plano definitivo é
              R$ 39,90, pagamento único.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
