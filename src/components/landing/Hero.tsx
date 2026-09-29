import { Link } from "@tanstack/react-router";
import { QrCode, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroAsset from "@/assets/hero-professor-play.png";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div
        className="surface-grid pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
            Professor Play está em fase de lançamento
          </span>
          <h1 className="mt-5 text-balance-tight text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
            Transforme qualquer matéria em um jogo em poucos minutos.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Escolha o conteúdo, deixe a IA criar as perguntas e seus alunos entram pelo celular
            usando um simples QR Code.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="hero" size="xl">
              <Link to="/cadastro">Criar meu primeiro jogo</Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <a href="#como-funciona">Ver como funciona</a>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <li className="inline-flex items-center gap-2">
              <QrCode className="size-4 text-primary" aria-hidden="true" />
              Entrada por PIN ou QR Code
            </li>
            <li className="inline-flex items-center gap-2">
              <Smartphone className="size-4 text-accent" aria-hidden="true" />
              Aluno joga sem criar conta
            </li>
          </ul>
        </div>

        <div className="relative">
          <div className="absolute -inset-3 rounded-[2rem] bg-highlight/25" aria-hidden="true" />
          <img
            src={heroAsset}
            alt="Professor Play no computador com QR Code, celulares dos alunos e ranking da turma"
            width={1456}
            height={1088}
            loading="eager"
            className="relative mx-auto w-full max-w-lg rounded-[1.75rem] border border-border bg-card object-contain shadow-[var(--shadow-lift)] lg:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}
