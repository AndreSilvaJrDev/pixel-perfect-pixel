import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/jogar/$codigo")({
  head: () => ({
    meta: [
      { title: "Sala do jogo — Professor Play" },
      { name: "description", content: "Escolha seu apelido e espere o professor começar." },
      { property: "og:title", content: "Sala do jogo — Professor Play" },
      {
        property: "og:description",
        content: "Escolha seu apelido e espere o professor começar.",
      },
    ],
  }),
  component: SalaAluno,
});

function SalaAluno() {
  const { codigo } = Route.useParams();
  const [nickname, setNickname] = useState("");
  const [entrou, setEntrou] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <Logo />
      <div className="mt-8 w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          PIN da partida
        </p>
        <p className="font-display text-3xl font-extrabold tracking-[0.2em]">{codigo}</p>

        {entrou ? (
          <div className="mt-6 space-y-3 text-center">
            <p className="text-lg font-bold">Tudo pronto, {nickname}!</p>
            <p className="text-sm text-muted-foreground">
              Espere o professor começar a partida. Deixe esta tela aberta.
            </p>
            <div className="flex justify-center gap-1.5 pt-2" aria-hidden="true">
              <span className="size-2.5 animate-pulse rounded-full bg-primary" />
              <span className="size-2.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
              <span className="size-2.5 animate-pulse rounded-full bg-highlight [animation-delay:300ms]" />
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              As partidas ao vivo chegam na próxima versão do Professor Play.
            </p>
          </div>
        ) : (
          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              setEntrou(true);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="nickname">Seu apelido</Label>
              <Input
                id="nickname"
                required
                maxLength={16}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex.: Lulu"
                className="h-14 text-lg"
              />
            </div>
            <Button type="submit" variant="hero" size="xl" className="mt-6 w-full">
              Entrar na sala
            </Button>
          </form>
        )}
      </div>

      <Link to="/jogar" className="mt-6 text-sm text-muted-foreground hover:text-foreground">
        Trocar de PIN
      </Link>
    </main>
  );
}
