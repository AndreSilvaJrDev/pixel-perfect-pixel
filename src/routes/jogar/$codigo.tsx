import { useCallback, useEffect, useRef, useState } from "react";
import "@/components/game/arena.css";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Flag, Loader2, Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { teamColorVar } from "@/lib/activities";
import { getModeAdapter } from "@/components/game/modes";
import {
  Leaderboard,
  OptionGrid,
  QuestionHeader,
  TimerBadge,
  teamsOf,
} from "@/components/game/parts";
import { teamWinner } from "@/components/game/FinalResults";
import { useRoomClock } from "@/components/game/useRoomClock";
import {
  NICK_MAX,
  ROOM_EVENTS,
  SESSION_STATUS,
  clockOffset,
  formatPoints,
  submitAnswer,
  clearStoredPlayer,
  friendlyError,
  getPlayerState,
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
  const [offset, setOffset] = useState(0);
  const versionRef = useRef(-1);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const accept = useCallback((s: PlayerState) => {
    // ignora estado antigo que chegue depois de um mais novo
    if (s.version < versionRef.current) return;
    versionRef.current = s.version;
    setState(s);
    setOffset(clockOffset(s));
  }, []);

  const refresh = useCallback(
    async (p: StoredPlayer) => {
      const s = await getPlayerState(p.playerId, p.token);
      if (s.error) {
        clearStoredPlayer(codigo);
        setMe(null);
        setPhase({ kind: "checking" });
        return false;
      }
      accept(s);
      return true;
    },
    [codigo, accept],
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
            accept(s);
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
  }, [codigo, accept]);

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
    channelRef.current = channel;
    const onVisible = () => document.visibilityState === "visible" && void refresh(me);
    document.addEventListener("visibilitychange", onVisible);
    // rede de segurança leve caso algum aviso se perca
    const timer = window.setInterval(() => void refresh(me), 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [me, refresh]);

  const seconds = useRoomClock(state, offset, () => me && void refresh(me));

  async function answer(index: number) {
    if (!me || !state?.question) return;
    setState((s) =>
      s && s.me ? { ...s, me: { ...s.me, answered: true, selected_index: index } } : s,
    );
    try {
      const res = await submitAnswer(me.playerId, me.token, state.question.id, index);
      if (res.error) void refresh(me);
      else
        void channelRef.current?.send({
          type: "broadcast",
          event: ROOM_EVENTS.ANSWER_SUBMITTED,
          payload: {},
        });
    } catch {
      void refresh(me);
    }
  }

  return (
    <main className="pp-arena pp-student relative flex min-h-[100dvh] flex-col items-center">
      <div className="pointer-events-none absolute -left-24 top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 size-72 rounded-full bg-accent/10 blur-3xl" />
      <Logo className="relative" />
      <div className="pp-stage flex flex-col">
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
        {phase.kind === "joined" && state ? (
          <PlayerScreen state={state} seconds={seconds} onAnswer={(i) => void answer(i)} />
        ) : null}
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
      <Button
        type="submit"
        variant="hero"
        size="xl"
        className="mt-6 w-full"
        disabled={busy || clean.length < 2}
      >
        {busy ? "Entrando..." : "Entrar no jogo"}
      </Button>
    </form>
  );
}

function TeamTag({ state }: { state: PlayerState }) {
  const t = state.me?.team;
  if (!t) return null;
  const team = teamsOf(state)[t === "a" ? 0 : 1];
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border-4 bg-card p-3"
      style={{ borderColor: teamColorVar(team.color) }}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: teamColorVar(team.color) }}
        aria-hidden="true"
      >
        <Users className="size-5 text-primary-foreground" />
      </span>
      <p className="font-extrabold">Você está no {team.name}</p>
    </div>
  );
}

