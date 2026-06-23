import type { MessageState, SessionMessage } from "@mini-stim/contracts";

import type { MessageDeltaPayload } from "../../types";

export const DEFAULT_ACTOR_ID = "account_local";

export function actorIdForRole(role: MessageDeltaPayload["role"]) {
  return role === "soul" ? "soul_default" : role === "system" ? "santi" : DEFAULT_ACTOR_ID;
}

export function transientMessage(sessionId: string, payload: MessageDeltaPayload): SessionMessage {
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
      actor_id: actorIdForRole(payload.role),
      message_kind: "text",
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
