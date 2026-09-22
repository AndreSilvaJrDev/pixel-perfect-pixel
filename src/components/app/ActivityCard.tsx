import { Link } from "@tanstack/react-router";
import { CalendarDays, HelpCircle, Play, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gameModeLabel, type Activity } from "@/lib/activities";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function ActivityCard({ activity }: { activity: Activity }) {
  const questionCount = activity.questions?.[0]?.count ?? 0;

  return (
    <article className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{activity.subject}</Badge>
          <Badge variant="outline">{activity.grade}º ano</Badge>
          {activity.is_demo ? <Badge>Demonstração</Badge> : null}
        </div>
        <h3 className="mt-3 text-lg font-bold leading-snug">{activity.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{gameModeLabel(activity.game_mode)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <HelpCircle className="size-3.5" aria-hidden="true" />
            {questionCount} perguntas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatDate(activity.created_at)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to="/app/atividade/$id" params={{ id: activity.id }}>
            <Pencil className="size-4" aria-hidden="true" />
            Ver e editar
          </Link>
        </Button>
        <Button asChild variant="hero" size="sm" className="flex-1">
          <Link to="/app/atividade/$id" params={{ id: activity.id }}>
            <Play className="size-4" aria-hidden="true" />
            Jogar
          </Link>
        </Button>
      </div>
    </article>
  );
}
