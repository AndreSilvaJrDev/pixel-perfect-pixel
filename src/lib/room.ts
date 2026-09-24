/**
 * ROOM ENGINE — infraestrutura de sala (PIN, lobby, presença, estados).
 * Não conhece regras de modo de jogo: isso fica no GAME MODE ENGINE (R3).
 */
import { supabase } from "@/integrations/supabase/client";

/** Máquina de estados da sessão. Única fonte dos valores de status. */
export const SESSION_STATUS = {
  LOBBY: "lobby",
  STARTING: "starting",
  QUESTION: "question",
  ANSWERING: "answering",
  REVEAL: "reveal",
  LEADERBOARD: "leaderboard",
  FINISHED: "finished",
} as const;
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export function isInGame(status: string) {
  return status !== SESSION_STATUS.LOBBY && status !== SESSION_STATUS.FINISHED;
}

/** Eventos de broadcast do canal da sala. O payload é só um aviso: o cliente sempre recarrega do servidor. */
export const ROOM_EVENTS = {
  SESSION_UPDATED: "SESSION_UPDATED",
  TEAM_UPDATED: "TEAM_UPDATED",
  PLAYER_JOINED: "PLAYER_JOINED",
} as const;

export const roomChannelName = (sessionId: string) => `room:${sessionId}`;

export const NICK_MIN = 2;
export const NICK_MAX = 20;
export const normalizeNickname = (v: string) => v.replace(/\s+/g, " ").trim();

/** URL real de entrada, calculada pela origem atual (preview, produção ou domínio próprio). */
export function joinBaseUrl() {
  return typeof window === "undefined" ? "/jogar" : `${window.location.origin}/jogar`;
}
export const joinUrl = (pin: string) => `${joinBaseUrl()}/${pin}`;

/** Payload de pergunta para o aluno (R3): nunca contém a correta nem a explicação. */
export type PlayerQuestionPayload = {
  questionId: string;
  position: number;
  prompt: string;
  options: string[];
};

// ——— identidade anônima do aluno ———
export type StoredPlayer = { playerId: string; token: string; sessionId: string };
const storageKey = (pin: string) => `pp:player:${pin}`;
export function loadStoredPlayer(pin: string): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(storageKey(pin));
    return raw ? (JSON.parse(raw) as StoredPlayer) : null;
  } catch {
    return null;
  }
}
export function saveStoredPlayer(pin: string, p: StoredPlayer) {
  localStorage.setItem(storageKey(pin), JSON.stringify(p));
}
export function clearStoredPlayer(pin: string) {
  localStorage.removeItem(storageKey(pin));
}

export const JOIN_ERRORS: Record<string, string> = {
  not_found: "Não encontramos essa sala.",
  finished: "Essa partida já foi encerrada.",
  expired: "Essa partida já foi encerrada.",
  started: "Essa partida já começou.",
  nick_short: `O apelido precisa ter pelo menos ${NICK_MIN} letras.`,
  nick_long: `O apelido pode ter até ${NICK_MAX} letras.`,
  nick_taken: "Esse apelido já está sendo usado nessa partida.",
  full: "Essa sala está cheia.",
};
export const friendlyError = (code?: string) =>
  (code && JOIN_ERRORS[code]) || "Não conseguimos entrar agora. Tente de novo.";

type Json = Record<string, unknown>;
async function rpc(name: string, args: Json): Promise<Json> {
  const { data, error } = await (
    supabase.rpc as unknown as (n: string, a: Json) => Promise<{ data: unknown; error: unknown }>
  )(name, args);
  if (error) throw error;
  return (data ?? {}) as Json;
}

export type PinLookup =
  | { status: "open"; title: string; game_mode: string }
  | { status: "not_found" | "finished" | "expired" | "started" };
export const lookupPin = (pin: string) =>
  rpc("lookup_game_pin", { _pin: pin }) as Promise<PinLookup>;

export type JoinResult =
  | { player_id: string; session_id: string; token: string; reconnected: boolean; error?: never }
  | { error: string };
export const joinGame = (pin: string, nickname: string, token?: string | null) =>
  rpc("join_game", {
    _pin: pin,
    _nickname: nickname,
    _token: token ?? null,
  }) as Promise<JoinResult>;

export type PlayerState = {
  error?: string;
  id: string;
  nickname: string;
  team: "a" | "b" | null;
  session_id: string;
  status: SessionStatus;
  title: string;
  game_mode: string;
  team_a_name: string;
  team_b_name: string;
  team_a_color: string;
  team_b_color: string;
};
export const getPlayerState = (playerId: string, token: string) =>
  rpc("get_player_state", { _player_id: playerId, _token: token }) as Promise<PlayerState>;

export const createGameSession = async (activityId: string) =>
  (await (
    supabase.rpc as unknown as (n: string, a: Json) => Promise<{ data: unknown; error: unknown }>
  )("create_game_session", { _activity_id: activityId }).then((r) => {
    if (r.error) throw r.error;
    return r.data;
  })) as string;
