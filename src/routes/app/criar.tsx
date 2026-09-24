import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DIFFICULTIES,
  difficultyLabel,
  GAME_MODES,
  gameModeLabel,
  GRADES,
  isTeamMode,
  SUBJECTS,
  TEAM_COLORS,
  TEAM_DISTRIBUTIONS,
  teamColorVar,
} from "@/lib/activities";
import {
  DEFAULT_QUESTION_COUNT,
  emptyDraftQuestion,
  QUESTION_COUNTS,
  suggestedTitle,
  TOPIC_MAX_LENGTH,
  type DraftQuestion,
} from "@/lib/ai-questions";
import { generateActivityWithAI, regenerateQuestionWithAI } from "@/lib/ai-questions.functions";
import { TugOfWar } from "@/components/game/TugOfWar";
import { GenerationLoader } from "@/components/criar/GenerationLoader";
import { QuestionEditor } from "@/components/criar/QuestionEditor";
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
      { title: "Criar atividade com IA — Professor Play" },
      {
        name: "description",
        content: "Escolha o tema da aula e a IA monta as perguntas do jogo em segundos.",
      },
      { property: "og:title", content: "Criar atividade com IA — Professor Play" },
      {
        property: "og:description",
        content: "Escolha o tema da aula e a IA monta as perguntas do jogo em segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CriarAtividade,
});

type Status = "idle" | "loading" | "success" | "error";

const DIFFICULTY_VALUES = ["facil", "medio", "dificil"] as const;
const MODE_VALUES = ["batalha", "vf", "corrida", "cabo"] as const;

const MODE_HINTS: Record<string, string> = {
  batalha: "Quatro alternativas. Vale acertar e ser rápido.",
  vf: "Só Verdadeiro ou Falso. Ótimo para revisão rápida.",
  corrida: "Cada acerto avança o aluno na pista.",
  cabo: "Dois times puxam a corda a cada acerto.",
};

