import {
  createSession,
  getSession,
  listMessages,
  listSessions,
  runtimeSnapshot,
  sendSession,
  type CreateSessionResponse,
  type SendSessionResponse,
  type Session,
  type SessionDetail,
  type SessionMessage,
  type SessionRuntimeSnapshot,
} from "@mini-stim/contracts";

import {
  appendText,
  cloneMessageProjection,
  cloneProjection,
  dedupeMessages,
  dedupeToolCalls,
  dedupeToolResults,
  dispatchMessage,
  dispatchSession,
  expectStatus,
  messageEvent,
  normalizeError,
  sessionEvent,
  timelineItems,
  transientMessage,
  validateSessionPayload,
} from "./events";
import { openSessionStream } from "./stream";
import type {
  MessageConnectionState,
  MessageDeltaPayload,
  MessageEvent,
  MessageMqueue,
  MessagePhase,
  MessageProjection,
  PubAck,
  SantiMqueue,
  SantiWindow,
  SessionAction,
  SessionEvent,
  SessionMqueue,
  SessionPayloads,
  SessionProjection,
  SessionSubOptions,
  ToolCall,
  ToolResult,
  TimelineItem,
} from "./types";

export type {
  MessageConnectionState,
  MessageDeltaPayload,
  MessageEvent,
  MessageMqueue,
  MessagePhase,
  MessageProjection,
  MessagePart,
  MqueueError,
  PubAck,
  SantiMqueue,
  SantiWindow,
  Session,
  SessionAction,
  SessionEvent,
  SessionMqueue,
  SessionMessage,
  SessionPayloads,
  SessionPhase,
  SessionProjection,
  SessionSubOptions,
  TimelineItem,
  ToolCall,
  ToolResult,
} from "./types";

declare global {
  interface Window {
    santi?: {
      mqueue?: SantiMqueue;
    };
  }
}

const MESSAGE_EVENT = "santi:mqueue:message";

export function createSantiMqueue(target: Window & SantiWindow = window): SantiMqueue {
  const core = createMqueueCore(target);
  return { message: core.message, session: core.session };
}

export function installSantiMqueue(target: Window & SantiWindow = window): SantiMqueue {
  const mqueue = target.santi?.mqueue ?? createSantiMqueue(target);
  target.santi = { ...target.santi, mqueue };
  return mqueue;
}

