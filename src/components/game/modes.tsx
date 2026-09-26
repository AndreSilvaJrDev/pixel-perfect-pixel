/**
 * GAME MODE ADAPTERS.
 * O core (pergunta, timer, resposta, pontuação, transições) é o mesmo para todos os modos e roda no servidor.
 * Cada modo só decide apresentação: rótulo das alternativas e painel extra (corda, pista...).
 */
import type { ReactNode } from "react";
import { TEAM_COLORS } from "@/lib/activities";
import type { RoomView } from "@/lib/room";
import { TugOfWar } from "./TugOfWar";
import { RaceTrack, teamsOf } from "./parts";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const LETTER_TONES = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-highlight text-highlight-foreground",
  "bg-success text-success-foreground",
];

type OptionLabel = { badge: string; text: string; tone: string };

export type GameModeAdapter = {
  id: string;
  optionLabel: (index: number, text: string) => OptionLabel;
  /** Painel do modo (corda, pista). null = só ranking individual. */
  Panel: ((props: { view: RoomView; meId?: string | undefined }) => ReactNode) | null;
  teams: boolean;
};

const letters = (i: number, text: string): OptionLabel => ({
  badge: LETTERS[i] ?? String(i + 1),
  text,
  tone: LETTER_TONES[i % LETTER_TONES.length] ?? LETTER_TONES[0]!,
});

function TugPanel({ view }: { view: RoomView }) {
  const [a, b] = teamsOf(view);
  const count = (t: "a" | "b") => view.ranking.filter((r) => r.team === t).length;
  return (
    <TugOfWar
      teamA={a}
      teamB={b}
      scoreA={view.team_a_score}
      scoreB={view.team_b_score}
      playersA={count("a")}
      playersB={count("b")}
    />
  );
}

const ADAPTERS: Record<string, GameModeAdapter> = {
  batalha: { id: "batalha", optionLabel: letters, Panel: null, teams: false },
  vf: {
    id: "vf",
    optionLabel: (i, text) => ({
      badge: i === 0 ? "✓" : "✕",
      text,
      tone:
        i === 0
          ? "bg-success text-success-foreground"
          : "bg-destructive text-destructive-foreground",
    }),
    Panel: null,
    teams: false,
  },
  corrida: {
    id: "corrida",
    optionLabel: letters,
    Panel: ({ view, meId }) => <RaceTrack view={view} meId={meId} />,
    teams: false,
  },
  cabo: { id: "cabo", optionLabel: letters, Panel: TugPanel, teams: true },
};

export function getModeAdapter(mode: string): GameModeAdapter {
  return ADAPTERS[mode] ?? ADAPTERS["batalha"]!;
}

export const KNOWN_TEAM_COLORS = TEAM_COLORS;
