import { useMemo, useState } from "react";
import { Composer } from "@mini-stim/components";
import {
  useMessageConnection,
  useSelectedSessionId,
  useSessionActions,
  useSessionError,
  useSessionMessages,
  useSessionPending,
  useSessions,
} from "@mini-stim/hooks";

export function App() {
  const sessions = useSessions();
  const selectedSessionId = useSelectedSessionId();
  const messages = useSessionMessages();
  const pending = useSessionPending();
  const sessionError = useSessionError();
  const connection = useMessageConnection();
  const actions = useSessionActions();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = pending > 0;
  const visibleError = error ?? sessionError?.message ?? null;
  const selectedTitle = useMemo(
    () => selectedSessionId ?? "New session",
    [selectedSessionId],
  );

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
              <span>{session.id}</span>
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
          {messages.map((message) => (
            <article
              key={message.message.id}
              className={`message ${message.message.actor_type}`}
            >
              <div>{message.content_text}</div>
            </article>
          ))}
          {!messages.length ? <div className="empty">Start a session</div> : null}
        </div>
        {visibleError ? <div className="error">{visibleError}</div> : null}
        <Composer value={draft} disabled={busy} onChange={setDraft} onSubmit={send} />
      </section>
    </main>
  );
}
