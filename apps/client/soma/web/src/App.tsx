import { useEffect, useMemo, useState } from "react";
import { Composer } from "@mini-stim/components";
import {
  installSantiMqueue,
  type SessionProjection,
} from "@mini-stim/mqueue";

const mqueue = installSantiMqueue(window);

export function App() {
  const [projection, setProjection] = useState<SessionProjection>(() =>
    mqueue.session.snapshot(),
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = mqueue.session.sub((event) => {
      if (event.phase === "failed") {
        setError(event.error?.message ?? "Session action failed");
      }
      if (event.action === "projection") {
        const next = event.payload as SessionProjection;
        setProjection(next);
        setError(next.error?.message ?? null);
      }
    });
    mqueue.session.pub("list");
    return unsubscribe;
  }, []);

  const busy = projection.pending > 0;
  const selectedTitle = useMemo(
    () => projection.selectedSessionId ?? "New session",
    [projection.selectedSessionId],
  );

  function createNewSession() {
    setError(null);
    try {
      mqueue.session.pub("create");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function selectSession(sessionId: string) {
    setError(null);
    try {
      mqueue.session.pub("select", { sessionId });
      mqueue.session.pub("get", { sessionId });
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
      mqueue.session.pub("send", {
        sessionId: projection.selectedSessionId,
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
          {projection.sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              className={session.id === projection.selectedSessionId ? "selected" : ""}
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
        </header>
        <div className="transcript">
          {projection.messages.map((message) => (
            <article
              key={message.message.id}
              className={`message ${message.message.actor_type}`}
            >
              <div>{message.content_text}</div>
            </article>
          ))}
          {!projection.messages.length ? <div className="empty">Start a session</div> : null}
        </div>
        {error ? <div className="error">{error}</div> : null}
        <Composer value={draft} disabled={busy} onChange={setDraft} onSubmit={send} />
      </section>
    </main>
  );
}
