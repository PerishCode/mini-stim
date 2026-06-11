import { useMemo, useState } from "react";
import { AppRoot, Grid, GridItem } from "@mini-stim/components";
import {
  useDebouncedValue,
  useMessageConnection,
  useSelectedSessionId,
  useSessionActions,
  useSessionError,
  useSessionPending,
  useSessionTurnTimeline,
  useSessions,
} from "@mini-stim/hooks";

import { ChatShell } from "./components/ChatShell";
import { SessionRail } from "./components/SessionRail";

export function App() {
  const sessions = useSessions();
  const selectedSessionId = useSelectedSessionId();
  const timeline = useSessionTurnTimeline();
  const pending = useSessionPending();
  const sessionError = useSessionError();
  const connection = useMessageConnection();
  const actions = useSessionActions();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = pending > 0;
  const debouncedBusy = useDebouncedValue(busy, { debounceMs: 150 });
  // While a turn is running, the header chip names the phase the turn is
  // actually in instead of a generic "sending".
  const activity = useMemo(() => {
    const running = timeline.find((group) => group.turn?.status === "running");
    if (!running) {
      return "sending";
    }
    if (running.items.some((item) => item.kind === "tool_call" && !item.toolResult)) {
      return "running tool";
    }
    if (
      running.items.some(
        (item) => item.kind === "message" && item.message.message.state === "pending",
      )
    ) {
      return "generating";
    }
    return "thinking";
  }, [timeline]);
  // Turn failures render in place inside the transcript; the composer
  // notice keeps only errors that no failed turn already carries.
  const inPlaceErrors = useMemo(
    () =>
      new Set(
        timeline
          .filter((group) => group.turn?.status === "failed")
          .map((group) => group.turn?.error_text)
          .filter((text): text is string => Boolean(text)),
      ),
    [timeline],
  );
  const sessionErrorMessage =
    sessionError && !inPlaceErrors.has(sessionError.message)
      ? sessionError.message
      : null;
  const visibleError = error ?? sessionErrorMessage;
  const debouncedConnection = useDebouncedValue(connection, { debounceMs: 150 });
  const selectedTitle = useMemo(() => {
    const selected = sessions.find((session) => session.id === selectedSessionId);
    return selected ? sessionLabel(selected) : "New session";
  }, [selectedSessionId, sessions]);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
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

  function updateTitle(title: string | null) {
    if (!selectedSessionId) {
      return;
    }
    setError(null);
    try {
      actions.updateTitle(selectedSessionId, title);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <AppRoot>
      <Grid template="sidebar-main" gap="shell" grow>
        <GridItem area="sidebar" tag="aside">
        <SessionRail
          busy={busy}
          onCreate={createNewSession}
          onSelect={selectSession}
          selectedSessionId={selectedSessionId}
          sessions={sessions}
        />
        </GridItem>
        <GridItem area="main" tag="main">
        <ChatShell
          activity={activity}
          busy={debouncedBusy}
          connection={debouncedConnection}
          error={visibleError}
          onDraftChange={setDraft}
          onSend={send}
          onTitleCommit={updateTitle}
          selectedSessionId={selectedSessionId}
          title={selectedTitle}
          titleValue={selectedSession?.title ?? null}
          timeline={timeline}
          draft={draft}
        />
        </GridItem>
      </Grid>
    </AppRoot>
  );
}

function sessionLabel(session: { id: string; title?: string | null }) {
  return session.title?.trim() || session.id;
}