function createMqueueCore(target: Window): SantiMqueue {
  const state: SessionProjection = {
    sessions: [],
    selectedSessionId: null,
    messages: [],
    messagesBySessionId: {},
    runtimeBySessionId: {},
    pending: 0,
    error: null,
  };
  const messageState: MessageProjection = {
    messagesBySessionId: {},
    timelineBySessionId: {},
    toolCallsBySessionId: {},
    toolResultsBySessionId: {},
    connectionBySessionId: {},
  };
  let activeSessionId: string | null = null;
  let eventSource: EventSource | null = null;

  const session: SessionMqueue = { pub, sub: subSession, snapshot };
  const message: MessageMqueue = { sub: subMessage, snapshot: messageSnapshot };
  return { message, session };

  function pub<Action extends SessionAction>(
    action: Action,
    ...args: SessionPayloads[Action] extends undefined
      ? [payload?: SessionPayloads[Action]]
      : [payload: SessionPayloads[Action]]
  ): PubAck {
    const payload = args[0] as SessionPayloads[Action];
    validateSessionPayload(action, payload);
    const intent = sessionEvent(action, "intent", payload, "mqueue");
    dispatchSession(target, intent);
    void perform(action, payload, intent);
    return { accepted: true, eventId: intent.eventId };
  }

  function subSession(
    handler: (event: SessionEvent) => void,
    options: SessionSubOptions = {},
  ): () => void {
    const listener = (raw: Event) => {
      const event = (raw as CustomEvent<SessionEvent>).detail;
      if (options.action && event.action !== options.action) {
        return;
      }
      if (options.phase && event.phase !== options.phase) {
        return;
      }
      handler(event);
    };
    target.addEventListener("santi:mqueue:session", listener);
    return () => target.removeEventListener("santi:mqueue:session", listener);
  }

  function snapshot(): SessionProjection {
    return cloneProjection(state);
  }

  function subMessage(
    handler: (event: MessageEvent) => void,
    options: { phase?: MessagePhase; sessionId?: string } = {},
  ): () => void {
    const listener = (raw: Event) => {
      const event = (raw as CustomEvent<MessageEvent>).detail;
      if (options.phase && event.phase !== options.phase) {
        return;
      }
      if (options.sessionId && event.sessionId !== options.sessionId) {
        return;
      }
      handler(event);
    };
    target.addEventListener(MESSAGE_EVENT, listener);
    return () => target.removeEventListener(MESSAGE_EVENT, listener);
  }

  function messageSnapshot(): MessageProjection {
    return cloneMessageProjection(messageState);
  }

  async function perform<Action extends SessionAction>(
    action: Action,
    payload: SessionPayloads[Action],
    intent: SessionEvent<Action, SessionPayloads[Action]>,
  ) {
    if (action === "select") {
      const selected = (payload as SessionPayloads["select"]).sessionId;
      state.selectedSessionId = selected;
      state.messages = selected ? (state.messagesBySessionId[selected] ?? []) : [];
      state.error = null;
      if (selected) {
        connectSessionEvents(selected);
      } else {
        closeSessionEvents();
      }
      dispatchSession(target, sessionEvent(action, "committed", payload, "mqueue"));
      emitProjection();
      return;
    }

    state.pending += 1;
    state.error = null;
    dispatchSession(target, sessionEvent(action, "accepted", payload, "mqueue"));
    emitProjection();

    try {
      await performHttp(action, payload);
    } catch (cause) {
      const failure = normalizeError(cause);
      state.error = failure;
      dispatchSession(
        target,
        sessionEvent(action, "failed", payload, "http", {
          error: failure,
          idempotencyKey: intent.idempotencyKey,
        }),
      );
    } finally {
      state.pending = Math.max(0, state.pending - 1);
      emitProjection();
    }
  }

  async function performHttp<Action extends SessionAction>(
    action: Action,
    payload: SessionPayloads[Action],
  ) {
    switch (action) {
      case "list": {
        const sessions = expectStatus(await listSessions(), 200) as Session[];
        state.sessions = sessions;
        dispatchSession(target, sessionEvent(action, "committed", { sessions }, "http"));
        return;
      }
      case "create": {
        const { session } = expectStatus(
          await createSession(),
          200,
        ) as CreateSessionResponse;
        upsertSession(session);
        state.selectedSessionId = session.id;
        state.messages = state.messagesBySessionId[session.id] ?? [];
        connectSessionEvents(session.id);
        dispatchSession(target, sessionEvent(action, "committed", { session }, "http"));
        return;
      }
      case "get": {
        const getPayload = payload as SessionPayloads["get"];
        const detail = expectStatus(
          await getSession(getPayload.sessionId),
          200,
        ) as SessionDetail;
        upsertSession(detail.session);
        state.selectedSessionId = detail.session.id;
        state.messagesBySessionId[detail.session.id] = dedupeMessages(detail.messages);
        state.messages = detail.messages;
        setMessageProjection(detail.session.id);
        connectSessionEvents(detail.session.id);
        emitMessageProjection(detail.session.id);
        dispatchSession(target, sessionEvent(action, "committed", detail, "http"));
        return;
      }
      case "messages": {
        const messagesPayload = payload as SessionPayloads["messages"];
        const messages = expectStatus(
          await listMessages(messagesPayload.sessionId),
          200,
        ) as SessionMessage[];
        state.messagesBySessionId[messagesPayload.sessionId] = dedupeMessages(messages);
        if (state.selectedSessionId === messagesPayload.sessionId) {
          state.messages = state.messagesBySessionId[messagesPayload.sessionId];
        }
        setMessageProjection(messagesPayload.sessionId);
        emitMessageProjection(messagesPayload.sessionId);
        dispatchSession(target, sessionEvent(action, "committed", { messages }, "http"));
        return;
      }
      case "runtime": {
        const runtimePayload = payload as SessionPayloads["runtime"];
        const runtime = expectStatus(
          await runtimeSnapshot(runtimePayload.sessionId),
          200,
        ) as SessionRuntimeSnapshot;
        state.runtimeBySessionId[runtimePayload.sessionId] = runtime;
        upsertTools(runtimePayload.sessionId, runtime.tool_calls, runtime.tool_results);
        emitMessageProjection(runtimePayload.sessionId);
        dispatchSession(target, sessionEvent(action, "committed", runtime, "http"));
        return;
      }
      case "send": {
        const sendPayload = payload as SessionPayloads["send"];
        const response = await sendMessage(sendPayload);
        dispatchSession(target, sessionEvent(action, "committed", response, "http"));
        return;
      }
      case "select":
        return;
    }
  }

  function upsertSession(session: Session) {
    const existing = state.sessions.filter((item) => item.id !== session.id);
    state.sessions = [session, ...existing].sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at),
    );
  }

  async function sendMessage(sendPayload: SessionPayloads["send"]) {
    let sessionId = sendPayload.sessionId ?? state.selectedSessionId;
    if (!sessionId) {
      const { session } = expectStatus(
        await createSession(),
        200,
      ) as CreateSessionResponse;
      upsertSession(session);
      sessionId = session.id;
      state.selectedSessionId = session.id;
      connectSessionEvents(session.id);
    }
    const response = expectStatus(
      await sendSession(sessionId, { content: sendPayload.content }),
      200,
    ) as SendSessionResponse;
    upsertSession(response.session);
    state.selectedSessionId = response.session.id;
    upsertMessages(response.session.id, [
      response.user_message,
      response.assistant_message,
    ]);
    upsertTools(response.session.id, response.tool_calls, response.tool_results);
    state.messages = state.messagesBySessionId[response.session.id];
    emitMessageProjection(response.session.id);
    return response;
  }

  function emitProjection() {
    dispatchSession(target, sessionEvent("projection", "projection", cloneProjection(state), "mqueue"));
  }

  function emitMessageProjection(sessionId: string) {
    setMessageProjection(sessionId);
    dispatchMessage(
      target,
      messageEvent("projection", sessionId, cloneMessageProjection(messageState), "mqueue"),
    );
  }

  function connectSessionEvents(sessionId: string) {
    if (activeSessionId === sessionId && eventSource) {
      return;
    }
    closeSessionEvents();
    activeSessionId = sessionId;
    setConnection(sessionId, "connecting");
    eventSource = openSessionStream(sessionId, {
      open: () => setConnection(sessionId, "open"),
      error: () => setConnection(sessionId, "error"),
      messageCreated: (payload) => {
        upsertMessages(sessionId, [payload.message]);
        dispatchMessage(target, messageEvent("created", sessionId, payload, "sse"));
        emitProjection();
        emitMessageProjection(sessionId);
      },
      messageDelta: (payload) => {
        applyDelta(sessionId, payload);
        dispatchMessage(target, messageEvent("delta", sessionId, payload, "sse"));
        emitProjection();
        emitMessageProjection(sessionId);
      },
      messageCompleted: (payload) => {
        removeTransient(sessionId, payload.turn_id);
        upsertMessages(sessionId, [payload.message]);
        dispatchMessage(target, messageEvent("completed", sessionId, payload, "sse"));
        emitProjection();
        emitMessageProjection(sessionId);
      },
      toolCall: (payload) => {
        upsertTools(sessionId, [payload.tool_call], []);
        dispatchMessage(target, messageEvent("tool_call", sessionId, payload, "sse"));
        emitMessageProjection(sessionId);
      },
      toolResult: (payload) => {
        upsertTools(sessionId, [], [payload.tool_result]);
        dispatchMessage(target, messageEvent("tool_result", sessionId, payload, "sse"));
        emitMessageProjection(sessionId);
      },
      turnFailed: (payload) => {
        const failure = { code: "turn_failed", message: payload.error };
        state.error = failure;
        dispatchMessage(
          target,
          messageEvent("failed", sessionId, payload, "sse", {
            error: failure,
          }),
        );
        emitProjection();
      },
    });
  }

  function closeSessionEvents() {
    if (!eventSource) {
      return;
    }
    const sessionId = activeSessionId;
    eventSource.close();
    eventSource = null;
    activeSessionId = null;
    if (sessionId) {
      setConnection(sessionId, "closed");
    }
  }

  function setConnection(sessionId: string, connection: MessageConnectionState) {
    messageState.connectionBySessionId[sessionId] = connection;
    dispatchMessage(target, messageEvent(connection, sessionId, { connection }, "mqueue"));
    emitMessageProjection(sessionId);
  }

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
    messageState.timelineBySessionId[sessionId] = timelineItems(
      sessionId,
      messages,
      calls,
      results,
    );
  }
}
