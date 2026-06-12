import { useEffect, useMemo, useState } from "react";
import { AppRoot, Grid, GridItem } from "@mini-stim/components";
import { uiStorage } from "@mini-stim/storage";
import {
  type SessionSummary,
  useDebouncedValue,
  useMessageConnection,
  useSelectedSessionId,
  useSessionActions,
  useSessionError,
  useSessionPending,
  useSessionPreviews,
  useSessionRuntime,
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
  const runtime = useSessionRuntime();
  const previews = useSessionPreviews();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(() => uiStorage.read().inspect.open);

  // Inspect is a remembered view over the selected session. Keeping it open
  // across session changes refreshes the snapshot for the newly selected
  // session instead of returning to the transcript.
  useEffect(() => {
    if (inspecting && selectedSessionId) {
      actions.refreshRuntime(selectedSessionId);
    }
  }, [actions, inspecting, selectedSessionId]);

  function toggleInspect() {
    const next = !inspecting;
    if (next && selectedSessionId) {
      actions.refreshRuntime(selectedSessionId);
    }
    setInspecting(next);
    uiStorage.update((current) => ({
      ...current,
      inspect: {
        ...current.inspect,
        open: next,
      },
    }));
  }

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
    const selected = sessions.find((session) => session.session.id === selectedSessionId);
    return selected ? sessionLabel(selected) : "New session";
  }, [selectedSessionId, sessions]);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.session.id === selectedSessionId) ?? null,
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
          previews={previews}
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
          inspecting={inspecting}
          onDraftChange={setDraft}
          onSend={send}
          onTitleCommit={updateTitle}
          onToggleInspect={toggleInspect}
          runtime={runtime}
          selectedSessionId={selectedSessionId}
          title={selectedTitle}
          titleValue={selectedSession?.profile.title ?? null}
          timeline={timeline}
          draft={draft}
        />
        </GridItem>
      </Grid>
    </AppRoot>
  );
}

function sessionLabel(session: SessionSummary) {
  return session.profile.title?.trim() || session.session.id;
}
