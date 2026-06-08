import { useEffect, useMemo, useState } from "react";
import {
  createSession,
  getSession,
  listSessions,
  sendSession,
  type CreateSessionResponse,
  type Session,
  type SendSessionResponse,
  type SessionDetail,
  type SessionMessage,
} from "@mini-stim/contracts";
import { Composer } from "@mini-stim/components";

export function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshSessions(setSessions, setError);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadSession(selectedId, setMessages, setError);
  }, [selectedId]);

  const selectedTitle = useMemo(() => selectedId ?? "New session", [selectedId]);

  async function createNewSession() {
    setBusy(true);
    setError(null);
    try {
      const { session } = expectStatus(
        await createSession(),
        200,
      ) as CreateSessionResponse;
      setSelectedId(session.id);
      await refreshSessions(setSessions, setError);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setDraft("");
    try {
      let sessionId = selectedId;
      if (!sessionId) {
        const created = expectStatus(await createSession(), 200) as CreateSessionResponse;
        sessionId = created.session.id;
      }
      setSelectedId(sessionId);
      const response = expectStatus(
        await sendSession(sessionId, { content: [{ type: "text", text }] }),
        200,
      ) as SendSessionResponse;
      setMessages([response.user_message, response.assistant_message]);
      await refreshSessions(setSessions, setError);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setDraft(text);
    } finally {
      setBusy(false);
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
              className={session.id === selectedId ? "selected" : ""}
              onClick={() => setSelectedId(session.id)}
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
        {error ? <div className="error">{error}</div> : null}
        <Composer value={draft} disabled={busy} onChange={setDraft} onSubmit={send} />
      </section>
    </main>
  );
}

async function refreshSessions(
  setSessions: (items: Session[]) => void,
  setError: (error: string | null) => void,
) {
  try {
    setSessions(expectStatus(await listSessions(), 200) as Session[]);
  } catch (caught) {
    setError(caught instanceof Error ? caught.message : String(caught));
  }
}

async function loadSession(
  sessionId: string,
  setMessages: (items: SessionMessage[]) => void,
  setError: (error: string | null) => void,
) {
  try {
    const detail = expectStatus(await getSession(sessionId), 200) as SessionDetail;
    setMessages(detail.messages);
  } catch (caught) {
    setError(caught instanceof Error ? caught.message : String(caught));
  }
}

function expectStatus<T>(
  response: T,
  status: number,
): unknown {
  const result = response as { status: number; data: unknown };
  if (result.status === status) {
    return result.data;
  }
  const body = result.data as { message?: unknown };
  throw new Error(
    typeof body.message === "string"
      ? body.message
      : `API request failed with status ${result.status}`,
  );
}
