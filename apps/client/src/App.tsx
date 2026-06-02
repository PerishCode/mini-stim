import { useEffect, useMemo, useState } from "react";
import { Composer } from "@mini-stim/components";
import type {
  ConversationDetail,
  ConversationSummary,
  MessageRecord,
  StreamEvent,
} from "@mini-stim/contracts";

const API_BASE = import.meta.env.VITE_SANTI_API_URL ?? "http://127.0.0.1:3307";

export function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshConversations(setConversations);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadConversation(selectedId, setMessages, setError);
  }, [selectedId]);

  const selectedTitle = useMemo(() => {
    return (
      conversations.find((conversation) => conversation.conversation_id === selectedId)
        ?.title ?? "New conversation"
    );
  }, [conversations, selectedId]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setDraft("");
    try {
      await streamMessage(
        { conversation_id: selectedId, text },
        (event) => {
          applyStreamEvent(event, setSelectedId, setMessages);
        },
      );
      await refreshConversations(setConversations);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="rail">
        <div className="railHeader">
          <h1>mini-stim</h1>
          <button type="button" onClick={() => setSelectedId(null)}>
            New
          </button>
        </div>
        <nav className="conversationList">
          {conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.conversation_id}
              className={
                conversation.conversation_id === selectedId ? "selected" : ""
              }
              onClick={() => setSelectedId(conversation.conversation_id)}
            >
              <span>{conversation.title ?? "Untitled"}</span>
              {conversation.last_message_preview ? (
                <small>{conversation.last_message_preview}</small>
              ) : null}
            </button>
          ))}
        </nav>
      </aside>
      <section className="chat">
        <header className="chatHeader">
          <h2>{selectedTitle}</h2>
          {busy ? <span>Streaming</span> : null}
        </header>
        <div className="transcript">
          {messages.map((message) => (
            <article key={message.message_id} className={`message ${message.role}`}>
              <div>{message.text}</div>
              {message.state === "failed" && message.error ? (
                <small>{message.error}</small>
              ) : null}
            </article>
          ))}
          {!messages.length ? <div className="empty">Start a conversation</div> : null}
        </div>
        {error ? <div className="error">{error}</div> : null}
        <Composer value={draft} disabled={busy} onChange={setDraft} onSubmit={send} />
      </section>
    </main>
  );
}

async function refreshConversations(
  setConversations: (items: ConversationSummary[]) => void,
) {
  const response = await fetch(`${API_BASE}/api/conversations`);
  if (!response.ok) {
    throw new Error(`conversation list failed: ${response.status}`);
  }
  setConversations((await response.json()) as ConversationSummary[]);
}

async function loadConversation(
  conversationId: string,
  setMessages: (items: MessageRecord[]) => void,
  setError: (error: string | null) => void,
) {
  const response = await fetch(`${API_BASE}/api/conversations/${conversationId}`);
  if (!response.ok) {
    setError(`conversation load failed: ${response.status}`);
    return;
  }
  const detail = (await response.json()) as ConversationDetail;
  setMessages(detail.messages);
}

async function streamMessage(
  request: { conversation_id: string | null; text: string },
  onEvent: (event: StreamEvent) => void,
) {
  const response = await fetch(`${API_BASE}/api/messages/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok || !response.body) {
    throw new Error(`message stream failed: ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const read = await reader.read();
    if (read.done) {
      break;
    }
    buffer += decoder.decode(read.value, { stream: true });
    let index = buffer.indexOf("\n");
    while (index >= 0) {
      const line = buffer.slice(0, index).trimEnd();
      buffer = buffer.slice(index + 1);
      const payload = line.startsWith("data: ") ? line.slice(6) : null;
      if (payload) {
        onEvent(JSON.parse(payload) as StreamEvent);
      }
      index = buffer.indexOf("\n");
    }
  }
}

function applyStreamEvent(
  event: StreamEvent,
  setSelectedId: (id: string) => void,
  setMessages: React.Dispatch<React.SetStateAction<MessageRecord[]>>,
) {
  if (event.type === "accepted") {
    setSelectedId(event.accepted.conversation_id);
    setMessages((messages) => [
      ...messages,
      event.accepted.user_message,
      event.accepted.assistant_message,
    ]);
  }
  if (event.type === "text-delta") {
    setMessages((messages) =>
      messages.map((message) =>
        message.message_id === event.message_id
          ? { ...message, text: message.text + event.delta }
          : message,
      ),
    );
  }
  if (event.type === "message-completed") {
    setMessages((messages) =>
      messages.map((message) =>
        message.message_id === event.message.message_id ? event.message : message,
      ),
    );
  }
  if (event.type === "failed") {
    setMessages((messages) =>
      messages.map((message) =>
        message.message_id === event.message_id
          ? { ...message, state: "failed", error: event.error }
          : message,
      ),
    );
  }
}
