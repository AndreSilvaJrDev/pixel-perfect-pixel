import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FinalResults } from "@/components/game/FinalResults";
import { gameModeLabel } from "@/lib/activities";
import type { RoomResults } from "@/lib/room";

export const Route = createFileRoute("/app/resultado/$id")({
  head: () => ({
    meta: [
      { title: "Resultado da partida — Professor Play" },
      { name: "description", content: "Pódio, ranking e desempenho da turma nesta partida." },
      { property: "og:title", content: "Resultado da partida — Professor Play" },
      {
        property: "og:description",
        content: "Pódio, ranking e desempenho da turma nesta partida.",
      },
    ],
  }),
  component: ResultadoDetalhe,
});

function ResultadoDetalhe() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["game-session-result", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_sessions")
        .select(
          "id, created_at, results, activities(title, game_mode, team_a_name, team_b_name, team_a_color, team_b_color)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  const a = q.data?.activities as
    | {
        title: string;
        game_mode: string;
        team_a_name: string;
        team_b_name: string;
        team_a_color: string;
        team_b_color: string;
      }
    | null
    | undefined;
  const results = q.data?.results as RoomResults | null | undefined;
  if (!q.data || !a || !results) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="font-bold">Resultado não encontrado</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/app/resultados">Voltar para resultados</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <Link
        to="/app/resultados"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Resultados
      </Link>
      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          {gameModeLabel(a.game_mode)} · {new Date(q.data.created_at).toLocaleString("pt-BR")}
        </p>
        <h1 className="break-words text-2xl font-extrabold sm:text-3xl">{a.title}</h1>
      </div>
      <FinalResults view={a} results={results} />
    </div>
  );
}
