import { Check, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { teamColorVar, type TeamSetup } from "@/lib/activities";
import { formatPoints, type RankingRow, type RoomView } from "@/lib/room";
import { getModeAdapter } from "./modes";

export function teamsOf(view: RoomView): [TeamSetup, TeamSetup] {
  return [
    { name: view.team_a_name, color: view.team_a_color },
    { name: view.team_b_name, color: view.team_b_color },
  ];
}

export function TimerBadge({ seconds, large }: { seconds: number; large?: boolean }) {
  return (
    <span
      role="timer"
      aria-label={`${seconds} segundos restantes`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-display font-extrabold tabular-nums",
        seconds <= 5 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
        large ? "px-5 py-2 text-3xl" : "px-3 py-1 text-xl",
      )}
    >
      <Timer className={large ? "size-7" : "size-5"} aria-hidden="true" />
      {String(seconds).padStart(2, "0")}
    </span>
  );
}

export function QuestionHeader({ view }: { view: RoomView }) {
  return (
    <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
      Pergunta {view.question_index + 1} de {view.total_questions}
    </p>
  );
}

/** Alternativas. A aparência muda por modo (letras ou Verdadeiro/Falso) via adapter. */
export function OptionGrid({
  view,
  onPick,
  selected,
  disabled,
  size = "md",
}: {
  view: RoomView;
  onPick?: (index: number) => void;
  selected?: number | undefined;
  disabled?: boolean;
  size?: "md" | "lg";
}) {
  const adapter = getModeAdapter(view.game_mode);
  const options = view.question?.options ?? [];
  const revealed = view.correct_index !== undefined;
  return (
    <ul className={cn("grid gap-3", options.length === 2 ? "grid-cols-2" : "sm:grid-cols-2")}>
      {options.map((text, i) => {
        const correct = revealed && i === view.correct_index;
        const wrongPick = revealed && i === selected && !correct;
        const label = adapter.optionLabel(i, text);
        return (
          <li key={i}>
            <button
              type="button"
              disabled={disabled || !onPick}
              onClick={() => onPick?.(i)}
              aria-pressed={selected === i}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border-2 bg-card text-left font-semibold transition-colors motion-reduce:transition-none",
                size === "lg" ? "min-h-16 px-4 py-4 text-lg" : "min-h-12 px-4 py-3",
                onPick &&
                  !disabled &&
                  "hover:border-primary focus-visible:border-primary active:scale-[0.99]",
                selected === i && !revealed && "border-primary bg-primary/10",
                correct && "border-success bg-success/10",
                wrongPick && "border-destructive bg-destructive/5",
                !correct && !wrongPick && selected !== i && "border-border",
                disabled && !correct && selected !== i && revealed && "opacity-60",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-base font-extrabold",
                  label.tone,
                )}
              >
                {label.badge}
              </span>
              <span className="min-w-0 flex-1 break-words">{label.text}</span>
              {correct ? (
                <Check className="size-5 shrink-0 text-success" aria-label="Resposta correta" />
              ) : null}
              {wrongPick ? (
                <X className="size-5 shrink-0 text-destructive" aria-label="Sua resposta" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Distribution({ view }: { view: RoomView }) {
  const adapter = getModeAdapter(view.game_mode);
  const dist = view.distribution ?? [];
  const max = Math.max(1, ...dist);
  const options = view.question?.options ?? [];
  return (
    <ul className="space-y-2" aria-label="Distribuição das respostas">
      {options.map((text, i) => {
        const correct = i === view.correct_index;
        return (
          <li key={i} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span className="flex min-w-0 items-center gap-2">
                {correct ? (
                  <Check className="size-4 shrink-0 text-success" aria-label="Correta" />
                ) : null}
                <span className="truncate">{adapter.optionLabel(i, text).text}</span>
              </span>
              <span className="tabular-nums">{dist[i] ?? 0}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                  correct ? "bg-success" : "bg-muted-foreground/40",
                )}
                style={{ width: `${((dist[i] ?? 0) / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({
  rows,
  limit,
  highlightId,
  view,
}: {
  rows: Pick<RankingRow, "nickname" | "score" | "rank" | "team">[] & { id?: string }[];
  limit?: number;
  highlightId?: string | undefined;
  view?: RoomView;
}) {
  const list = limit ? rows.slice(0, limit) : rows;
  return (
    <ol className="space-y-2">
      {list.map((r, idx) => {
        const id = (r as { id?: string }).id;
        const team = view && r.team ? teamsOf(view)[r.team === "a" ? 0 : 1] : null;
        return (
          <li
            key={id ?? `${r.nickname}-${idx}`}
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3",
              id && id === highlightId && "border-primary bg-primary/5",
            )}
          >
            <span className="w-8 shrink-0 text-center font-display text-lg font-extrabold">
              {r.rank <= 3 ? (
                <span aria-label={`${r.rank}º`}>{MEDALS[r.rank - 1]}</span>
              ) : (
                `${r.rank}º`
              )}
            </span>
            {team ? (
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: teamColorVar(team.color) }}
                aria-label={team.name}
              />
            ) : null}
            <span className="min-w-0 flex-1 truncate font-semibold">{r.nickname}</span>
            <span className="font-display font-extrabold tabular-nums">
              {formatPoints(r.score)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Corrida do Saber: só representação visual do score (sem física). */
export function RaceTrack({ view, meId }: { view: RoomView; meId?: string | undefined }) {
  const max = Math.max(1, view.max_score);
  const rows = view.ranking.slice(0, 8);
  const me = view.me;
  if (me && !rows.some((r) => r.id === me.id)) rows.push({ ...me, team: me.team } as RankingRow);
  return (
    <div
      className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
      aria-label="Pista da corrida"
    >
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Corrida do Saber
      </p>
      <ul className="space-y-3">
        {rows.map((r) => {
          const pct = Math.min(100, (r.score / max) * 100);
          return (
            <li key={r.id} className="flex items-center gap-3">
              <span
                className={cn(
                  "w-20 shrink-0 truncate text-sm font-semibold sm:w-28",
                  r.id === meId && "text-primary",
                )}
              >
                {r.nickname}
              </span>
              <div className="relative h-8 flex-1 rounded-full border border-dashed border-border bg-muted/50">
                <span
                  className="absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground transition-[left] duration-700 motion-reduce:transition-none"
                  style={{ left: `calc(14px + (100% - 28px) * ${pct / 100})` }}
                  aria-hidden="true"
                >
                  {r.rank}
                </span>
                <span className="sr-only">{`${r.rank}º lugar, ${formatPoints(r.score)} pontos`}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
