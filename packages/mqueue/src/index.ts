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
  expectStatus,
  messageEvent,
  normalizeError,
  parseStreamEvent,
  sessionEvent,
  transientMessage,
} from "./events";
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
} from "./types";

declare global {
  interface Window {
    santi?: {
      mqueue?: SantiMqueue;
    };
  }
}

const SESSION_EVENT = "santi:mqueue:session";
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
    validate(action, payload);
    const intent = sessionEvent(action, "intent", payload, "mqueue");
    dispatch(target, intent);
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
    target.addEventListener(SESSION_EVENT, listener);
    return () => target.removeEventListener(SESSION_EVENT, listener);
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
      dispatch(target, sessionEvent(action, "committed", payload, "mqueue"));
      emitProjection();
      return;
    }

    state.pending += 1;
    state.error = null;
    dispatch(target, sessionEvent(action, "accepted", payload, "mqueue"));
    emitProjection();

    try {
      await performHttp(action, payload);
    } catch (cause) {
      const failure = normalizeError(cause);
      state.error = failure;
      dispatch(
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
        dispatch(target, sessionEvent(action, "committed", { sessions }, "http"));
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
        dispatch(target, sessionEvent(action, "committed", { session }, "http"));
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
        messageState.messagesBySessionId[detail.session.id] = state.messages;
        connectSessionEvents(detail.session.id);
        dispatch(target, sessionEvent(action, "committed", detail, "http"));
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
        messageState.messagesBySessionId[messagesPayload.sessionId] =
          state.messagesBySessionId[messagesPayload.sessionId];
        dispatch(target, sessionEvent(action, "committed", { messages }, "http"));
        return;
      }
      case "runtime": {
        const runtimePayload = payload as SessionPayloads["runtime"];
        const runtime = expectStatus(
          await runtimeSnapshot(runtimePayload.sessionId),
          200,
        ) as SessionRuntimeSnapshot;
        state.runtimeBySessionId[runtimePayload.sessionId] = runtime;
        dispatch(target, sessionEvent(action, "committed", runtime, "http"));
        return;
      }
      case "send": {
        const sendPayload = payload as SessionPayloads["send"];
        const response = await sendMessage(sendPayload);
        dispatch(target, sessionEvent(action, "committed", response, "http"));
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
    state.messages = state.messagesBySessionId[response.session.id];
    return response;
  }

  function emitProjection() {
    dispatch(target, sessionEvent("projection", "projection", cloneProjection(state), "mqueue"));
  }

  function emitMessageProjection(sessionId: string) {
    messageState.messagesBySessionId[sessionId] = state.messagesBySessionId[sessionId] ?? [];
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
    eventSource = new EventSource(`/api/v1/sessions/${sessionId}/events`);
    eventSource.addEventListener("open", () => {
      setConnection(sessionId, "open");
    });
    eventSource.addEventListener("error", () => {
      setConnection(sessionId, "error");
    });
    eventSource.addEventListener("message_created", (raw) => {
      const stream = parseStreamEvent(raw);
      if (stream?.payload.type !== "message_created") {
        return;
      }
      upsertMessages(stream.session_id, [stream.payload.message]);
      dispatchMessage(
        target,
        messageEvent("created", stream.session_id, stream.payload, "sse"),
      );
      emitProjection();
      emitMessageProjection(stream.session_id);
    });
    eventSource.addEventListener("message_delta", (raw) => {
      const stream = parseStreamEvent(raw);
      if (stream?.payload.type !== "message_delta") {
        return;
      }
      applyDelta(stream.session_id, stream.payload);
      dispatchMessage(
        target,
        messageEvent("delta", stream.session_id, stream.payload, "sse"),
      );
      emitProjection();
      emitMessageProjection(stream.session_id);
    });
    eventSource.addEventListener("message_completed", (raw) => {
      const stream = parseStreamEvent(raw);
      if (stream?.payload.type !== "message_completed") {
        return;
      }
      removeTransient(stream.session_id, stream.payload.turn_id);
      upsertMessages(stream.session_id, [stream.payload.message]);
      dispatchMessage(
        target,
        messageEvent("completed", stream.session_id, stream.payload, "sse"),
      );
      emitProjection();
      emitMessageProjection(stream.session_id);
    });
    eventSource.addEventListener("turn_failed", (raw) => {
      const stream = parseStreamEvent(raw);
      if (stream?.payload.type !== "turn_failed") {
        return;
      }
      const failure = { code: "turn_failed", message: stream.payload.error };
      state.error = failure;
      dispatchMessage(
        target,
        messageEvent("failed", stream.session_id, stream.payload, "sse", {
          error: failure,
        }),
      );
      emitProjection();
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
    messageState.messagesBySessionId[sessionId] = state.messagesBySessionId[sessionId];
  }
}

function dispatchMessage(target: Window, detail: MessageEvent) {
  target.dispatchEvent(new CustomEvent(MESSAGE_EVENT, { detail }));
  target.dispatchEvent(new CustomEvent(detail.type, { detail }));
}

function validate<Action extends SessionAction>(
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

function dispatch(target: Window, detail: SessionEvent) {
  target.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail }));
  target.dispatchEvent(new CustomEvent(detail.type, { detail }));
}
