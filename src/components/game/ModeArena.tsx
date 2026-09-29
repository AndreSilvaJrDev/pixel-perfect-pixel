import { Flag, Lightbulb, Sparkles } from "lucide-react";
import battleArt from "@/assets/arena-batalha.png";
import truthArt from "@/assets/arena-vf.png";
import raceArt from "@/assets/arena-corrida.png";
import { formatPoints, type RoomView } from "@/lib/room";
import "./arena.css";

const scenes = {
  batalha: { title: "Batalha do Conhecimento", hint: "Cada pergunta é uma nova chance.", image: battleArt, Icon: Sparkles },
  vf: { title: "Verdadeiro ou Falso", hint: "Observe, pense e faça sua escolha.", image: truthArt, Icon: Lightbulb },
  corrida: { title: "Corrida do Saber", hint: "Cada acerto leva você mais longe.", image: raceArt, Icon: Flag },
};
const phases: Record<string, string> = {
  lobby: "Esperando a turma", starting: "Prepare-se", question: "Sua vez de responder",
  answering: "Respostas em andamento", reveal: "Vamos conferir?", leaderboard: "Placar da rodada", finished: "Partida concluída",
};

/** Decorative artwork is separate from authoritative scores and question data. */
export function ModeArena({ view }: { view: RoomView }) {
  const mode = view.game_mode as keyof typeof scenes;
  const scene = scenes[mode];
  if (!scene) return null;
  const { Icon } = scene;
  const total = Math.max(0, view.total_questions);
  const round = view.status === "lobby" ? 0 : Math.min(total, Math.max(0, view.question_index + 1));
  const progress = total ? round / total * 100 : 0;
  const me = view.me;
  return (
    <section className={`pp-mode-arena pp-mode-${mode}`} aria-label={scene.title}>
      <div className="pp-mode-hero">
        <div className="pp-mode-copy">
          <Icon aria-hidden="true" size={28} />
          <h3>{scene.title}</h3>
          <p>{scene.hint}</p>
          <span className="pp-mode-phase">{phases[view.status] ?? "Em jogo"}</span>
        </div>
        <img className="pp-mode-art" src={scene.image} alt="" width={1672} height={941} decoding="async" />
      </div>
      <dl className="pp-mode-stats">
        <div><dt>{view.status === "lobby" ? "Perguntas" : "Rodada"}</dt><dd>{view.status === "lobby" ? total : `${round} / ${total}`}</dd></div>
        <div><dt>{me ? "Seus pontos" : "Participantes"}</dt><dd>{me ? formatPoints(me.score) : view.players_count}</dd></div>
        <div><dt>{me ? "Sua posição" : "Respostas na rodada"}</dt><dd>{me ? (me.rank > 0 && view.status !== "lobby" ? `${me.rank}º` : "—") : (typeof view.answered_count === "number" && view.status !== "lobby" ? `${view.answered_count} / ${view.players_count}` : "—")}</dd></div>
      </dl>
      <div className="pp-mode-progress" role="progressbar" aria-label="Andamento das perguntas" aria-valuemin={0} aria-valuemax={Math.max(1, total)} aria-valuenow={round}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
