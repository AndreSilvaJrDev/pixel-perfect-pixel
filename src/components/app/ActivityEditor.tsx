import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { emptyDraftQuestion, type DraftQuestion } from "@/lib/ai-questions";
import type { Activity, Question } from "@/lib/activities";
import { QuestionEditor } from "@/components/criar/QuestionEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DIFFICULTIES } from "@/lib/activities";

type Props = {
  activity: Omit<Activity, "questions">;
  questions: Question[];
  onCancel: () => void;
  onSaved: () => void;
};

function toDraftQuestion(question: Question): DraftQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    options: question.options,
    correctIndex: question.correct_index,
    explanation: question.explanation ?? "",
    difficulty: question.difficulty,
  };
}

export function ActivityEditor({ activity, questions, onCancel, onSaved }: Props) {
  const originalIds = useMemo(() => new Set(questions.map((question) => question.id)), [questions]);
  const [title, setTitle] = useState(activity.title);
  const [topic, setTopic] = useState(activity.topic ?? "");
  const [difficulty, setDifficulty] = useState(activity.difficulty);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>(
    questions.map(toDraftQuestion),
  );
  const [saving, setSaving] = useState(false);

  function updateQuestion(next: DraftQuestion) {
    setDraftQuestions((current) => current.map((question) => (question.id === next.id ? next : question)));
  }

  async function save() {
    const validQuestions = draftQuestions.filter(
      (question) =>
        question.prompt.trim() && question.options.length > 0 && question.options.every((option) => option.trim()),
    );

    if (!title.trim() || validQuestions.length === 0) {
      toast.error("Informe um título e mantenha pelo menos uma pergunta completa.");
      return;
    }

    setSaving(true);
    const { error: activityError } = await supabase
      .from("activities")
      .update({ title: title.trim(), topic: topic.trim() || null, difficulty })
      .eq("id", activity.id);

    if (activityError) {
      setSaving(false);
      toast.error("Não foi possível salvar os dados da atividade.");
      return;
    }

    const removedIds = [...originalIds].filter(
      (id) => !draftQuestions.some((question) => question.id === id),
    );
    if (removedIds.length) {
      const { error } = await supabase.from("questions").delete().in("id", removedIds);
      if (error) {
        setSaving(false);
        toast.error("Não foi possível excluir uma das perguntas.");
        return;
      }
    }

    for (const [index, question] of validQuestions.entries()) {
      const payload = {
        position: index + 1,
        prompt: question.prompt.trim(),
        options: question.options.map((option) => option.trim()),
        correct_index: question.correctIndex,
        explanation: question.explanation.trim() || null,
        difficulty: question.difficulty || difficulty,
      };
      const result = originalIds.has(question.id)
        ? await supabase.from("questions").update(payload).eq("id", question.id)
        : await supabase.from("questions").insert({ ...payload, activity_id: activity.id });
      if (result.error) {
        setSaving(false);
        toast.error("Não foi possível salvar uma das perguntas.");
        return;
      }
    }

    setSaving(false);
    toast.success("Atividade atualizada.");
    onSaved();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Editor da atividade</p>
          <h1 className="mt-1 text-2xl font-extrabold">Ajuste o jogo antes da partida</h1>
        </div>
        <Button type="button" variant="ghost" onClick={onCancel}>
          <X className="size-4" aria-hidden="true" />
          Cancelar
        </Button>
      </div>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="activity-title">Título</Label>
            <Input id="activity-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="activity-topic">Tema</Label>
            <Textarea id="activity-topic" value={topic} onChange={(event) => setTopic(event.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-difficulty">Dificuldade</Label>
            <select
              id="activity-difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {DIFFICULTIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <ol className="space-y-4">
        {draftQuestions.map((question, index) => (
          <QuestionEditor
            key={question.id}
            question={question}
            index={index}
            onChange={updateQuestion}
            onDelete={() => setDraftQuestions((current) => current.filter((item) => item.id !== question.id))}
            startEditing={false}
          />
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setDraftQuestions((current) => [...current, emptyDraftQuestion(activity.game_mode, difficulty)])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Adicionar pergunta
        </Button>
        <Button type="button" variant="hero" onClick={() => void save()} disabled={saving}>
          <Save className="size-4" aria-hidden="true" />
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