function PlayerScreen({
  state,
  seconds,
  onAnswer,
}: {
  state: PlayerState;
  seconds: number;
  onAnswer: (i: number) => void;
}) {
  const me = state.me;
  const adapter = getModeAdapter(state.game_mode);

  if (state.status === SESSION_STATUS.LOBBY) {
    return (
      <div className="space-y-4">
        <Card>
          <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
          <p className="mt-4 text-3xl font-extrabold">Você entrou!</p>
          <p className="mt-2 break-words font-display text-2xl font-bold text-primary">
            {me?.nickname}
          </p>
          <p
            role="status"
            className="mt-4 flex items-center justify-center gap-2 text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Aguardando o professor começar...
          </p>
          <p className="mt-5 text-sm font-semibold text-muted-foreground">{state.title}</p>
        </Card>
        <TeamTag state={state} />
      </div>
    );
  }

  if (state.status === SESSION_STATUS.STARTING) {
    return (
      <div className="space-y-4">
        <Card>
          <QuestionHeader view={state} />
          {state.question_index === 0 ? (
            <p className="mt-3 text-2xl font-extrabold">O jogo começou!</p>
          ) : null}
          <p className="mt-2 text-muted-foreground">
            Prepare-se para a {state.question_index === 0 ? "primeira" : "próxima"} pergunta.
          </p>
          <p className="mt-4 font-display text-7xl font-extrabold text-primary" aria-live="polite">
            {seconds > 0 ? seconds : "Já!"}
          </p>
        </Card>
        <TeamTag state={state} />
      </div>
    );
  }

  if (state.status === SESSION_STATUS.QUESTION) {
    const answered = !!me?.answered;
    return (
      <div className="space-y-4">
        {adapter.id === "cabo" && adapter.Panel ? <adapter.Panel view={state} meId={me?.id} /> : null}
        <div className="flex items-center justify-between gap-3">
          <QuestionHeader view={state} />
          <TimerBadge seconds={seconds} />
        </div>
        <h1 className="pp-question break-words font-extrabold">{state.question?.prompt}</h1>
        <OptionGrid
          view={state}
          size="lg"
          selected={me?.selected_index}
          disabled={answered || seconds === 0}
          onPick={onAnswer}
        />
        {answered ? (
          <p
            role="status"
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary/10 p-4 font-bold text-primary"
          >
            <Send className="size-5" aria-hidden="true" /> Resposta enviada! Aguarde os colegas.
          </p>
        ) : null}
      </div>
    );
  }

  if (state.status === SESSION_STATUS.REVEAL) {
    const correctText = state.question?.options[state.correct_index ?? 0] ?? "";
    const myTeam = me?.team;
    const ra = state.round_team_a ?? 0;
    const rb = state.round_team_b ?? 0;
    return (
      <div className="space-y-4">
        <Card>
          {me?.is_correct ? (
            <>
              <p className="text-3xl font-extrabold text-success">Acertou! 🎉</p>
              <p className="mt-2 font-display text-3xl font-extrabold">
                +{formatPoints(me.score_awarded ?? 0)} pontos
              </p>
            </>
          ) : (
            <p className="text-2xl font-extrabold">
              {me?.answered ? "Não foi dessa vez." : "Tempo esgotado."}
            </p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">Resposta correta</p>
          <p className="break-words text-xl font-bold">
            {adapter.optionLabel(state.correct_index ?? 0, correctText).text}
          </p>
          {state.explanation ? (
            <p className="mt-3 text-sm text-muted-foreground">{state.explanation}</p>
          ) : null}
        </Card>
        {adapter.teams && myTeam ? (
          <Card>
            <p className="text-lg font-extrabold">
              {(myTeam === "a" ? ra : rb) > 0
                ? `Seu time ganhou +${formatPoints(myTeam === "a" ? ra : rb)} pontos!`
                : ra === rb
                  ? "Rodada empatada."
                  : `O ${ra > rb ? state.team_a_name : state.team_b_name} ganhou esta rodada.`}
            </p>
          </Card>
        ) : null}
        {adapter.Panel ? <adapter.Panel view={state} meId={me?.id} /> : null}
      </div>
    );
  }

  if (state.status === SESSION_STATUS.LEADERBOARD) {
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-3xl font-extrabold">Você está em {me?.rank}º lugar</p>
          <p className="mt-2 text-muted-foreground">Pontuação total</p>
          <p className="font-display text-3xl font-extrabold">{formatPoints(me?.score ?? 0)}</p>
        </Card>
        {adapter.Panel ? <adapter.Panel view={state} meId={me?.id} /> : null}
        <Leaderboard rows={state.ranking} limit={5} highlightId={me?.id} view={state} />
      </div>
    );
  }

  // FINISHED
  const r = state.results;
  const winner = r && adapter.teams ? teamWinner(state, r) : null;
  return (
    <div className="space-y-4">
      {r && me ? (
        <Card>
          <p className="text-3xl font-extrabold">Você terminou em {me.rank}º lugar!</p>
          <p className="mt-3 text-lg font-bold">
            {me.correct_count} de {r.questions_asked} acertos
          </p>
          <p className="font-display text-3xl font-extrabold text-primary">
            {formatPoints(me.score)} pontos
          </p>
          {adapter.teams ? (
            <p className="mt-4 text-xl font-extrabold">
              {winner ? `${winner.name} venceu!` : "Empate!"}
            </p>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Flag className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <p role="status" className="mt-4 text-xl font-extrabold">
            Essa partida foi encerrada pelo professor.
          </p>
        </Card>
      )}
      <Button asChild variant="outline" size="lg" className="w-full">
        <Link to="/jogar">Entrar em outro jogo</Link>
      </Button>
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
