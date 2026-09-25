import { useEffect, useState } from "react";
import type { RoomView } from "@/lib/room";

/**
 * Relógio visual derivado da referência do servidor (question_started_at / question_ends_at).
 * Não consulta o banco a cada segundo: só recalcula localmente, corrigindo o relógio do aparelho.
 * Chama onDeadline uma vez quando a contagem atual chega a zero (para buscar o novo estado).
 */
export function useRoomClock(view: RoomView | null, offsetMs: number, onDeadline: () => void) {
  const target =
    view?.status === "starting"
      ? view.question_started_at
      : view?.status === "question"
        ? view.question_ends_at
        : null;
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!target) return;
    const end = Date.parse(target);
    let fired = false;
    const tick = () => {
      const ms = end - (Date.now() + offsetMs);
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && !fired) {
        fired = true;
        // pequena folga para o servidor fechar a pergunta
        window.setTimeout(onDeadline, 400);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, offsetMs]);

  return target ? left : 0;
}
