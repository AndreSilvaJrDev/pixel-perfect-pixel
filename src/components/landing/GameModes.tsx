import { Flag, Ropes, Swords, ToggleLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const modes = [
  {
    icon: Swords,
    name: "Batalha do Saber",
    text: "Pergunta com 4 alternativas. Pontua quem acerta e responde rápido.",
    status: "Na V1",
  },
  {
    icon: ToggleLeft,
    name: "Verdadeiro ou Falso",
    text: "Duas opções, decisão rápida. Ótimo para revisão.",
    status: "Na V1",
  },
  {
    icon: Flag,
    name: "Corrida do Saber",
    text: "Cada acerto faz o aluno avançar na pista da turma.",
    status: "Na V1",
  },
  {
    icon: Ropes,
    name: "Cabo de Guerra",
    text: "Dois times. Cada acerto puxa a corda para o lado da equipe.",
    status: "Novo",
  },
];

export function GameModes() {
  return (
    <section id="modos" className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Modos de jogo</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Poucos modos, bem feitos, que funcionam em qualquer celular.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modes.map((mode) => (
            <article
              key={mode.name}
              className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <mode.icon className="size-5" aria-hidden="true" />
                </span>
                <Badge variant="secondary">{mode.status}</Badge>
              </div>
              <h3 className="mt-4 text-lg font-bold">{mode.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{mode.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
