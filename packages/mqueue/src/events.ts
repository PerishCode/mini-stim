import type {
  ErrorResponse,
  MessageState,
  SessionMessage,
  ToolCall,
  ToolResult,
  Turn,
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
  SessionPayloads,
  SessionProjection,
  StreamEvent,
  TimelineItem,
  TurnGroup,
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

export function dispatchMessage(target: Window, detail: MessageEvent) {
  target.dispatchEvent(new CustomEvent("santi:mqueue:message", { detail }));
  target.dispatchEvent(new CustomEvent(detail.type, { detail }));
}

export function dispatchSession(target: Window, detail: SessionEvent) {
  target.dispatchEvent(new CustomEvent("santi:mqueue:session", { detail }));
  target.dispatchEvent(new CustomEvent(detail.type, { detail }));
}

export function validateSessionPayload<Action extends SessionAction>(
  action: Action,
  payload: SessionPayloads[Action],
) {
  switch (action) {
    case "get":
    case "messages":
    case "runtime":
      if (!(payload as { sessionId?: unknown })?.sessionId) {
        throw new Error(`session.${action} requires sessionId`);
      }
      return;
    case "select":
      if (!payload || !("sessionId" in (payload as object))) {
        throw new Error("session.select requires sessionId");
      }
      return;
    case "send": {
      const content = (payload as SessionPayloads["send"] | undefined)?.content;
      if (!Array.isArray(content) || content.length === 0) {
        throw new Error("session.send requires content");
      }
      return;
    }
    case "create":
    case "list":
      return;
  }
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
    timelineBySessionId: Object.fromEntries(
      Object.entries(value.timelineBySessionId).map(([sessionId, items]) => [
        sessionId,
        [...items],
      ]),
    ),
    turnTimelineBySessionId: Object.fromEntries(
      Object.entries(value.turnTimelineBySessionId).map(([sessionId, groups]) => [
        sessionId,
        groups.map((group) => ({ ...group, items: [...group.items] })),
      ]),
    ),
    turnsBySessionId: Object.fromEntries(
      Object.entries(value.turnsBySessionId).map(([sessionId, turns]) => [
        sessionId,
        [...turns],
      ]),
    ),
    toolCallsBySessionId: Object.fromEntries(
      Object.entries(value.toolCallsBySessionId).map(([sessionId, calls]) => [
        sessionId,
        [...calls],
      ]),
    ),
    toolResultsBySessionId: Object.fromEntries(
      Object.entries(value.toolResultsBySessionId).map(([sessionId, results]) => [
        sessionId,
        [...results],
      ]),
    ),
  };
}

export function dedupeTurns(turns: Turn[]): Turn[] {
  const byId = new Map<string, Turn>();
  for (const turn of turns) {
    const existing = byId.get(turn.id);
    if (!existing || existing.updated_at.localeCompare(turn.updated_at) <= 0) {
      byId.set(turn.id, turn);
    }
  }
  return [...byId.values()].sort(
    (left, right) =>
      left.input_through_session_seq - right.input_through_session_seq ||
      left.created_at.localeCompare(right.created_at),
  );
}

const STREAM_MESSAGE_PREFIX = "stream_";

/**
 * Group a flat, time-sorted timeline into turn envelopes.
 *
 * Attribution rules, strongest first:
 * - tool_call / paired tool_result: `turn_id` on the call.
 * - transient streaming message: its id is `stream_<turn_id>` (core emits
 *   MessageDelta with that synthetic id).
 * - user message: the turn whose `trigger_ref` is the message id.
 * - anything else: the turn with the largest `input_through_session_seq`
 *   that is <= the message's `session_seq` (each turn's appended messages
 *   sit after its input watermark and before the next turn's).
 *
 * Items that resolve to no turn (turns not loaded yet, old data) fall into
 * envelope-less groups, one per consecutive run, so render order is
 * preserved and nothing ever fails to render. Turns with no attributed
 * items (just-started turns) still produce an empty group so the UI can
 * show a running envelope immediately.
 */
