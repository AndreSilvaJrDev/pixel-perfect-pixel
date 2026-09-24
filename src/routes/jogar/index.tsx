import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { friendlyError, lookupPin } from "@/lib/room";

export const Route = createFileRoute("/jogar/")({
  head: () => ({
    meta: [
      { title: "Entrar no jogo — Professor Play" },
      { name: "description", content: "Digite o PIN da sua turma e entre no jogo pelo celular." },
      { property: "og:title", content: "Entrar no jogo — Professor Play" },
      { property: "og:description", content: "Digite o PIN da sua turma e entre no jogo pelo celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JogarIndex,
});

function JogarIndex() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^\d{6}$/.test(pin);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await lookupPin(pin);
      if (res.status === "open") navigate({ to: "/jogar/$codigo", params: { codigo: pin } });
      else setError(friendlyError(res.status));
    } catch {
      setError(friendlyError());
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <Logo />
      <form
        onSubmit={submit}
        className="mt-8 w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
      >
        <h1 className="text-3xl font-extrabold">Entre no jogo</h1>
        <p className="mt-2 text-sm text-muted-foreground">Peça o PIN para o professor.</p>
        <div className="mt-6 space-y-2">
          <Label htmlFor="pin">PIN</Label>
          <Input
            id="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            placeholder="000000"
            aria-invalid={!!error}
            aria-describedby={error ? "pin-error" : undefined}
            className="h-16 text-center font-display text-3xl tracking-[0.35em]"
          />
          {error ? (
            <p id="pin-error" role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant="hero" size="xl" className="mt-6 w-full" disabled={!valid || busy}>
          {busy ? "Procurando sala..." : "Continuar"}
        </Button>
      </form>
      <Link to="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground">
        Sou professor
      </Link>
    </main>
  );
}
