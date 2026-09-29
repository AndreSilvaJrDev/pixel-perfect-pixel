import { useCallback, useEffect, useRef, useState } from "react";
import "@/components/game/arena.css";
import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  BarChart3,
  ChevronRight,
  Copy,
  Flag,
  Link2,
  Play,
  QrCode,
  Square,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TugOfWar } from "@/components/game/TugOfWar";
import { getModeAdapter } from "@/components/game/modes";
import {
  Distribution,
  Leaderboard,
  OptionGrid,
  QuestionHeader,
  TimerBadge,
  teamsOf,
} from "@/components/game/parts";
import { FinalResults } from "@/components/game/FinalResults";
import { useRoomClock } from "@/components/game/useRoomClock";
import { gameModeLabel, isTeamMode, teamColorVar, type TeamSetup } from "@/lib/activities";
import {
  ROOM_EVENTS,
  SESSION_STATUS,
  clockOffset,
  formatPoints,
  hostRpc,
  joinBaseUrl,
  joinUrl,
  roomChannelName,
  type RankingRow,
  type RoomView,
} from "@/lib/room";

export const Route = createFileRoute("/app/sala/$id")({
  head: () => ({
    meta: [
      { title: "Sala ao vivo — Professor Play" },
      { name: "description", content: "Conduza a partida: perguntas, tempo, respostas e ranking." },
      { property: "og:title", content: "Sala ao vivo — Professor Play" },
      {
        property: "og:description",
        content: "Conduza a partida: perguntas, tempo, respostas e ranking.",
      },
    ],
  }),
  component: SalaProfessor,
});

