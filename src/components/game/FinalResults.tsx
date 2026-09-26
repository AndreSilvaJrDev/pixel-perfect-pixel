import { CheckCircle2, Clock, Target, Users, XCircle } from "lucide-react";
import { teamColorVar } from "@/lib/activities";
import { formatPoints, type RoomResults } from "@/lib/room";
import { Leaderboard } from "./parts";
import { getModeAdapter } from "./modes";

type Base = {
  game_mode: string;
  team_a_name: string;
  team_b_name: string;
  team_a_color: string;
  team_b_color: string;
};

export function teamWinner(view: Base, r: Pick<RoomResults, "team_a_score" | "team_b_score">) {
  if (r.team_a_score === r.team_b_score) return null;
  return r.team_a_score > r.team_b_score
    ? { name: view.team_a_name, color: view.team_a_color }
    : { name: view.team_b_name, color: view.team_b_color };
}

export function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${s % 60}s` : `${s}s`;
}

/** Resultado final para o professor (sala e página de resultados). */
export function FinalResults({ view, results }: { view: Base; results: RoomResults }) {
  const adapter = getModeAdapter(view.game_mode);
  const qs = results.per_question.map((q) => ({
    ...q,
    pct: q.answered ? q.correct / Math.max(1, results.participants) : 0,
  }));
  const best = [...qs].sort((a, b) => b.pct - a.pct)[0];
  const worst = [...qs].sort((a, b) => a.pct - b.pct)[0];
  const winner = teamWinner(view, results);
  const podium = results.ranking.slice(0, 3);

  return (
    <section className="space-y-6">
      <h2 className="text-3xl font-extrabold">Resultado final</h2>

      {adapter.teams ? (
        <div
          className="rounded-3xl border-4 bg-card p-6 text-center shadow-[var(--shadow-card)]"
          style={{ borderColor: winner ? teamColorVar(winner.color) : "var(--border)" }}
        >
          <p className="font-display text-4xl font-extrabold uppercase">
            {winner ? `${winner.name} venceu!` : "Empate!"}
          </p>
          <p className="mt-2 text-lg font-bold tabular-nums">
            {view.team_a_name} {formatPoints(results.team_a_score)} ×{" "}
            {formatPoints(results.team_b_score)} {view.team_b_name}
          </p>
        </div>
      ) : null}

      {podium.length > 0 ? (
        <ol className="grid grid-cols-3 items-end gap-3" aria-label="Pódio">
          {[1, 0, 2].map((idx) => {
            const p = podium[idx];
            if (!p) return <li key={idx} />;
            const h = idx === 0 ? "h-36" : idx === 1 ? "h-28" : "h-20";
            return (
              <li key={idx} className="flex min-w-0 flex-col items-center gap-2">
                <span className="text-3xl" aria-hidden="true">
                  {["🥇", "🥈", "🥉"][p.rank - 1] ?? ""}
                </span>
                <span className="w-full truncate text-center font-bold">{p.nickname}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatPoints(p.score)}
                </span>
                <div
                  className={`w-full rounded-t-2xl ${idx === 0 ? "bg-highlight" : idx === 1 ? "bg-primary/20" : "bg-accent/20"} ${h}`}
                />
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<Users className="size-5" />}
          label="Participantes"
          value={String(results.participants)}
        />
        <Stat
          icon={<Target className="size-5" />}
          label="Média de acertos"
          value={`${results.accuracy_pct}%`}
        />
        <Stat
          icon={<CheckCircle2 className="size-5" />}
          label="Respostas"
          value={String(results.total_answers)}
        />
        <Stat
          icon={<Clock className="size-5" />}
          label="Duração"
          value={formatDuration(results.duration_s)}
        />
      </div>

      {best && worst ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" /> Mais acertada ·{" "}
              {Math.round(best.pct * 100)}%
            </p>
            <p className="mt-1 break-words font-semibold">{best.prompt}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive">
              <XCircle className="size-4" aria-hidden="true" /> Mais errada ·{" "}
              {Math.round(worst.pct * 100)}%
            </p>
            <p className="mt-1 break-words font-semibold">{worst.prompt}</p>
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-3 text-xl font-extrabold">Ranking</h3>
        <Leaderboard rows={results.ranking} />
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className="text-primary">
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}
