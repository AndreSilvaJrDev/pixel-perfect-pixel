import { teamColorVar, type TeamSetup } from "@/lib/activities";
import { formatPoints } from "@/lib/room";
import schoolArena from "@/assets/tug-school-arena.png";
import "./arena.css";

type TugOfWarProps = {
  teamA: TeamSetup;
  teamB: TeamSetup;
  scoreA: number;
  scoreB: number;
  playersA?: number;
  playersB?: number;
};
export function TugOfWar({ teamA, teamB, scoreA, scoreB, playersA, playersB }: TugOfWarProps) {
  const scale = Math.max(scoreA + scoreB, 6000);
  // Time A fica a esquerda: o marcador acompanha o lado vencedor.
  const ratio = 0.5 - (scoreA - scoreB) / (2 * scale);
  const knotPercent = Math.min(92, Math.max(8, ratio * 100));
  const leading = scoreA === scoreB ? null : scoreA > scoreB ? teamA : teamB;
  return (
    <section className="pp-tug" aria-label="Cabo de Guerra">
      <h3 className="pp-tug-header">Cabo de Guerra</h3>
      <div className="pp-tug-scene" style={{ backgroundImage: `url(${schoolArena})` }}>
      <div className="pp-team-scores">
        <TeamScore team={teamA} score={scoreA} players={playersA} />
        <span aria-hidden="true" className="pt-2 text-sm text-blue-200">
          ×
        </span>
        <TeamScore team={teamB} score={scoreB} players={playersB} right />
      </div>
      </div>
      <div
        className="pp-rope-field"
        role="img"
        aria-label={`${teamA.name}: ${scoreA} pontos. ${teamB.name}: ${scoreB} pontos. ${leading ? leading.name + " na liderança." : "Empate."}`}
      >
        <span className="pp-balance-label">Vantagem das equipes</span>
        <span className="pp-pennant" style={{ left: 0, background: teamColorVar(teamA.color) }} />
        <span className="pp-pennant" style={{ right: 0, background: teamColorVar(teamB.color) }} />
        <span className="pp-rope-center" />
        <span className="pp-rope" />
        <span className="pp-rope-knot" style={{ left: `${knotPercent}%` }} />
      </div>
      <p className="pp-tug-caption" aria-live="polite">
        {leading ? `${leading.name} está puxando a corda!` : "Tudo empatado. Cada resposta conta!"}
      </p>
    </section>
  );
}
function TeamScore({
  team,
  score,
  players,
  right = false,
}: {
  team: TeamSetup;
  score: number;
  players?: number | undefined;
  right?: boolean;
}) {
  return (
    <div className="min-w-0" style={{ textAlign: right ? "right" : "left" }}>
      <p className="pp-team-name" style={{ justifyContent: right ? "flex-end" : "flex-start" }}>
        <i style={{ background: teamColorVar(team.color) }} aria-hidden="true" />
        {team.name}
      </p>
      <p className="pp-team-score">{formatPoints(score)}</p>
      <small>
        {typeof players === "number"
          ? `${players} ${players === 1 ? "aluno" : "alunos"}`
          : "pontos"}
      </small>
    </div>
  );
}
