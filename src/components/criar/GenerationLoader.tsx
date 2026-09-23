import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const STEPS = [
  "Entendendo o conteúdo...",
  "Criando perguntas...",
  "Preparando alternativas...",
  "Revisando a atividade...",
  "Quase pronto...",
];

export function GenerationLoader() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current < STEPS.length - 1 ? current + 1 : current));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]"
      role="status"
      aria-live="polite"
    >
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent/10">
        <Sparkles className="size-7 animate-pulse text-accent" aria-hidden="true" />
      </span>
      <p className="mt-4 text-lg font-bold">{STEPS[index]}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Isso leva alguns segundos. Não feche esta página.
      </p>
      <ol className="mt-5 flex justify-center gap-2" aria-hidden="true">
        {STEPS.map((step, position) => (
          <li
            key={step}
            className={
              position <= index ? "h-2 w-8 rounded-full bg-accent" : "h-2 w-8 rounded-full bg-muted"
            }
          />
        ))}
      </ol>
    </div>
  );
}
