import {
  appendText,
  dedupeMessages,
  dedupeToolCalls,
  dedupeToolResults,
  dedupeTurns,
  timelineItems,
  transientMessage,
  turnGroups,
} from "./events";
import type {
  MessageDeltaPayload,
  MessageProjection,
  SessionMessage,
  SessionProjection,
  ToolCall,
  ToolResult,
  Turn,
} from "./types";

/**
 * Mutation surface over the two projection states. Owns every write that
 * must keep the per-session message list, flat timeline, and turn-grouped
 * timeline consistent with each other.
 */
export function createProjectionWriter(state: SessionProjection, messageState: MessageProjection) {
  return {
    applyDelta,
    markTurnFailed,
    removeTransient,
    setMessageProjection,
    upsertMessages,
    upsertTools,
    upsertTurns,
  };

  function applyDelta(sessionId: string, payload: MessageDeltaPayload) {
    const existing = state.messagesBySessionId[sessionId] ?? [];
    const index = existing.findIndex((message) => message.message.id === payload.message_id);
    if (index === -1) {
      state.messagesBySessionId[sessionId] = [...existing, transientMessage(sessionId, payload)];
    } else {
      const current = existing[index];
      state.messagesBySessionId[sessionId] = [
        ...existing.slice(0, index),
        appendText(current, payload.text),
        ...existing.slice(index + 1),
      ];
    }
    if (state.selectedSessionId === sessionId) {
      state.messages = state.messagesBySessionId[sessionId];
    }
    setMessageProjection(sessionId);
  }

  function removeTransient(sessionId: string, turnId: string) {
    const transientId = `stream_${turnId}`;
    state.messagesBySessionId[sessionId] = (state.messagesBySessionId[sessionId] ?? []).filter(
      (message) => message.message.id !== transientId,
    );
  }

  function upsertMessages(sessionId: string, messages: SessionMessage[]) {
    state.messagesBySessionId[sessionId] = dedupeMessages([
      ...(state.messagesBySessionId[sessionId] ?? []),
      ...messages,
    ]);
    if (state.selectedSessionId === sessionId) {
      state.messages = state.messagesBySessionId[sessionId];
    }
    setMessageProjection(sessionId);
  }

  function upsertTurns(sessionId: string, turns: Turn[]) {
    messageState.turnsBySessionId[sessionId] = dedupeTurns([
      ...(messageState.turnsBySessionId[sessionId] ?? []),
      ...turns,
    ]);
    setMessageProjection(sessionId);
  }

  function markTurnFailed(sessionId: string, turnId: string, error: string) {
    const turns = messageState.turnsBySessionId[sessionId] ?? [];
    const index = turns.findIndex((turn) => turn.id === turnId);
    if (index === -1) {
      return;
    }
    const failed: Turn = {
      ...turns[index],
      status: "failed",
      error_text: error,
    };
    messageState.turnsBySessionId[sessionId] = [
      ...turns.slice(0, index),
      failed,
      ...turns.slice(index + 1),
    ];
    setMessageProjection(sessionId);
  }

  function upsertTools(sessionId: string, calls: ToolCall[], results: ToolResult[]) {
    messageState.toolCallsBySessionId[sessionId] = dedupeToolCalls([
      ...(messageState.toolCallsBySessionId[sessionId] ?? []),
      ...calls,
    ]);
    messageState.toolResultsBySessionId[sessionId] = dedupeToolResults([
      ...(messageState.toolResultsBySessionId[sessionId] ?? []),
      ...results,
    ]);
    setMessageProjection(sessionId);
  }

  function setMessageProjection(sessionId: string) {
    const messages = state.messagesBySessionId[sessionId] ?? [];
    const calls = messageState.toolCallsBySessionId[sessionId] ?? [];
    const results = messageState.toolResultsBySessionId[sessionId] ?? [];
    messageState.messagesBySessionId[sessionId] = messages;
    const timeline = timelineItems(sessionId, messages, calls, results);
    messageState.timelineBySessionId[sessionId] = timeline;
    messageState.turnTimelineBySessionId[sessionId] = turnGroups(
      sessionId,
      timeline,
      messageState.turnsBySessionId[sessionId] ?? [],
    );
  }
}
