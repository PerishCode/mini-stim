import { parseStreamEvent } from "./events";
import type {
  MaterialUpdated,
  MessageDeltaPayload,
  SessionMessage,
  StreamPayload,
  ThinkingSpan,
  ToolCall,
  ToolResult,
  Turn,
  TurnActivity,
} from "./types";

export interface SessionStreamHandlers {
  open(): void;
  error(): void;
  messageCreated(payload: { type: "message_created"; message: SessionMessage }): void;
  messageDelta(payload: MessageDeltaPayload): void;
  messageCompleted(payload: {
    type: "message_completed";
    turn_id: string;
    message: SessionMessage;
  }): void;
  thinkingCreated(payload: { type: "thinking_created"; thinking: ThinkingSpan }): void;
  thinkingUpdated(payload: { type: "thinking_updated"; thinking: ThinkingSpan }): void;
  thinkingCompleted(payload: { type: "thinking_completed"; thinking: ThinkingSpan }): void;
  materialUpdated(payload: { type: "material_updated"; material: MaterialUpdated }): void;
  toolCall(payload: { type: "tool_call_created"; tool_call: ToolCall }): void;
  toolResult(payload: { type: "tool_result_created"; tool_result: ToolResult }): void;
  turnStarted(payload: { type: "turn_started"; turn: Turn }): void;
  turnActivity(payload: { type: "turn_activity"; activity: TurnActivity }, createdAt: string): void;
  turnFailed(payload: { type: "turn_failed"; turn_id: string; error: string }): void;
}

export function openSessionStream(sessionId: string, handlers: SessionStreamHandlers): EventSource {
  const source = new EventSource(`/api/v1/sessions/${sessionId}/events`);
  source.addEventListener("open", handlers.open);
  source.addEventListener("error", handlers.error);
  listen(source, "message_created", "message_created", handlers.messageCreated);
  listen(source, "message_delta", "message_delta", handlers.messageDelta);
  listen(source, "message_completed", "message_completed", handlers.messageCompleted);
  listen(source, "thinking_created", "thinking_created", handlers.thinkingCreated);
  listen(source, "thinking_updated", "thinking_updated", handlers.thinkingUpdated);
  listen(source, "thinking_completed", "thinking_completed", handlers.thinkingCompleted);
  listen(source, "material_updated", "material_updated", handlers.materialUpdated);
  listen(source, "tool_call_created", "tool_call_created", handlers.toolCall);
  listen(source, "tool_result_created", "tool_result_created", handlers.toolResult);
  listen(source, "turn_started", "turn_started", handlers.turnStarted);
  listen(source, "turn_activity", "turn_activity", handlers.turnActivity);
  listen(source, "turn_failed", "turn_failed", handlers.turnFailed);
  return source;
}

function listen<Type extends StreamPayload["type"]>(
  source: EventSource,
  eventName: string,
  type: Type,
  handler: (payload: Extract<StreamPayload, { type: Type }>, createdAt: string) => void,
) {
  source.addEventListener(eventName, (raw) => {
    const stream = parseStreamEvent(raw);
    if (stream?.payload.type === type) {
      handler(stream.payload as Extract<StreamPayload, { type: Type }>, stream.created_at);
    }
  });
}
