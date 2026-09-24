import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Flag, Loader2, Rocket, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { teamColorVar } from "@/lib/activities";
import {
  NICK_MAX,
  SESSION_STATUS,
  clearStoredPlayer,
  friendlyError,
  getPlayerState,
  isInGame,
  joinGame,
  loadStoredPlayer,
  lookupPin,
  normalizeNickname,
  roomChannelName,
  saveStoredPlayer,
  type PlayerState,
  type StoredPlayer,
} from "@/lib/room";

export const Route = createFileRoute("/jogar/$codigo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sala do jogo — Professor Play" },
      { name: "description", content: "Escolha seu apelido e espere o professor começar." },
      { property: "og:title", content: "Sala do jogo — Professor Play" },
      { property: "og:description", content: "Escolha seu apelido e espere o professor começar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalaAluno,
});

type Phase =
  | { kind: "checking" }
  | { kind: "blocked"; message: string }
  | { kind: "nickname"; title: string }
  | { kind: "joined" };

function SalaAluno() {
  const { codigo } = Route.useParams();
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [me, setMe] = useState<StoredPlayer | null>(null);
  const [state, setState] = useState<PlayerState | null>(null);

  const refresh = useCallback(
    async (p: StoredPlayer) => {
      const s = await getPlayerState(p.playerId, p.token);
      if (s.error) {
        clearStoredPlayer(codigo);
        setMe(null);
        setPhase({ kind: "checking" });
        return false;
      }
      setState(s);
      return true;
    },
    [codigo],
  );

  // inicial: reconecta com token salvo ou valida o PIN
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = loadStoredPlayer(codigo);
        if (stored) {
          const s = await getPlayerState(stored.playerId, stored.token);
          if (cancelled) return;
          if (!s.error) {
            setMe(stored);
            setState(s);
            setPhase({ kind: "joined" });
            return;
          }
          clearStoredPlayer(codigo);
        }
        const res = await lookupPin(codigo);
        if (cancelled) return;
        if (res.status === "open") setPhase({ kind: "nickname", title: res.title });
        else setPhase({ kind: "blocked", message: friendlyError(res.status) });
      } catch {
        if (!cancelled) setPhase({ kind: "blocked", message: friendlyError() });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codigo]);

  // realtime: presença + avisos do professor
  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel(roomChannelName(me.sessionId), {
      config: { presence: { key: me.playerId } },
    });
    channel
      .on("broadcast", { event: "*" }, () => void refresh(me))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ player_id: me.playerId, at: Date.now() });
          void refresh(me);
        }
      });
    const onVisible = () => document.visibilityState === "visible" && void refresh(me);
    document.addEventListener("visibilitychange", onVisible);
    // rede de segurança leve caso algum aviso se perca
    const timer = window.setInterval(() => void refresh(me), 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [me, refresh]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-surface px-4 py-8">
      <Logo />
      <div className="mt-8 flex w-full max-w-sm flex-1 flex-col">
        {phase.kind === "checking" ? (
          <div className="flex flex-1 items-center justify-center" role="status">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Carregando</span>
          </div>
        ) : null}
        {phase.kind === "blocked" ? <Blocked message={phase.message} /> : null}
        {phase.kind === "nickname" ? (
          <NicknameForm
            pin={codigo}
            title={phase.title}
            onJoined={(p) => {
              saveStoredPlayer(codigo, p);
              setMe(p);
              setPhase({ kind: "joined" });
            }}
            onBlocked={(m) => setPhase({ kind: "blocked", message: m })}
          />
        ) : null}
        {phase.kind === "joined" && state ? <Waiting state={state} /> : null}
      </div>
    </main>
  );
}

function Blocked({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
      <p role="alert" className="text-xl font-extrabold">
        {message}
      </p>
      <Button asChild variant="hero" size="xl" className="mt-6 w-full">
        <Link to="/jogar">Digitar outro PIN</Link>
      </Button>
    </div>
  );
}

function NicknameForm({
  pin,
  title,
  onJoined,
  onBlocked,
}: {
  pin: string;
  title: string;
  onJoined: (p: StoredPlayer) => void;
  onBlocked: (message: string) => void;
}) {
  const [nick, setNick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = normalizeNickname(nick);
  const ref = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await joinGame(pin, clean);
      if (res.error !== undefined) {
        if (["not_found", "finished", "expired", "started"].includes(res.error)) {
          onBlocked(friendlyError(res.error));
        } else {
          setError(friendlyError(res.error));
          ref.current?.focus();
        }
        return;
      }
      onJoined({ playerId: res.player_id, token: res.token, sessionId: res.session_id });
    } catch {
      setError(friendlyError());
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
    >
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      <h1 className="mt-1 text-2xl font-extrabold">Como você quer aparecer no jogo?</h1>
      <div className="mt-6 space-y-2">
        <Label htmlFor="nick">Apelido</Label>
        <Input
          ref={ref}
          id="nick"
          autoFocus
          autoComplete="off"
          maxLength={NICK_MAX}
          value={nick}
          onChange={(e) => {
            setNick(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "nick-error" : undefined}
          className="h-14 text-lg"
        />
        {error ? (
          <p id="nick-error" role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" variant="hero" size="xl" className="mt-6 w-full" disabled={busy || clean.length < 2}>
        {busy ? "Entrando..." : "Entrar no jogo"}
      </Button>
    </form>
  );
}

function Waiting({ state }: { state: PlayerState }) {
  const team =
    state.team === "a"
      ? { name: state.team_a_name, color: state.team_a_color }
      : state.team === "b"
        ? { name: state.team_b_name, color: state.team_b_color }
        : null;

  if (state.status === SESSION_STATUS.FINISHED) {
    return (
      <Card>
        <Flag className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <p role="status" className="mt-4 text-xl font-extrabold">
          Essa partida foi encerrada pelo professor.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-6 w-full">
          <Link to="/jogar">Entrar em outro jogo</Link>
        </Button>
      </Card>
    );
  }

  const started = isInGame(state.status);
  return (
    <div className="space-y-4">
      <Card>
        {started ? (
          <>
            <Rocket className="mx-auto size-10 text-primary" aria-hidden="true" />
            <p role="status" className="mt-4 text-3xl font-extrabold">O jogo começou!</p>
            <p className="mt-2 text-muted-foreground">Prepare-se para a primeira pergunta.</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
            <p className="mt-4 text-3xl font-extrabold">Você entrou!</p>
            <p className="mt-2 break-words font-display text-2xl font-bold text-primary">
              {state.nickname}
            </p>
            <p role="status" className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Aguardando o professor começar...
            </p>
          </>
        )}
        <p className="mt-5 text-sm font-semibold text-muted-foreground">{state.title}</p>
      </Card>
      {team ? (
        <div
          className="flex items-center gap-4 rounded-3xl border-4 bg-card p-5"
          style={{ borderColor: teamColorVar(team.color) }}
        >
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: teamColorVar(team.color) }}
            aria-hidden="true"
          >
            <Users className="size-6 text-primary-foreground" />
          </span>
          <p className="text-xl font-extrabold">Você está no {team.name}</p>
        </div>
      ) : null}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
      {children}
    </div>
  );
}
