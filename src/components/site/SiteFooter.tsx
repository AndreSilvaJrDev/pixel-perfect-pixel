import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-muted-foreground">Transforme sua aula em jogo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/jogar" className="transition-colors hover:text-foreground">
            Entrar em um jogo
          </Link>
          <Link to="/login" className="transition-colors hover:text-foreground">
            Área do professor
          </Link>
          <span>Professor Play está em fase de lançamento.</span>
        </div>
      </div>
    </footer>
  );
}