export function turnGroups(
  sessionId: string,
  items: TimelineItem[],
  turns: Turn[],
): TurnGroup[] {
  const sortedTurns = dedupeTurns(turns);
  const turnsById = new Map(sortedTurns.map((turn) => [turn.id, turn]));
  const groupsByTurnId = new Map<string, TurnGroup>();
  const groups: TurnGroup[] = [];
  let fallback: TurnGroup | null = null;

  const ensureTurnGroup = (turn: Turn): TurnGroup => {
    let group = groupsByTurnId.get(turn.id);
    if (!group) {
      group = {
        id: turn.id,
        sessionId,
        createdAt: turn.created_at,
        turn,
        items: [],
      };
      groupsByTurnId.set(turn.id, group);
      groups.push(group);
    }
    return group;
  };

  for (const item of items) {
    const turn = attributeItem(item, sortedTurns, turnsById);
    if (turn) {
      fallback = null;
      const group = ensureTurnGroup(turn);
      group.items.push(item);
      if (item.createdAt.localeCompare(group.createdAt) < 0) {
        group.createdAt = item.createdAt;
      }
    } else {
      if (!fallback) {
        fallback = {
          id: `ungrouped_${item.id}`,
          sessionId,
          createdAt: item.createdAt,
          items: [],
        };
        groups.push(fallback);
      }
      fallback.items.push(item);
    }
  }

  for (const turn of sortedTurns) {
    ensureTurnGroup(turn);
  }

  return groups.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function attributeItem(
  item: TimelineItem,
  sortedTurns: Turn[],
  turnsById: Map<string, Turn>,
): Turn | undefined {
  if (item.kind === "tool_call") {
    return turnsById.get(item.toolCall.turn_id);
  }
  if (item.kind === "tool_result") {
    return item.toolCall ? turnsById.get(item.toolCall.turn_id) : undefined;
  }
  const messageId = item.message.message.id;
  if (messageId.startsWith(STREAM_MESSAGE_PREFIX)) {
    const turn = turnsById.get(messageId.slice(STREAM_MESSAGE_PREFIX.length));
    if (turn) {
      return turn;
    }
  }
  const byTrigger = sortedTurns.find((turn) => turn.trigger_ref === messageId);
  if (byTrigger) {
    return byTrigger;
  }
  const seq = item.message.relation.session_seq;
  let candidate: Turn | undefined;
  for (const turn of sortedTurns) {
    if (turn.input_through_session_seq <= seq) {
      candidate = turn;
    } else {
      break;
    }
  }
  return candidate;
}

export function dedupeToolCalls(calls: ToolCall[]): ToolCall[] {
  return [...new Map(calls.map((call) => [call.id, call])).values()].sort(
    (left, right) => left.created_at.localeCompare(right.created_at),
  );
}

export function dedupeToolResults(results: ToolResult[]): ToolResult[] {
  return [...new Map(results.map((result) => [result.id, result])).values()].sort(
    (left, right) => left.created_at.localeCompare(right.created_at),
  );
}

export function timelineItems(
  sessionId: string,
  messages: SessionMessage[],
  calls: ToolCall[],
  results: ToolResult[],
): TimelineItem[] {
  const callsById = new Map(calls.map((call) => [call.id, call]));
  const resultsByCall = new Map(results.map((result) => [result.tool_call_id, result]));
  const callItems: TimelineItem[] = calls.map((toolCall) => ({
    kind: "tool_call",
    id: toolCall.id,
    sessionId,
    createdAt: toolCall.created_at,
    toolCall,
    toolResult: resultsByCall.get(toolCall.id),
  }));
  const orphanResults: TimelineItem[] = results
    .filter((result) => !callsById.has(result.tool_call_id))
    .map((toolResult) => ({
      kind: "tool_result",
      id: toolResult.id,
      sessionId,
      createdAt: toolResult.created_at,
      toolResult,
    }));
  const messageItems: TimelineItem[] = messages.map((message) => ({
    kind: "message",
    id: message.message.id,
    sessionId,
    createdAt: message.relation.created_at,
    message,
  }));
  return [...messageItems, ...callItems, ...orphanResults].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
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
