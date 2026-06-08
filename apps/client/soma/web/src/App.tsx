import { useMemo, useState } from "react";
import { Composer } from "@mini-stim/components";
import {
  useMessageConnection,
  useSelectedSessionId,
  useSessionActions,
  useSessionError,
  useSessionPending,
  useSessionTimeline,
  useSessions,
  type TimelineItem,
} from "@mini-stim/hooks";

export function App() {
  const sessions = useSessions();
  const selectedSessionId = useSelectedSessionId();
  const timeline = useSessionTimeline();
  const pending = useSessionPending();
  const sessionError = useSessionError();
  const connection = useMessageConnection();
  const actions = useSessionActions();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = pending > 0;
  const visibleError = error ?? sessionError?.message ?? null;
  const selectedTitle = useMemo(() => {
    const selected = sessions.find((session) => session.id === selectedSessionId);
    return selected ? sessionLabel(selected) : "New session";
  }, [selectedSessionId, sessions]);

  function createNewSession() {
    setError(null);
    try {
      actions.create();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function selectSession(sessionId: string) {
    setError(null);
    try {
      actions.selectAndGet(sessionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function send() {
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    setError(null);
    setDraft("");
    try {
      actions.send({
        sessionId: selectedSessionId,
        content: [{ type: "text", text }],
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setDraft(text);
    }
  }

  return (
    <main className="shell">
      <aside className="rail">
        <div className="railHeader">
          <h1>mini-stim</h1>
          <button type="button" onClick={createNewSession} disabled={busy}>
            New
          </button>
        </div>
        <nav className="conversationList">
          {sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              className={session.id === selectedSessionId ? "selected" : ""}
              onClick={() => selectSession(session.id)}
            >
              <span>{sessionLabel(session)}</span>
              <small>{session.updated_at}</small>
            </button>
          ))}
        </nav>
      </aside>
      <section className="chat">
        <header className="chatHeader">
          <h2>{selectedTitle}</h2>
          {busy ? <span>Sending</span> : null}
          {selectedSessionId ? <span>{connection}</span> : null}
        </header>
        <div className="transcript">
          {timeline.map((item) => renderTimelineItem(item))}
          {!timeline.length ? <div className="empty">Start a session</div> : null}
        </div>
        {visibleError ? <div className="error">{visibleError}</div> : null}
        <Composer value={draft} disabled={busy} onChange={setDraft} onSubmit={send} />
      </section>
    </main>
  );
}

function sessionLabel(session: { id: string; title?: string | null }) {
  return session.title?.trim() || session.id;
}

function renderTimelineItem(item: TimelineItem) {
  if (item.kind === "message") {
    const role = item.message.message.actor_type;
    return (
      <article key={item.id} className={`message role-${role}`}>
        <div>{item.message.content_text}</div>
      </article>
    );
  }

  if (item.kind === "tool_call") {
    const result = item.toolResult;
    const failed = Boolean(result?.error_text);
    return (
      <article key={item.id} className={`toolBlock ${failed ? "failed" : ""}`}>
        <header>
          <span>{item.toolCall.tool_name}</span>
          <small>{result ? (failed ? "failed" : "completed") : "running"}</small>
        </header>
        <pre>{formatJson(item.toolCall.arguments)}</pre>
        {result ? (
          <pre className="toolOutput">
            {result.error_text ?? formatJson(result.output)}
          </pre>
        ) : null}
      </article>
    );
  }

  const failed = Boolean(item.toolResult.error_text);
  return (
    <article key={item.id} className={`toolBlock ${failed ? "failed" : ""}`}>
      <header>
        <span>tool result</span>
        <small>{failed ? "failed" : "completed"}</small>
      </header>
      <pre className="toolOutput">
        {item.toolResult.error_text ?? formatJson(item.toolResult.output)}
      </pre>
    </article>
  );
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}
