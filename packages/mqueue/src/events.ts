import type {
  ErrorResponse,
  MessageState,
  SessionMessage,
} from "@mini-stim/contracts";

import type {
  MessageDeltaPayload,
  MessageEvent,
  MessagePhase,
  MessageProjection,
  MqueueError,
  SessionAction,
  SessionEvent,
  SessionPhase,
  SessionProjection,
  StreamEvent,
} from "./types";

const DEFAULT_ACTOR_ID = "account_local";

export function sessionEvent<Action extends SessionAction | "projection", Payload>(
  action: Action,
  phase: SessionPhase,
  payload: Payload,
  source: "mqueue" | "http",
  options: { error?: MqueueError; idempotencyKey?: string } = {},
): SessionEvent<Action, Payload> {
  return {
    eventId: newId("evt"),
    idempotencyKey: options.idempotencyKey ?? newId("idem"),
    actorId: DEFAULT_ACTOR_ID,
    domain: "session",
    action,
    phase,
    type: `session:${action}:${phase}`,
    payload,
    createdAt: new Date().toISOString(),
    source,
    error: options.error,
  };
}

export function messageEvent<Payload>(
  phase: MessagePhase,
  sessionId: string,
  payload: Payload,
  source: "mqueue" | "sse",
  options: { error?: MqueueError } = {},
): MessageEvent<Payload> {
  return {
    eventId: newId("evt"),
    idempotencyKey: newId("idem"),
    actorId: DEFAULT_ACTOR_ID,
    domain: "message",
    phase,
    type: `message:${phase}`,
    sessionId,
    payload,
    createdAt: new Date().toISOString(),
    source,
    error: options.error,
  };
}

export function parseStreamEvent(raw: Event): StreamEvent | null {
  try {
    return JSON.parse((raw as Event & { data: string }).data) as StreamEvent;
  } catch {
    return null;
  }
}

export function transientMessage(
  sessionId: string,
  payload: MessageDeltaPayload,
): SessionMessage {
  const createdAt = new Date().toISOString();
  return {
    relation: {
      session_id: sessionId,
      message_id: payload.message_id,
      session_seq: Number.MAX_SAFE_INTEGER,
      created_at: createdAt,
    },
    message: {
      id: payload.message_id,
      actor_type: payload.role,
      actor_id: payload.role === "soul" ? "soul_default" : "account_local",
      content: { parts: [{ type: "text", text: payload.text }] },
      state: "pending" as MessageState,
      version: 1,
      deleted_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    },
    content_text: payload.text,
  };
}

export function appendText(message: SessionMessage, text: string): SessionMessage {
  const contentText = `${message.content_text}${text}`;
  return {
    ...message,
    content_text: contentText,
    message: {
      ...message.message,
      content: { parts: [{ type: "text", text: contentText }] },
      updated_at: new Date().toISOString(),
    },
  };
}

export function dedupeMessages(messages: SessionMessage[]): SessionMessage[] {
  const byId = new Map<string, SessionMessage>();
  for (const message of messages) {
    byId.set(message.message.id, message);
  }
  return [...byId.values()].sort(
    (left, right) => left.relation.session_seq - right.relation.session_seq,
  );
}

export function cloneProjection(value: SessionProjection): SessionProjection {
  return {
    sessions: [...value.sessions],
    selectedSessionId: value.selectedSessionId,
    messages: [...value.messages],
    messagesBySessionId: Object.fromEntries(
      Object.entries(value.messagesBySessionId).map(([sessionId, messages]) => [
        sessionId,
        [...messages],
      ]),
    ),
    runtimeBySessionId: { ...value.runtimeBySessionId },
    pending: value.pending,
    error: value.error,
  };
}

export function cloneMessageProjection(value: MessageProjection): MessageProjection {
  return {
    connectionBySessionId: { ...value.connectionBySessionId },
    messagesBySessionId: Object.fromEntries(
      Object.entries(value.messagesBySessionId).map(([sessionId, messages]) => [
        sessionId,
        [...messages],
      ]),
    ),
  };
}

export function expectStatus(
  response: { status: number; data: unknown },
  status: number,
): unknown {
  if (response.status === status) {
    return response.data;
  }
  throw normalizeError(response.data);
}

export function normalizeError(cause: unknown): MqueueError {
  if (isErrorResponse(cause)) {
    return { code: cause.code, message: cause.message, cause };
  }
  if (cause instanceof Error) {
    return { code: "error", message: cause.message, cause };
  }
  return { code: "unknown", message: String(cause), cause };
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as { code: unknown }).code === "string" &&
    typeof (value as { message: unknown }).message === "string"
  );
}

function newId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
