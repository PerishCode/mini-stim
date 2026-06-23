import {
  type CreateSessionResponse,
  createSession,
  getSession,
  listMessages,
  listSessions,
  type MaterialKind,
  runtimeSnapshot,
  type SendSessionAcceptedResponse,
  type SessionDetail,
  type SessionMaterial,
  type SessionMessage,
  type SessionRuntimeSnapshot,
  type SessionSummary,
  sendSession,
  sessionMaterial,
  updateSession,
} from "@mini-stim/contracts";

import {
  cloneMessageProjection,
  cloneProjection,
  dedupeMessages,
  dispatchMessage,
  dispatchSession,
  expectStatus,
  messageEvent,
  normalizeError,
  sessionEvent,
  validateSessionPayload,
} from "./events";
import { createProjectionWriter } from "./projection";
import { openSessionStream } from "./stream";
import type {
  MessageConnectionState,
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

export type * from "./types";

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
    materialsBySessionId: {},
    messagesBySessionId: {},
    runtimeBySessionId: {},
    pending: 0,
    error: null,
  };
  const messageState: MessageProjection = {
    messagesBySessionId: {},
    timelineBySessionId: {},
    turnTimelineBySessionId: {},
    turnsBySessionId: {},
    turnActivityBySessionId: {},
    thinkingSpansBySessionId: {},
    toolCallsBySessionId: {},
    toolResultsBySessionId: {},
    connectionBySessionId: {},
  };
  let activeSessionId: string | null = null;
  let eventSource: EventSource | null = null;
  const {
    applyDelta,
    markTurnFailed,
    removeTransient,
    setMessageProjection,
    setTurnActivity,
    upsertMessages,
    upsertThinkingSpans,
    upsertTools,
    upsertTurns,
  } = createProjectionWriter(state, messageState);

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
        const sessions = expectStatus(await listSessions(), 200) as SessionSummary[];
        state.sessions = sessions;
        dispatchSession(target, sessionEvent(action, "committed", { sessions }, "http"));
        return;
      }
      case "create": {
        const { session } = expectStatus(await createSession(), 200) as CreateSessionResponse;
        upsertSession(session);
        state.selectedSessionId = summarySessionId(session);
        state.messages = state.messagesBySessionId[summarySessionId(session)] ?? [];
        connectSessionEvents(summarySessionId(session));
        await ensureMaterial(summarySessionId(session), "system_prompt");
        dispatchSession(target, sessionEvent(action, "committed", { session }, "http"));
        return;
      }
      case "get": {
        const getPayload = payload as SessionPayloads["get"];
        const detail = expectStatus(await getSession(getPayload.sessionId), 200) as SessionDetail;
        upsertSession({ session: detail.session, profile: detail.profile });
        state.selectedSessionId = detail.session.id;
        state.messagesBySessionId[detail.session.id] = dedupeMessages(detail.messages);
        state.messages = detail.messages;
        setMessageProjection(detail.session.id);
        connectSessionEvents(detail.session.id);
        await ensureMaterial(detail.session.id, "system_prompt");
        emitMessageProjection(detail.session.id);
        dispatchSession(target, sessionEvent(action, "committed", detail, "http"));
        return;
      }
      case "update": {
        const updatePayload = payload as SessionPayloads["update"];
        const session = expectStatus(
          await updateSession(updatePayload.sessionId, { title: updatePayload.title }),
          200,
        ) as SessionSummary;
        upsertSession(session);
        if (state.selectedSessionId === summarySessionId(session)) {
          state.messages = state.messagesBySessionId[summarySessionId(session)] ?? [];
        }
        dispatchSession(target, sessionEvent(action, "committed", { session }, "http"));
        return;
      }
      case "material": {
        const materialPayload = payload as SessionPayloads["material"];
        const material = await ensureMaterial(materialPayload.sessionId, materialPayload.kind);
        dispatchSession(target, sessionEvent(action, "committed", { material }, "http"));
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
        upsertTurns(runtimePayload.sessionId, runtime.turns);
        upsertThinkingSpans(runtimePayload.sessionId, runtime.thinking_spans);
        upsertTools(runtimePayload.sessionId, runtime.tool_calls, runtime.tool_results);
        await ensureMaterial(runtimePayload.sessionId, "system_prompt");
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

  function upsertSession(session: SessionSummary) {
    const existing = state.sessions.filter(
      (item) => summarySessionId(item) !== summarySessionId(session),
    );
    state.sessions = [session, ...existing].sort((left, right) =>
      right.session.updated_at.localeCompare(left.session.updated_at),
    );
  }

  async function sendMessage(sendPayload: SessionPayloads["send"]) {
    let sessionId = sendPayload.sessionId ?? state.selectedSessionId;
    if (!sessionId) {
      const { session } = expectStatus(await createSession(), 200) as CreateSessionResponse;
      upsertSession(session);
      sessionId = summarySessionId(session);
      state.selectedSessionId = sessionId;
      connectSessionEvents(sessionId);
    }
    const response = expectStatus(
      await sendSession(sessionId, { content: sendPayload.content }),
      200,
    ) as SendSessionAcceptedResponse;
    upsertSession(response.session);
    state.selectedSessionId = summarySessionId(response.session);
    upsertMessages(summarySessionId(response.session), [response.user_message]);
    upsertTurns(summarySessionId(response.session), [response.turn]);
    state.messages = state.messagesBySessionId[summarySessionId(response.session)];
    emitMessageProjection(summarySessionId(response.session));
    return response;
  }

  function emitProjection() {
    dispatchSession(
      target,
      sessionEvent("projection", "projection", cloneProjection(state), "mqueue"),
    );
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
      thinkingCreated: (payload) => {
        upsertThinkingSpans(sessionId, [payload.thinking]);
        dispatchMessage(target, messageEvent("thinking_created", sessionId, payload, "sse"));
        emitMessageProjection(sessionId);
      },
      thinkingUpdated: (payload) => {
        upsertThinkingSpans(sessionId, [payload.thinking]);
        dispatchMessage(target, messageEvent("thinking_updated", sessionId, payload, "sse"));
        emitMessageProjection(sessionId);
      },
      thinkingCompleted: (payload) => {
        upsertThinkingSpans(sessionId, [payload.thinking]);
        dispatchMessage(target, messageEvent("thinking_completed", sessionId, payload, "sse"));
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
      turnStarted: (payload) => {
        upsertTurns(sessionId, [payload.turn]);
        dispatchMessage(target, messageEvent("turn_started", sessionId, payload, "sse"));
        emitMessageProjection(sessionId);
      },
      turnActivity: (payload, createdAt) => {
        const activity = { ...payload.activity, created_at: createdAt };
        const changed = setTurnActivity(sessionId, activity);
        dispatchMessage(target, messageEvent("turn_activity", sessionId, activity, "sse"));
        if (changed) {
          emitMessageProjection(sessionId);
        }
      },
      materialUpdated: (payload) => {
        void ensureMaterial(sessionId, payload.material.kind);
      },
      turnFailed: (payload) => {
        markTurnFailed(sessionId, payload.turn_id, payload.error);
        dispatchMessage(
          target,
          messageEvent("failed", sessionId, payload, "sse", {
            error: { code: "turn_failed", message: payload.error },
          }),
        );
        emitProjection();
        emitMessageProjection(sessionId);
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

  async function ensureMaterial(sessionId: string, kind: MaterialKind): Promise<SessionMaterial> {
    const material = expectStatus(
      await sessionMaterial(sessionId, { kind }),
      200,
    ) as SessionMaterial;
    state.materialsBySessionId[sessionId] = {
      ...(state.materialsBySessionId[sessionId] ?? {}),
      [kind]: material,
    };
    emitProjection();
    return material;
  }

  function setConnection(sessionId: string, connection: MessageConnectionState) {
    messageState.connectionBySessionId[sessionId] = connection;
    dispatchMessage(target, messageEvent(connection, sessionId, { connection }, "mqueue"));
    emitMessageProjection(sessionId);
  }

  function summarySessionId(summary: SessionSummary): string {
    return summary.session.id;
  }
}