function SalaProfessor() {
  const { id } = Route.useParams();
  const [view, setView] = useState<RoomView | null>(null);
  const [offset, setOffset] = useState(0);
  const [missing, setMissing] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const versionRef = useRef<number | null>(null);

  const notify = (event: string) =>
    void channelRef.current?.send({ type: "broadcast", event, payload: { at: Date.now() } });

  const apply = useCallback((v: RoomView) => {
    setView(v);
    setOffset(clockOffset(v));
    // qualquer mudança de estado (inclusive fechamento automático) é avisada aos alunos
    if (versionRef.current !== null && versionRef.current !== v.version) {
      void channelRef.current?.send({
        type: "broadcast",
        event: ROOM_EVENTS.SESSION_UPDATED,
        payload: {},
      });
    }
    versionRef.current = v.version;
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await hostRpc.state(id));
    } catch {
      setMissing(true);
    }
  }, [id, apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase.channel(roomChannelName(id), {
      config: { presence: { key: "host" } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState()).filter((k) => k !== "host")));
      })
      .on("broadcast", { event: ROOM_EVENTS.ANSWER_SUBMITTED }, () => void refresh())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `session_id=eq.${id}` },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ host: true });
      });
    channelRef.current = channel;
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [id, refresh]);

  const seconds = useRoomClock(view, offset, () => void refresh());

  async function act(fn: () => Promise<RoomView>, errorMsg = "Não foi possível atualizar a sala.") {
    if (busy) return;
    setBusy(true);
    try {
      apply(await fn());
      notify(ROOM_EVENTS.SESSION_UPDATED);
    } catch {
      toast.error(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  async function movePlayer(p: RankingRow) {
    const team = p.team === "a" ? "b" : "a";
    const { error } = await supabase.from("players").update({ team }).eq("id", p.id);
    if (error) return void toast.error("Não foi possível mover o jogador.");
    await refresh();
    notify(ROOM_EVENTS.TEAM_UPDATED);
  }

  if (missing) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="font-bold">Sala não encontrada</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/app/biblioteca">Voltar para a biblioteca</Link>
        </Button>
      </div>
    );
  }
  if (!view) return <Skeleton className="h-96 rounded-3xl" />;

  const finished = view.status === SESSION_STATUS.FINISHED;
  const adapter = getModeAdapter(view.game_mode);
  const isLast = view.question_index + 1 >= view.total_questions;

  return (
    <div className="pp-arena space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">
            {gameModeLabel(view.game_mode)}
          </p>
          <h1 className="break-words text-2xl font-extrabold sm:text-3xl">{view.title}</h1>
        </div>
        {!finished ? (
          confirmEnd ? (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Confirmar encerramento"
            >
              <span className="text-sm font-semibold">Encerrar para todos?</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setConfirmEnd(false);
                  void act(() => hostRpc.finish(id));
                }}
              >
                Sim, encerrar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmEnd(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmEnd(true)}>
              <Square className="size-4" aria-hidden="true" />
              Encerrar partida
            </Button>
          )
        ) : null}
      </header>

      {view.status === SESSION_STATUS.LOBBY ? (
        <Lobby
          view={view}
          online={online}
          busy={busy}
          onStart={() =>
            void act(() => hostRpc.start(id), "Não foi possível começar. Confira se há perguntas.")
          }
          onMove={(p) => void movePlayer(p)}
        />
      ) : null}

      {view.status === SESSION_STATUS.STARTING ? (
        <section
          className="pp-countdown rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]"
          role="status"
        >
          <QuestionHeader view={view} />
          <p className="mt-4 font-display text-7xl font-extrabold text-primary" aria-live="polite">
            {seconds > 0 ? seconds : "Já!"}
          </p>
          <p className="mt-2 text-muted-foreground">Prepare a turma.</p>
        </section>
      ) : null}

      {view.status === SESSION_STATUS.QUESTION ? (
        <section className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <QuestionHeader view={view} />
            <TimerBadge seconds={seconds} large />
          </div>
          <h2 className="pp-question break-words font-extrabold">{view.question?.prompt}</h2>
          <OptionGrid view={view} size="lg" />
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xl font-extrabold" aria-live="polite">
              {view.answered_count ?? 0} / {view.players_count} responderam
            </p>
            <Button
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => void act(() => hostRpc.closeQuestion(id))}
            >
              Encerrar pergunta
            </Button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{
                width: `${((view.answered_count ?? 0) / Math.max(1, view.players_count)) * 100}%`,
              }}
            />
          </div>
        </section>
      ) : null}

      {view.status === SESSION_STATUS.REVEAL ? (
        <section className="space-y-5">
          <div className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <QuestionHeader view={view} />
            <h2 className="break-words text-2xl font-extrabold">{view.question?.prompt}</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <OptionGrid view={view} />
              <div className="space-y-3">
                <p className="font-bold">
                  {accuracy(view)}% de acerto · {view.answered_count ?? 0} de {view.players_count}{" "}
                  responderam
                </p>
                <Distribution view={view} />
              </div>
            </div>
            {view.explanation ? (
              <p className="rounded-2xl bg-muted p-4 text-sm">
                <span className="font-bold">Explicação: </span>
                {view.explanation}
              </p>
            ) : null}
          </div>
          {adapter.teams ? <RoundTeams view={view} /> : null}
          {adapter.Panel ? <adapter.Panel view={view} /> : null}
          <div className="flex justify-end">
            <Button
              variant="hero"
              size="xl"
              disabled={busy}
              onClick={() => void act(() => hostRpc.leaderboard(id))}
            >
              <BarChart3 className="size-5" aria-hidden="true" /> Ver ranking
            </Button>
          </div>
        </section>
      ) : null}

      {view.status === SESSION_STATUS.LEADERBOARD ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-2xl font-extrabold">
              <Trophy className="size-6 text-highlight-foreground" aria-hidden="true" /> Ranking
            </h2>
            <QuestionHeader view={view} />
          </div>
          {adapter.Panel ? <adapter.Panel view={view} /> : null}
          <Leaderboard rows={view.ranking} view={view} />
          <div className="flex justify-end">
            <Button
              variant="hero"
              size="xl"
              disabled={busy}
              onClick={() => void act(() => hostRpc.next(id, view.question_index))}
            >
              {isLast ? (
                <>
                  <Flag className="size-5" aria-hidden="true" /> Ver resultado final
                </>
              ) : (
                <>
                  Próxima pergunta <ChevronRight className="size-5" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </section>
      ) : null}

      {finished ? (
        view.results ? (
          <FinalResults view={view} results={view.results} />
        ) : (
          <section
            role="status"
            className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <p className="text-2xl font-extrabold">Partida encerrada</p>
            <p className="text-sm text-muted-foreground">O PIN não aceita mais alunos.</p>
          </section>
        )
      ) : null}
    </div>
  );
}

function accuracy(view: RoomView) {
  const dist = view.distribution ?? [];
  const ok = dist[view.correct_index ?? -1] ?? 0;
  return view.players_count ? Math.round((ok / view.players_count) * 100) : 0;
}

function RoundTeams({ view }: { view: RoomView }) {
  const [a, b] = teamsOf(view);
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { team: a, pts: view.round_team_a ?? 0 },
        { team: b, pts: view.round_team_b ?? 0 },
      ].map(({ team, pts }) => (
        <div
          key={team.name}
          className="rounded-2xl border-4 bg-card p-4 text-center"
          style={{ borderColor: teamColorVar(team.color) }}
        >
          <p className="text-sm font-bold uppercase">{team.name}</p>
          <p className="font-display text-2xl font-extrabold">+{formatPoints(pts)}</p>
          <p className="text-xs text-muted-foreground">nesta rodada</p>
        </div>
      ))}
    </div>
  );
}

