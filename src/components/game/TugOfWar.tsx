import { teamColorVar, type TeamSetup } from "@/lib/activities";

type TugOfWarProps = {
  teamA: TeamSetup;
  teamB: TeamSetup;
  scoreA: number;
  scoreB: number;
  playersA?: number;
  playersB?: number;
};

/**
 * Indicador visual do modo Cabo de Guerra.
 * A corda se desloca para o lado do time com mais pontos.
 */
export function TugOfWar({ teamA, teamB, scoreA, scoreB, playersA, playersB }: TugOfWarProps) {
  const total = scoreA + scoreB;
  // 50% = empate. Vantagem máxima visual em 92% / 8%.
  const ratio = total === 0 ? 0.5 : scoreA / total;
  const knotPercent = Math.min(92, Math.max(8, ratio * 100));

  const leading = scoreA === scoreB ? null : scoreA > scoreB ? teamA : teamB;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <TeamScore team={teamA} score={scoreA} players={playersA} align="left" />
        <p className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Cabo de Guerra
        </p>
        <TeamScore team={teamB} score={scoreB} players={playersB} align="right" />
      </div>

      <div
        className="relative mt-5 h-14"
        role="img"
        aria-label={`Placar do cabo de guerra: ${teamA.name} ${scoreA} pontos, ${teamB.name} ${scoreB} pontos.`}
      >
        {/* corda */}
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${knotPercent}%`, backgroundColor: teamColorVar(teamA.color) }}
          />
        </div>
        <div
          className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full transition-[clip-path] duration-500 ease-out"
          style={{
            backgroundColor: teamColorVar(teamB.color),
            clipPath: `inset(0 0 0 ${knotPercent}%)`,
          }}
        />
        {/* marcador central de referência */}
        <div
          className="absolute left-1/2 top-1/2 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border"
          aria-hidden="true"
        />
        {/* nó da corda */}
        <div
          className="absolute top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-card bg-foreground shadow-[var(--shadow-lift)] transition-[left] duration-500 ease-out"
          style={{ left: `${knotPercent}%` }}
          aria-hidden="true"
        />
      </div>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        {leading ? (
          <>
            <span className="font-semibold text-foreground">{leading.name}</span> está puxando a
            corda.
          </>
        ) : (
          "Empate. A corda está no meio."
        )}
      </p>
    </div>
  );
}

function TeamScore({
  team,
  score,
  players,
  align,
}: {
  team: TeamSetup;
  score: number;
  players?: number | undefined;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <span
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
        style={{
          backgroundColor: teamColorVar(team.color),
          color: "var(--primary-foreground)",
        }}
      >
        {team.name}
      </span>
      <p className="mt-2 text-2xl font-extrabold leading-none">{score}</p>
      {typeof players === "number" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {players} {players === 1 ? "aluno" : "alunos"}
        </p>
      ) : null}
    </div>
  );
}
