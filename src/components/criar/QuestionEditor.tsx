import { useState } from "react";
import { Check, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OPTION_LETTERS, type DraftQuestion } from "@/lib/ai-questions";

type Props = {
  question: DraftQuestion;
  index: number;
  onChange: (question: DraftQuestion) => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  startEditing?: boolean;
};

export function QuestionEditor({
  question,
  index,
  onChange,
  onDelete,
  onRegenerate,
  regenerating = false,
  startEditing = false,
}: Props) {
  const [editing, setEditing] = useState(startEditing);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function updateOption(position: number, value: string) {
    const options = question.options.map((option, i) => (i === position ? value : option));
    onChange({ ...question, options });
  }

  return (
    <li className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Pergunta {index + 1}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Pencil className="size-4" aria-hidden="true" />
            )}
            {editing ? "Concluir" : "Editar"}
          </Button>
          {onRegenerate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Regenerar
            </Button>
          ) : null}
          {confirmingDelete ? (
            <>
              <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
                Confirmar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Excluir pergunta ${index + 1}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Excluir
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`prompt-${question.id}`}>Enunciado</Label>
            <Textarea
              id={`prompt-${question.id}`}
              value={question.prompt}
              onChange={(event) => onChange({ ...question, prompt: event.target.value })}
              rows={3}
              className="min-h-24"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Alternativas (marque a correta)</legend>
            {question.options.map((option, position) => (
              <div key={position} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${question.id}`}
                  checked={question.correctIndex === position}
                  onChange={() => onChange({ ...question, correctIndex: position })}
                  className="size-5 shrink-0 accent-[var(--color-success,currentColor)]"
                  aria-label={`Alternativa ${OPTION_LETTERS[position]} é a correta`}
                />
                <span className="w-5 shrink-0 text-sm font-bold">{OPTION_LETTERS[position]}</span>
                <Input
                  value={option}
                  onChange={(event) => updateOption(position, event.target.value)}
                  className="h-11"
                  aria-label={`Alternativa ${OPTION_LETTERS[position]}`}
                />
              </div>
            ))}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor={`explanation-${question.id}`}>Explicação</Label>
            <Textarea
              id={`explanation-${question.id}`}
              value={question.explanation}
              onChange={(event) => onChange({ ...question, explanation: event.target.value })}
              rows={2}
            />
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-lg font-bold text-balance">{question.prompt || "Sem enunciado"}</p>
          <ol className="mt-3 space-y-2">
            {question.options.map((option, position) => {
              const correct = position === question.correctIndex;
              return (
                <li
                  key={position}
                  className={
                    correct
                      ? "flex items-start gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2"
                      : "flex items-start gap-2 rounded-xl border border-border px-3 py-2"
                  }
                >
                  <span className="font-bold">{OPTION_LETTERS[position]}.</span>
                  <span className="flex-1 break-words">{option}</span>
                  {correct ? (
                    <Check className="size-5 shrink-0 text-success" aria-label="Resposta correta" />
                  ) : null}
                </li>
              );
            })}
          </ol>
          {question.explanation ? (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Explicação: </span>
              {question.explanation}
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}
