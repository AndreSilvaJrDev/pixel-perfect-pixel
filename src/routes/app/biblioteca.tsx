import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { activitiesQuery } from "@/lib/activities";
import { ActivityCard } from "@/components/app/ActivityCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca — Professor Play" },
      { name: "description", content: "Todas as atividades que você já criou." },
      { property: "og:title", content: "Biblioteca — Professor Play" },
      { property: "og:description", content: "Todas as atividades que você já criou." },
    ],
  }),
  component: Biblioteca,
});

function Biblioteca() {
  const activities = useQuery(activitiesQuery);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Biblioteca</h1>
          <p className="mt-1 text-muted-foreground">Suas atividades salvas.</p>
        </div>
        <Button asChild variant="hero">
          <Link to="/app/criar">
            <Plus className="size-4" aria-hidden="true" />
            Criar nova atividade
          </Link>
        </Button>
      </div>

      {activities.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : activities.data && activities.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activities.data.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-bold">Nenhuma atividade por aqui</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie a primeira em poucos minutos.</p>
          <Button asChild variant="hero" className="mt-5">
            <Link to="/app/criar">Criar atividade</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
