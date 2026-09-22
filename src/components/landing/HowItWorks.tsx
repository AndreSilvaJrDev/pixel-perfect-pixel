import { ListChecks, Play, Trophy, Wand2 } from "lucide-react";

const steps = [
  {
    icon: Wand2,
    title: "Escolha o tema",
    text: "Ano, matéria e assunto da aula. A IA escreve as perguntas.",
  },
  {
    icon: ListChecks,
    title: "Revise as perguntas",
    text: "Você edita o que quiser antes de salvar a atividade.",
  },
  {
    icon: Play,
    title: "Comece a partida",
    text: "O sistema gera um PIN e um QR Code para a turma.",
  },
  {
    icon: Trophy,
    title: "Veja o ranking",
    text: "Pontuação, acertos e pódio no fim do jogo.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Como funciona</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Você ensina. O Professor Play transforma em jogo.
        </p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <step.icon className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Passo {index + 1}
              </p>
              <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
