import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Gamepad2, Library, Plus, Users } from "lucide-react";
import { useAuth, displayName } from "@/hooks/useAuth";
import { activitiesQuery, dashboardStatsQuery } from "@/lib/activities";
import { StatCard } from "@/components/app/StatCard";
import { ActivityCard } from "@/components/app/ActivityCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Painel do professor — Professor Play" },
      { name: "description", content: "Suas atividades, partidas e resultados em um só lugar." },
      { property: "og:title", content: "Painel do professor — Professor Play" },
      {
        property: "og:description",
        content: "Suas atividades, partidas e resultados em um só lugar.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const stats = useQuery(dashboardStatsQuery);
  const activities = useQuery(activitiesQuery);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Olá, {displayName(user)}</h1>
          <p className="mt-1 text-muted-foreground">Pronto para transformar sua aula em jogo?</p>
        </div>
        <Button asChild variant="hero" size="lg">
          <Link to="/app/criar">
            <Plus className="size-4" aria-hidden="true" />
            Criar nova atividade
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Library} label="Atividades criadas" value={stats.data?.activities ?? 0} />
        <StatCard icon={Gamepad2} label="Partidas realizadas" value={stats.data?.sessions ?? 0} />
        <StatCard icon={Users} label="Alunos participantes" value={stats.data?.players ?? 0} />
        <StatCard
          icon={BarChart3}
          label="Média de acertos"
          value={`${stats.data?.accuracy ?? 0}%`}
          hint="Atualiza depois da primeira partida"
        />
      </div>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Atividades recentes</h2>
          <Link to="/app/biblioteca" className="text-sm font-semibold text-primary hover:underline">
            Ver todas
          </Link>
        </div>

        {activities.isLoading ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : activities.data && activities.data.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activities.data.slice(0, 6).map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-bold">Você ainda não tem atividades</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie a primeira e veja como seus alunos entram pelo celular.
            </p>
            <Button asChild variant="hero" className="mt-5">
              <Link to="/app/criar">Criar atividade</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
