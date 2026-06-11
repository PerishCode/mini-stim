import type {
  MessagePart,
  Session,
  SessionMessage,
  SessionRuntimeSnapshot,
  ToolCall,
  ToolResult,
  Turn,
  TurnStatus,
  UpdateSessionRequest,
} from "@mini-stim/contracts";

export type {
  MessagePart,
  Session,
  SessionMessage,
  ToolCall,
  ToolResult,
  Turn,
  TurnStatus,
} from "@mini-stim/contracts";

export type SessionAction =
  | "create"
  | "get"
  | "list"
  | "messages"
  | "runtime"
  | "select"
  | "update"
  | "send";

export type SessionPhase =
  | "intent"
  | "accepted"
  | "committed"
  | "failed"
  | "projection";

export interface SessionPayloads {
  create: undefined;
  get: { sessionId: string };
  list: undefined;
  messages: { sessionId: string };
  runtime: { sessionId: string };
  select: { sessionId: string | null };
  send: { sessionId?: string | null; content: MessagePart[] };
  update: { sessionId: string; title: UpdateSessionRequest["title"] };
}

export interface MqueueError {
  code: string;
  message: string;
  cause?: unknown;
}

export interface SessionProjection {
  sessions: Session[];
  selectedSessionId: string | null;
  messages: SessionMessage[];
  messagesBySessionId: Record<string, SessionMessage[]>;
  runtimeBySessionId: Record<string, SessionRuntimeSnapshot>;
  pending: number;
  error: MqueueError | null;
}

export type MessagePhase =
  | "connecting"
  | "open"
  | "closed"
  | "error"
  | "created"
  | "delta"
  | "completed"
  | "tool_call"
  | "tool_result"
  | "turn_started"
  | "failed"
  | "projection";

export type MessageConnectionState = "closed" | "connecting" | "open" | "error";

export interface MessageProjection {
  messagesBySessionId: Record<string, SessionMessage[]>;
  timelineBySessionId: Record<string, TimelineItem[]>;
  turnTimelineBySessionId: Record<string, TurnGroup[]>;
  turnsBySessionId: Record<string, Turn[]>;
  toolCallsBySessionId: Record<string, ToolCall[]>;
  toolResultsBySessionId: Record<string, ToolResult[]>;
  connectionBySessionId: Record<string, MessageConnectionState>;
}

export interface TurnGroup {
  /** Turn id, or `ungrouped_<first item id>` for the fallback group. */
  id: string;
  sessionId: string;
  /** Sort key: the earliest createdAt among the turn and its items. */
  createdAt: string;
  /** Absent for the fallback group holding items with no resolvable turn. */
  turn?: Turn;
  items: TimelineItem[];
}

export type TimelineItem =
  | {
      kind: "message";
      id: string;
      sessionId: string;
      createdAt: string;
      message: SessionMessage;
    }
  | {
      kind: "tool_call";
      id: string;
      sessionId: string;
      createdAt: string;
      toolCall: ToolCall;
      toolResult?: ToolResult;
    }
  | {
      kind: "tool_result";
      id: string;
      sessionId: string;
      createdAt: string;
      toolResult: ToolResult;
      toolCall?: ToolCall;
    };

export interface MessageEvent<Payload = unknown> {
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly domain: "message";
  readonly phase: MessagePhase;
  readonly type: `message:${MessagePhase}`;
  readonly sessionId: string;
  readonly payload: Payload;
  readonly createdAt: string;
  readonly source: "mqueue" | "sse";
  readonly error?: MqueueError;
}

export interface SessionEvent<
  Action extends SessionAction | "projection" = SessionAction | "projection",
  Payload = unknown,
> {
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly domain: "session";
  readonly action: Action;
  readonly phase: SessionPhase;
  readonly type: `session:${Action}:${SessionPhase}`;
  readonly payload: Payload;
  readonly createdAt: string;
  readonly source: "mqueue" | "http";
  readonly error?: MqueueError;
}

export interface PubAck {
  accepted: true;
  eventId: string;
}

export interface SessionSubOptions {
  action?: SessionAction | "projection";
  phase?: SessionPhase;
}

export interface SessionMqueue {
  pub<Action extends SessionAction>(
    action: Action,
    ...args: SessionPayloads[Action] extends undefined
      ? [payload?: SessionPayloads[Action]]
      : [payload: SessionPayloads[Action]]
  ): PubAck;
  sub(
    handler: (event: SessionEvent) => void,
    options?: SessionSubOptions,
  ): () => void;
  snapshot(): SessionProjection;
}

export interface MessageMqueue {
  sub(
    handler: (event: MessageEvent) => void,
    options?: { phase?: MessagePhase; sessionId?: string },
  ): () => void;
  snapshot(): MessageProjection;
}

export interface SantiMqueue {
  message: MessageMqueue;
  session: SessionMqueue;
}

export interface SantiWindow {
  santi?: {
    mqueue?: SantiMqueue;
  };
}

export interface StreamEvent {
  event_id: string;
  session_id: string;
  created_at: string;
  payload: StreamPayload;
}

export type StreamPayload =
  | { type: "stream_open" }
  | { type: "message_created"; message: SessionMessage }
  | MessageDeltaPayload
  | { type: "message_completed"; turn_id: string; message: SessionMessage }
  | { type: "tool_call_created"; tool_call: ToolCall }
  | { type: "tool_result_created"; tool_result: ToolResult }
  | { type: "turn_started"; turn: Turn }
  | { type: "turn_failed"; turn_id: string; error: string };

export interface MessageDeltaPayload {
  type: "message_delta";
  message_id: string;
  turn_id: string;
  role: "account" | "soul" | "system";
  text: string;
}
