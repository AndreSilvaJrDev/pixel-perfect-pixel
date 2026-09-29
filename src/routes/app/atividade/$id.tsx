import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { createGameSession } from "@/lib/room";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Edit3, Play } from "lucide-react";
import {
  activityQuery,
  difficultyLabel,
  gameModeLabel,
  isTeamMode,
  teamsFromActivity,
} from "@/lib/activities";
import { TugOfWar } from "@/components/game/TugOfWar";
import { ActivityEditor } from "@/components/app/ActivityEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/atividade/$id")({
  head: () => ({
    meta: [
      { title: "Atividade — Professor Play" },
      { name: "description", content: "Revise as perguntas antes de começar a partida." },
      { property: "og:title", content: "Atividade — Professor Play" },
      { property: "og:description", content: "Revise as perguntas antes de começar a partida." },
    ],
  }),
  component: AtividadeDetalhe,
});

function AtividadeDetalhe() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery(activityQuery(id));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState(false);
  async function startGame() {
    setStarting(true);
    try {
      const sessionId = await createGameSession(id);
      navigate({ to: "/app/sala/$id", params: { id: sessionId } });
    } catch {
      toast.error("Não foi possível criar a sala. Tente de novo.");
      setStarting(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  if (!data?.activity) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="font-bold">Atividade não encontrada</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/app/biblioteca">Voltar para a biblioteca</Link>
        </Button>
      </div>
    );
  }

  const { activity, questions } = data;
  if (editing && activity) {
    return (
      <ActivityEditor
        activity={activity}
        questions={questions}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["activity", id] });
          void queryClient.invalidateQueries({ queryKey: ["activities"] });
          setEditing(false);
        }}
      />
    );
  }
  const [teamA, teamB] = teamsFromActivity(activity);

  return (
    <div className="space-y-6">
      <Link
        to="/app/biblioteca"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Biblioteca
      </Link>

      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{activity.subject}</Badge>
            <Badge variant="outline">{activity.grade}º ano</Badge>
            <Badge variant="outline">{difficultyLabel(activity.difficulty)}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{activity.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {gameModeLabel(activity.game_mode)} · {questions.length} perguntas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={() => setEditing(true)}>
            <Edit3 className="size-4" aria-hidden="true" />
            Editar atividade
          </Button>
          <Button
            variant="hero"
            size="lg"
            disabled={starting || questions.length === 0}
            onClick={() => void startGame()}
          >
            <Play className="size-4" aria-hidden="true" />
            {starting ? "Criando sala..." : "Começar partida"}
          </Button>
        </div>
      </div>

      {isTeamMode(activity.game_mode) ? (
        <div className="space-y-3">
          <TugOfWar teamA={teamA} teamB={teamB} scoreA={0} scoreB={0} playersA={0} playersB={0} />
          <p className="text-sm text-muted-foreground">
            A corda começa no meio. Cada acerto puxa para o lado do time.
          </p>
        </div>
      ) : null}

      {questions.length > 0 ? (
        <ol className="space-y-4">
          {questions.map((question, index) => (
            <li
              key={question.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Pergunta {index + 1}
              </p>
              <h2 className="mt-1 text-lg font-bold">{question.prompt}</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {question.options.map((option, optionIndex) => {
                  const correct = optionIndex === question.correct_index;
                  return (
                    <li
                      key={option}
                      className={
                        correct
                          ? "flex items-center gap-2 rounded-xl border-2 border-success bg-success/10 px-3 py-2 text-sm font-semibold"
                          : "flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                      }
                    >
                      {correct ? (
                        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                      ) : (
                        <span className="size-4" aria-hidden="true" />
                      )}
                      {option}
                      {correct ? <span className="sr-only">(resposta correta)</span> : null}
                    </li>
                  );
                })}
              </ul>
              {question.explanation ? (
                <p className="mt-3 text-sm text-muted-foreground">{question.explanation}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-bold">Esta atividade ainda não tem perguntas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A criação automática de perguntas com IA entra na próxima entrega.
          </p>
        </div>
      )}
    </div>
  );
}
