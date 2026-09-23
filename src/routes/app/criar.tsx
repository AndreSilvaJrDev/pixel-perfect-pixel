import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DIFFICULTIES,
  GAME_MODES,
  GRADES,
  isTeamMode,
  SUBJECTS,
  TEAM_COLORS,
  TEAM_DISTRIBUTIONS,
  teamColorVar,
} from "@/lib/activities";
import { TugOfWar } from "@/components/game/TugOfWar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/criar")({
  head: () => ({
    meta: [
      { title: "Criar atividade — Professor Play" },
      { name: "description", content: "Escolha ano, matéria e tema para montar um novo jogo." },
      { property: "og:title", content: "Criar atividade — Professor Play" },
      {
        property: "og:description",
        content: "Escolha ano, matéria e tema para montar um novo jogo.",
      },
    ],
  }),
  component: CriarAtividade,
});

function CriarAtividade() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [grade, setGrade] = useState("5");
  const [subject, setSubject] = useState<string>(SUBJECTS[2]);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medio");
  const [gameMode, setGameMode] = useState("batalha");
  const [teamAName, setTeamAName] = useState("Time Azul");
  const [teamBName, setTeamBName] = useState("Time Vermelho");
  const [teamAColor, setTeamAColor] = useState("azul");
  const [teamBColor, setTeamBColor] = useState("vermelho");
  const [teamDistribution, setTeamDistribution] = useState("automatica");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("activities")
      .insert({
        owner_id: user.id,
        title: `${topic} — ${grade}º ano`,
        subject,
        grade: Number(grade),
        topic,
        difficulty,
        game_mode: gameMode,
        team_a_name: teamAName.trim() || "Time Azul",
        team_b_name: teamBName.trim() || "Time Vermelho",
        team_a_color: teamAColor,
        team_b_color: teamBColor,
        team_distribution: teamDistribution,
      })
      .select("id")
      .single();
    setSaving(false);

    if (error || !data) {
      toast.error("Não foi possível salvar a atividade.");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["activities"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    toast.success("Atividade criada!");
    navigate({ to: "/app/atividade/$id", params: { id: data.id } });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold">Criar atividade</h1>
      <p className="mt-1 text-muted-foreground">
        Diga o que a turma vai estudar. Depois é só revisar as perguntas.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="grade">Ano</Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger id="grade" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((item) => (
                  <SelectItem key={item} value={String(item)}>
                    {item}º ano
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Matéria</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger id="subject" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic">Tema da aula</Label>
          <Input
            id="topic"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex.: Sistema Solar"
            className="h-12"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="difficulty">Dificuldade</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger id="difficulty" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gameMode">Modo de jogo</Label>
            <Select value={gameMode} onValueChange={setGameMode}>
              <SelectTrigger id="gameMode" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAME_MODES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isTeamMode(gameMode) ? (
          <div className="space-y-5 rounded-2xl border border-border bg-muted/50 p-5">
            <div>
              <p className="font-bold">Times do Cabo de Guerra</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Dois times disputam a corda. Cada acerto soma força para a equipe.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <TeamFields
                idPrefix="teamA"
                legend="Time 1"
                name={teamAName}
                onName={setTeamAName}
                color={teamAColor}
                onColor={setTeamAColor}
              />
              <TeamFields
                idPrefix="teamB"
                legend="Time 2"
                name={teamBName}
                onName={setTeamBName}
                color={teamBColor}
                onColor={setTeamBColor}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="distribution">Distribuição dos alunos</Label>
              <Select value={teamDistribution} onValueChange={setTeamDistribution}>
                <SelectTrigger id="distribution" className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_DISTRIBUTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {TEAM_DISTRIBUTIONS.find((item) => item.value === teamDistribution)?.hint}
              </p>
            </div>

            <TugOfWar
              teamA={{ name: teamAName || "Time 1", color: teamAColor }}
              teamB={{ name: teamBName || "Time 2", color: teamBColor }}
              scoreA={0}
              scoreB={0}
            />
          </div>
        ) : null}

        <div className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
          <p className="inline-flex items-center gap-2 font-semibold text-foreground">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            Geração de perguntas com IA
          </p>
          <p className="mt-1">
            Por enquanto a atividade é salva com os dados da aula. A criação automática das
            perguntas entra na próxima entrega.
          </p>
        </div>

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Salvar atividade
        </Button>
      </form>
    </div>
  );
}

function TeamFields({
  idPrefix,
  legend,
  name,
  onName,
  color,
  onColor,
}: {
  idPrefix: string;
  legend: string;
  name: string;
  onName: (value: string) => void;
  color: string;
  onColor: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold">{legend}</legend>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Nome do time</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={24}
          className="h-12"
        />
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">Cor do time</span>
        <div className="flex flex-wrap gap-2">
          {TEAM_COLORS.map((item) => {
            const selected = item.value === color;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onColor(item.value)}
                aria-pressed={selected}
                aria-label={`${legend}: cor ${item.label}`}
                className={
                  selected
                    ? "flex size-11 items-center justify-center rounded-xl border-2 border-foreground"
                    : "flex size-11 items-center justify-center rounded-xl border border-border hover:border-foreground/40"
                }
              >
                <span
                  className="size-6 rounded-full"
                  style={{ backgroundColor: teamColorVar(item.value) }}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
