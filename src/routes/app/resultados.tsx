import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/resultados")({
  head: () => ({
    meta: [
      { title: "Resultados — Professor Play" },
      { name: "description", content: "Veja as partidas realizadas e o desempenho da turma." },
      { property: "og:title", content: "Resultados — Professor Play" },
      {
        property: "og:description",
        content: "Veja as partidas realizadas e o desempenho da turma.",
      },
    ],
  }),
  component: Resultados,
});

function Resultados() {
  const sessions = useQuery({
    queryKey: ["game-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_sessions")
        .select("id,pin,status,created_at,activities(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Resultados</h1>
        <p className="mt-1 text-muted-foreground">Cada partida aparece aqui quando termina.</p>
      </div>

      {sessions.isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : sessions.data && sessions.data.length > 0 ? (
        <ul className="space-y-3">
          {sessions.data.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div>
                <p className="font-bold">
                  {(session.activities as { title: string } | null)?.title ?? "Partida"}
                </p>
                <p className="text-sm text-muted-foreground">
                  PIN {session.pin} · {new Date(session.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-highlight/30 text-highlight-foreground">
            <Trophy className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-4 font-bold">Nenhuma partida ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Depois da primeira partida você vê pontuação, ranking e acertos da turma.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/app/biblioteca">Ver minhas atividades</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
