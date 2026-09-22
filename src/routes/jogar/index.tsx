import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/jogar/")({
  head: () => ({
    meta: [
      { title: "Entrar no jogo — Professor Play" },
      { name: "description", content: "Digite o PIN da sua turma e entre no jogo pelo celular." },
      { property: "og:title", content: "Entrar no jogo — Professor Play" },
      {
        property: "og:description",
        content: "Digite o PIN da sua turma e entre no jogo pelo celular.",
      },
    ],
  }),
  component: JogarIndex,
});

function JogarIndex() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const valid = /^\d{6}$/.test(pin);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <Logo />
      <form
        className="mt-8 w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) navigate({ to: "/jogar/$codigo", params: { codigo: pin } });
        }}
      >
        <h1 className="text-2xl font-extrabold">Entrar no jogo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Peça o PIN para o professor. Você não precisa criar conta.
        </p>

        <div className="mt-6 space-y-2">
          <Label htmlFor="pin">PIN da partida</Label>
          <Input
            id="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="h-16 text-center font-display text-3xl tracking-[0.35em]"
          />
        </div>

        <Button type="submit" variant="hero" size="xl" className="mt-6 w-full" disabled={!valid}>
          Entrar
        </Button>
      </form>

      <Link to="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground">
        Sou professor
      </Link>
    </main>
  );
}
