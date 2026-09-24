import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ArrowLeftRight, Copy, Link2, Play, QrCode, Rocket, Square, Users, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TugOfWar } from "@/components/game/TugOfWar";
import { gameModeLabel, isTeamMode, teamColorVar, teamsFromActivity, type TeamSetup } from "@/lib/activities";
import { ROOM_EVENTS, SESSION_STATUS, isInGame, joinBaseUrl, joinUrl, roomChannelName } from "@/lib/room";

export const Route = createFileRoute("/app/sala/$id")({
  head: () => ({
    meta: [
      { title: "Sala ao vivo — Professor Play" },
      { name: "description", content: "Mostre o PIN e o QR Code. Veja seus alunos entrando." },
      { property: "og:title", content: "Sala ao vivo — Professor Play" },
      { property: "og:description", content: "Mostre o PIN e o QR Code. Veja seus alunos entrando." },
    ],
  }),
  component: SalaProfessor,
});

type Session = { id: string; pin: string; status: string; activity_id: string };
type Player = { id: string; nickname: string; team: string | null; joined_at: string };
type ActivityInfo = {
  title: string;
  game_mode: string;
  team_a_name: string;
  team_b_name: string;
  team_a_color: string;
  team_b_color: string;
};

function SalaProfessor() {
  const { id } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase
      .from("players")
      .select("id, nickname, team, joined_at")
      .eq("session_id", id)
      .order("joined_at");
    setPlayers(data ?? []);
  }, [id]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase
        .from("game_sessions")
        .select("id, pin, status, activity_id")
        .eq("id", id)
        .maybeSingle();
      if (s) {
        setSession(s);
        const { data: a } = await supabase
          .from("activities")
          .select("title, game_mode, team_a_name, team_b_name, team_a_color, team_b_color")
          .eq("id", s.activity_id)
          .single();
        setActivity(a);
        await loadPlayers();
      }
      setLoading(false);
    })();
  }, [id, loadPlayers]);

  useEffect(() => {
    const channel = supabase.channel(roomChannelName(id), { config: { presence: { key: "host" } } });
    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState()).filter((k) => k !== "host")));
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `session_id=eq.${id}` },
        () => void loadPlayers(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ host: true });
      });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [id, loadPlayers]);

  const notify = (event: string) =>
    void channelRef.current?.send({ type: "broadcast", event, payload: { at: Date.now() } });

  async function setStatus(status: string) {
    setBusy(true);
    const { error } = await supabase.from("game_sessions").update({ status }).eq("id", id);
    setBusy(false);
    if (error) return toast.error("Não foi possível atualizar a sala.");
    setSession((s) => (s ? { ...s, status } : s));
    notify(ROOM_EVENTS.SESSION_UPDATED);
  }

  async function movePlayer(p: Player) {
    const team = p.team === "a" ? "b" : "a";
    setPlayers((list) => list.map((x) => (x.id === p.id ? { ...x, team } : x)));
    const { error } = await supabase.from("players").update({ team }).eq("id", p.id);
    if (error) {
      toast.error("Não foi possível mover o jogador.");
      return loadPlayers();
    }
    notify(ROOM_EVENTS.TEAM_UPDATED);
  }

  const teams = useMemo(() => (activity ? teamsFromActivity(activity) : null), [activity]);

  if (loading) return <Skeleton className="h-96 rounded-3xl" />;
  if (!session || !activity || !teams) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="font-bold">Sala não encontrada</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/app/biblioteca">Voltar para a biblioteca</Link>
        </Button>
      </div>
    );
  }

  const teamMode = isTeamMode(activity.game_mode);
  const finished = session.status === SESSION_STATUS.FINISHED;
  const started = isInGame(session.status);
  const link = joinUrl(session.pin);
  const copy = (text: string, msg: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(msg));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{gameModeLabel(activity.game_mode)}</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{activity.title}</h1>
        </div>
        {!finished ? (
          confirmEnd ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar encerramento">
              <span className="text-sm font-semibold">Encerrar para todos?</span>
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => void setStatus(SESSION_STATUS.FINISHED)}>
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

      {finished ? (
        <Banner icon={<Square className="size-8" />} title="Partida encerrada" text="O PIN não aceita mais alunos." />
      ) : started ? (
        <Banner icon={<Rocket className="size-8 text-primary" />} title="Partida iniciada" text="Os alunos já estão vendo a tela de início. As perguntas ao vivo chegam na próxima entrega." />
      ) : (
        <section className="grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Entre em</p>
            <p className="break-all font-display text-lg font-bold sm:text-2xl">{joinBaseUrl().replace(/^https?:\/\//, "")}</p>
            <p className="mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">PIN</p>
            <p className="font-display text-6xl font-extrabold tracking-[0.12em] text-primary sm:text-7xl" aria-label={`PIN ${session.pin.split("").join(" ")}`}>
              {session.pin}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void copy(session.pin, "PIN copiado.")}>
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
          <div className="mx-auto rounded-2xl border border-border bg-background p-4">
            <QRCodeSVG value={link} size={200} level="M" title={`QR Code para ${link}`} />
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-2xl font-extrabold" aria-live="polite">
            <Users className="size-6 text-primary" aria-hidden="true" />
            {players.length} {players.length === 1 ? "jogador" : "jogadores"}
            <span className="text-sm font-semibold text-muted-foreground">· {online.size} conectados</span>
          </p>
          {!started && !finished ? (
            <Button variant="hero" size="xl" disabled={players.length === 0 || busy} onClick={() => void setStatus(SESSION_STATUS.QUESTION)}>
              <Play className="size-5" aria-hidden="true" /> Começar jogo
            </Button>
          ) : null}
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
                  canMove={!finished}
                  onMove={(p) => void movePlayer(p)}
                />
              ))}
            </div>
          </>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {players.map((p) => (
              <PlayerChip key={p.id} player={p} online={online.has(p.id)} />
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
          <p className="font-display text-5xl font-extrabold tracking-[0.12em] text-primary">{session.pin}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Banner({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <section role="status" className="flex items-center gap-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <span aria-hidden="true">{icon}</span>
      <div>
        <p className="text-2xl font-extrabold">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </section>
  );
}

function PlayerChip({ player, online }: { player: Player; online: boolean }) {
  return (
    <li className={`flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-semibold ${online ? "" : "opacity-60"}`}>
      {online ? <Wifi className="size-4 text-success" aria-hidden="true" /> : <WifiOff className="size-4 text-muted-foreground" aria-hidden="true" />}
      {player.nickname}
      <span className="sr-only">{online ? "(conectado)" : "(desconectado)"}</span>
    </li>
  );
}

function TeamColumn({
  team,
  other,
  players,
  online,
  canMove,
  onMove,
}: {
  team: TeamSetup;
  other: TeamSetup;
  players: Player[];
  online: Set<string>;
  canMove: boolean;
  onMove: (p: Player) => void;
}) {
  return (
    <div className="rounded-3xl border-4 bg-card p-5" style={{ borderColor: teamColorVar(team.color) }}>
      <p className="flex items-center justify-between text-lg font-extrabold uppercase">
        {team.name}
        <span className="rounded-full px-3 py-1 text-sm text-primary-foreground" style={{ backgroundColor: teamColorVar(team.color) }}>
          {players.length}
        </span>
      </p>
      <ul className="mt-4 space-y-2">
        {players.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
            <span className={`flex min-w-0 items-center gap-2 font-semibold ${online.has(p.id) ? "" : "opacity-60"}`}>
              {online.has(p.id) ? <Wifi className="size-4 shrink-0 text-success" aria-hidden="true" /> : <WifiOff className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              <span className="truncate">{p.nickname}</span>
              <span className="sr-only">{online.has(p.id) ? "(conectado)" : "(desconectado)"}</span>
            </span>
            {canMove ? (
              <Button variant="ghost" size="sm" onClick={() => onMove(p)} aria-label={`Mover ${p.nickname} para ${other.name}`}>
                <ArrowLeftRight className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Mover para {other.name}</span>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