function CriarAtividade() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const generate = useServerFn(generateActivityWithAI);
  const regenerate = useServerFn(regenerateQuestionWithAI);

  const [step, setStep] = useState(1);
  const [grade, setGrade] = useState("5");
  const [subject, setSubject] = useState<string>(SUBJECTS[2]);
  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_VALUES)[number]>("medio");
  const [gameMode, setGameMode] = useState<(typeof MODE_VALUES)[number]>("batalha");
  const [teamAName, setTeamAName] = useState("Time Azul");
  const [teamBName, setTeamBName] = useState("Time Vermelho");
  const [teamAColor, setTeamAColor] = useState("azul");
  const [teamBColor, setTeamBColor] = useState("vermelho");
  const [teamDistribution, setTeamDistribution] = useState("automatica");

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [confirmingRegenerateAll, setConfirmingRegenerateAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const payload = {
    grade: Number(grade),
    subject,
    topic: topic.trim(),
    difficulty,
    questionCount,
    gameMode,
  };

  async function runGeneration() {
    setStatus("loading");
    setErrorMessage("");
    setConfirmingRegenerateAll(false);
    try {
      const result = await generate({ data: payload });
      setTitle(result.title || suggestedTitle(payload.topic, subject, payload.grade));
      setQuestions(result.questions);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error && error.message.length < 200
          ? error.message
          : "Não conseguimos gerar a atividade agora.",
      );
    }
  }

  async function handleRegenerateOne(question: DraftQuestion) {
    setRegeneratingId(question.id);
    try {
      const fresh = await regenerate({
        data: {
          grade: payload.grade,
          subject,
          topic: payload.topic,
          difficulty,
          gameMode,
          avoidPrompts: questions.map((item) => item.prompt),
        },
      });
      setQuestions((current) =>
        current.map((item) => (item.id === question.id ? { ...fresh, id: item.id } : item)),
      );
      toast.success("Pergunta trocada.");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.length < 200
          ? error.message
          : "Não conseguimos gerar outra pergunta agora.",
      );
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleSave() {
    if (!user) return;
    const validQuestions = questions.filter(
      (question) =>
        question.prompt.trim().length > 0 &&
        question.options.every((option) => option.trim().length > 0),
    );
    if (validQuestions.length === 0) {
      toast.error("A atividade precisa de pelo menos uma pergunta completa.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("activities")
      .insert({
        owner_id: user.id,
        title: title.trim() || suggestedTitle(payload.topic, subject, payload.grade),
        subject,
        grade: payload.grade,
        topic: payload.topic,
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

    if (error || !data) {
      setSaving(false);
      toast.error("Não foi possível salvar a atividade.");
      return;
    }

    const { error: questionsError } = await supabase.from("questions").insert(
      validQuestions.map((question, index) => ({
        activity_id: data.id,
        position: index + 1,
        prompt: question.prompt.trim(),
        options: question.options.map((option) => option.trim()),
        correct_index: question.correctIndex,
        explanation: question.explanation.trim() || null,
        difficulty: question.difficulty,
      })),
    );
    setSaving(false);

    if (questionsError) {
      toast.error("A atividade foi criada, mas as perguntas não foram salvas.");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["activities"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    toast.success("Atividade salva!");
    navigate({ to: "/app/atividade/$id", params: { id: data.id } });
  }

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-extrabold">Criando sua atividade</h1>
        <div className="mt-6">
          <GenerationLoader />
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="mx-auto max-w-2xl pb-24">
        <h1 className="text-3xl font-extrabold">Sua atividade está pronta</h1>
        <p className="mt-1 font-semibold text-accent">Revise antes de usar com a turma.</p>

        <div className="mt-6 space-y-2 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <Label htmlFor="title">Título da atividade</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-12"
            maxLength={120}
          />
          <p className="text-sm text-muted-foreground">
            {subject} · {payload.grade}º ano · {difficultyLabel(difficulty)} ·{" "}
            {gameModeLabel(gameMode)}
          </p>
        </div>

        <ul className="mt-5 space-y-4">
          {questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={index}
              regenerating={regeneratingId === question.id}
              onChange={(updated) =>
                setQuestions((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item)),
                )
              }
              onDelete={() =>
                setQuestions((current) => current.filter((item) => item.id !== question.id))
              }
              onRegenerate={() => void handleRegenerateOne(question)}
              startEditing={question.prompt === ""}
            />

          ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setQuestions((current) => [...current, emptyDraftQuestion(gameMode, difficulty)])
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Adicionar pergunta
          </Button>

          {confirmingRegenerateAll ? (
            <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted p-4">
              <p className="w-full text-sm font-semibold">
                Isso substituirá as perguntas atuais. Deseja continuar?
              </p>
              <Button type="button" variant="accent" onClick={() => void runGeneration()}>
                Sim, gerar novamente
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmingRegenerateAll(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingRegenerateAll(true)}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Gerar novamente
            </Button>
          )}
        </div>

        <div className="sticky bottom-20 mt-6 sm:bottom-4">
          <Button
            type="button"
            variant="hero"
            size="lg"
            className="w-full"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Salvar atividade
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold">Criar atividade</h1>
      <p className="mt-1 text-muted-foreground">Passo {step} de 3</p>

      <div className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        {step === 1 ? (
          <>
            <h2 className="text-xl font-bold">Sobre o que será o jogo?</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="grade">Ano / série</Label>
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
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Ex.: Sistema Solar"
                maxLength={TOPIC_MAX_LENGTH}
                className="h-12"
              />
              <p className="text-sm text-muted-foreground">
                Exemplos: Frações, Revolução Industrial, Verbos, Biomas do Brasil.
              </p>
            </div>

            <Button
              type="button"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={topic.trim().length < 2}
              onClick={() => setStep(2)}
            >
              Continuar
            </Button>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="text-xl font-bold">Como será a atividade?</h2>

            <div className="space-y-2">
              <span className="text-sm font-medium">Quantidade de perguntas</span>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((count) => (
                  <Button
                    key={count}
                    type="button"
                    variant={questionCount === count ? "accent" : "outline"}
                    onClick={() => setQuestionCount(count)}
                    aria-pressed={questionCount === count}
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Dificuldade</span>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant={difficulty === item.value ? "accent" : "outline"}
                    onClick={() => setDifficulty(item.value)}
                    aria-pressed={difficulty === item.value}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Modo de jogo</span>
              <div className="grid gap-3 sm:grid-cols-2">
                {GAME_MODES.map((mode) => {
                  const selected = gameMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setGameMode(mode.value)}
                      aria-pressed={selected}
                      className={
                        selected
                          ? "rounded-2xl border-2 border-accent bg-accent/5 p-4 text-left"
                          : "rounded-2xl border border-border p-4 text-left hover:border-foreground/30"
                      }
                    >
                      <p className="font-bold">{mode.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{MODE_HINTS[mode.value]}</p>
                    </button>
                  );
                })}
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

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Voltar
              </Button>
              <Button
                type="button"
                variant="hero"
                size="lg"
                className="flex-1"
                onClick={() => setStep(3)}
              >
                Continuar
              </Button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="text-xl font-bold">Sua atividade</h2>
            <ul className="space-y-1 text-lg font-semibold">
              <li>{payload.grade}º ano</li>
              <li>{subject}</li>
              <li>{payload.topic}</li>
              <li>{questionCount} perguntas</li>
              <li>Dificuldade {difficultyLabel(difficulty).toLowerCase()}</li>
              <li>{gameModeLabel(gameMode)}</li>
            </ul>

            {status === "error" ? (
              <div className="flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
                <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{errorMessage}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Seus dados continuam preenchidos. Você pode tentar de novo.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(2)}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Voltar
              </Button>
              <Button
                type="button"
                variant="hero"
                size="lg"
                className="flex-1"
                onClick={() => void runGeneration()}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                {status === "error" ? "Tentar novamente" : "Gerar atividade com IA"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
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
