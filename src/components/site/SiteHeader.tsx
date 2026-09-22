import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#como-funciona" className="rounded-md transition-colors hover:text-foreground">
            Como funciona
          </a>
          <a href="#modos" className="rounded-md transition-colors hover:text-foreground">
            Modos de jogo
          </a>
          <Link to="/jogar" className="rounded-md transition-colors hover:text-foreground">
            Sou aluno
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild variant="hero" size="sm">
            <Link to="/cadastro">Criar conta</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