function Lobby({
  view,
  online,
  busy,
  onStart,
  onMove,
}: {
  view: RoomView;
  online: Set<string>;
  busy: boolean;
  onStart: () => void;
  onMove: (p: RankingRow) => void;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const players = view.ranking;
  const teamMode = isTeamMode(view.game_mode);
  const teams = teamsOf(view);
  const link = joinUrl(view.pin);
  const copy = (text: string, msg: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(msg));

  return (
    <>
      <section className="pp-lobby grid gap-6 shadow-[var(--shadow-card)] md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Entre em
          </p>
          <p className="break-all font-display text-lg font-bold sm:text-2xl">
            {joinBaseUrl().replace(/^https?:\/\//, "")}
          </p>
          <p className="mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            PIN
          </p>
          <p
            className="pp-pin font-display font-extrabold"
            aria-label={`PIN ${view.pin.split("").join(" ")}`}
          >
            {view.pin}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copy(view.pin, "PIN copiado.")}>
              <Copy className="size-4" aria-hidden="true" /> Copiar PIN
            </Button>
            <Button variant="outline" onClick={() => void copy(link, "Link copiado.")}>
              <Link2 className="size-4" aria-hidden="true" /> Copiar link
            </Button>
            <Button variant="outline" onClick={() => setQrOpen(true)}>
              <QrCode className="size-4" aria-hidden="true" /> Mostrar QR Code
            </Button>
          </div>
        </div>
        <div className="pp-lobby-qr mx-auto">
          <QRCodeSVG value={link} size={200} level="M" title={`QR Code para ${link}`} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-2xl font-extrabold" aria-live="polite">
            <Users className="size-6 text-primary" aria-hidden="true" />
            {players.length} {players.length === 1 ? "jogador" : "jogadores"}
            <span className="text-sm font-semibold text-muted-foreground">
              · {online.size} conectados
            </span>
          </p>
          <Button
            variant="hero"
            size="xl"
            disabled={players.length === 0 || busy}
            onClick={onStart}
          >
            <Play className="size-5" aria-hidden="true" /> Começar jogo
          </Button>
        </div>
        {players.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
            Seus alunos entram pelo celular. Os nomes aparecem aqui.
          </p>
        ) : teamMode ? (
          <>
            <TugOfWar
              teamA={teams[0]}
              teamB={teams[1]}
              scoreA={0}
              scoreB={0}
              playersA={players.filter((p) => p.team === "a").length}
              playersB={players.filter((p) => p.team === "b").length}
            />
            <div className="grid gap-4 md:grid-cols-2">
              {(["a", "b"] as const).map((key, i) => (
                <TeamColumn
                  key={key}
                  team={teams[i] as TeamSetup}
                  other={teams[i === 0 ? 1 : 0] as TeamSetup}
                  players={players.filter((p) => p.team === key)}
                  online={online}
                  onMove={onMove}
                />
              ))}
            </div>
          </>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {players.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-semibold ${online.has(p.id) ? "" : "opacity-60"}`}
              >
                <OnlineIcon on={online.has(p.id)} />
                {p.nickname}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-lg text-center">
          <DialogTitle className="text-2xl">Aponte a câmera do celular</DialogTitle>
          <div className="mx-auto rounded-2xl bg-background p-4">
            <QRCodeSVG value={link} size={320} level="M" className="h-auto max-w-full" />
          </div>
          <p className="font-display text-5xl font-extrabold tracking-[0.12em] text-primary">
            {view.pin}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OnlineIcon({ on }: { on: boolean }) {
  return (
    <>
      {on ? (
        <Wifi className="size-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <WifiOff className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="sr-only">{on ? "(conectado)" : "(desconectado)"}</span>
    </>
  );
}

function TeamColumn({
  team,
  other,
  players,
  online,
  onMove,
}: {
  team: TeamSetup;
  other: TeamSetup;
  players: RankingRow[];
  online: Set<string>;
  onMove: (p: RankingRow) => void;
}) {
  return (
    <div
      className="rounded-3xl border-4 bg-card p-5"
      style={{ borderColor: teamColorVar(team.color) }}
    >
      <p className="flex items-center justify-between text-lg font-extrabold uppercase">
        {team.name}
        <span
          className="rounded-full px-3 py-1 text-sm text-primary-foreground"
          style={{ backgroundColor: teamColorVar(team.color) }}
        >
          {players.length}
        </span>
      </p>
      <ul className="mt-4 space-y-2">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
          >
            <span
              className={`flex min-w-0 items-center gap-2 font-semibold ${online.has(p.id) ? "" : "opacity-60"}`}
            >
              <OnlineIcon on={online.has(p.id)} />
              <span className="truncate">{p.nickname}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(p)}
              aria-label={`Mover ${p.nickname} para ${other.name}`}
            >
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Mover para {other.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
