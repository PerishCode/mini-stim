import { AppRoot, DockShell, Grid, GridItem, ResizeHandle } from "@mini-stim/components";
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
  useSessions,
  useSessionTurnTimeline,
} from "@mini-stim/hooks";
import { uiStorage } from "@mini-stim/storage";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { STIM_APP_NAMESPACE } from "./appNamespace";
import { ChatShell } from "./components/ChatShell";
import { InspectPanel } from "./components/InspectPanel";
import { NavigationDock } from "./components/NavigationDock";
import { SessionRail } from "./components/SessionRail";
import { type InspectTarget, subscribeInspectTarget } from "./events/inspect";
import {
  type NavigationEvent,
  subscribeNavigation,
  toggleNavigationPanel,
} from "./events/navigation";
import type { NavigationMode } from "./navigationMode";

const DEFAULT_RAIL_WIDTH = 304;
const DEFAULT_INSPECT_WIDTH = 352;
const RAIL_WIDTH_RANGE = { min: 264, max: 420 };
const INSPECT_WIDTH_RANGE = { min: 288, max: 520 };

export function App() {
  const [preferences] = useState(() => uiStorage.read());
  const [layout, setLayout] = useState(preferences.desktopLayout);
  const [resizing, setResizing] = useState<"inspect" | "rail" | null>(null);
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
  const [inspecting, setInspecting] = useState(preferences.inspect.open);
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(null);
  const [navigation, setNavigation] = useState(preferences.navigation);

  const commitNavigation = useCallback((updater: (current: NavigationState) => NavigationState) => {
    setNavigation((current) => {
      const next = updater(current);
      uiStorage.update((stored) => ({
        ...stored,
        navigation: next,
      }));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!selectedSessionId && sessions.length) {
      actions.selectAndGet(sessions[0].session.id);
    }
  }, [actions, selectedSessionId, sessions]);

  // Inspect is a remembered view over the selected session. Keeping it open
  // across session changes refreshes the snapshot for the newly selected
  // session instead of returning to the transcript.
  useEffect(() => {
    if (inspecting && selectedSessionId) {
      actions.refreshRuntime(selectedSessionId);
    }
  }, [actions, inspecting, selectedSessionId]);

  useEffect(
    () =>
      subscribeInspectTarget(({ target }) => {
        setError(null);
        setInspectTarget(target);
        setInspecting(true);
        if (target.sessionId !== selectedSessionId) {
          actions.selectAndGet(target.sessionId);
        } else {
          actions.refreshRuntime(target.sessionId);
        }
        uiStorage.update((current) => ({
          ...current,
          inspect: {
            ...current.inspect,
            open: true,
          },
        }));
      }),
    [actions, selectedSessionId],
  );

  useEffect(
    () =>
      subscribeNavigation((event) => {
        commitNavigation((current) => nextNavigationState(current, event));
      }),
    [commitNavigation],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key.toLowerCase() !== "b" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      toggleNavigationPanel();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function openInspect() {
    setInspectTarget(null);
    if (selectedSessionId) {
      actions.refreshRuntime(selectedSessionId);
    }
    setInspecting(true);
    uiStorage.update((current) => ({
      ...current,
      inspect: {
        ...current.inspect,
        open: true,
      },
    }));
  }

  function closeInspect() {
    setInspecting(false);
    uiStorage.update((current) => ({
      ...current,
      inspect: {
        ...current.inspect,
        open: false,
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
    sessionError && !inPlaceErrors.has(sessionError.message) ? sessionError.message : null;
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
  const soulIdentity = {
    avatarSeed: runtime?.soul_profile?.avatar_seed ?? "soul_default",
    name: runtime?.soul_profile?.nickname ?? "Santi",
  };

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
    setInspectTarget(null);
    try {
      actions.selectAndGet(sessionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function send() {
    const text = draft.trim();
    if (!text || busy || !selectedSessionId) {
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

  function beginRailResize(event: ReactPointerEvent<HTMLButtonElement>) {
    beginResize("rail", event);
  }

  function beginInspectResize(event: ReactPointerEvent<HTMLButtonElement>) {
    beginResize("inspect", event);
  }

  function beginResize(target: "inspect" | "rail", event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth =
      event.currentTarget.parentElement?.getBoundingClientRect().width ??
      (target === "rail" ? DEFAULT_RAIL_WIDTH : DEFAULT_INSPECT_WIDTH);
    let nextWidth = startWidth;
    setResizing(target);

    function handlePointerMove(moveEvent: PointerEvent) {
      const delta = moveEvent.clientX - startX;
      nextWidth = clampWidth(target === "rail" ? startWidth + delta : startWidth - delta, target);
      setLayout((current) => ({
        ...current,
        railWidthPx: target === "rail" ? nextWidth : current.railWidthPx,
        inspectWidthPx: target === "inspect" ? nextWidth : current.inspectWidthPx,
      }));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setResizing(null);
      uiStorage.update((current) => ({
        ...current,
        desktopLayout: {
          ...current.desktopLayout,
          railWidthPx: target === "rail" ? nextWidth : layout.railWidthPx,
          inspectWidthPx: target === "inspect" ? nextWidth : layout.inspectWidthPx,
        },
      }));
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <AppRoot inspection={{ namespace: STIM_APP_NAMESPACE, options: { labels: false } }}>
      <DockShell.Root>
        <DockShell.Dock>
          <NavigationDock mode={navigation.mode} open={navigation.open} />
        </DockShell.Dock>
        <DockShell.Grid>
          <Grid
            template={gridTemplate(navigation.open, inspecting)}
            gap="shell"
            grow
            sidebarWidthPx={navigation.open ? layout.railWidthPx : null}
            inspectWidthPx={layout.inspectWidthPx}
          >
            {navigation.open ? (
              <GridItem area="sidebar" tag="aside">
                <SessionRail
                  mode={navigation.mode}
                  onCreate={createNewSession}
                  onSelect={selectSession}
                  previews={previews}
                  selectedSessionId={selectedSessionId}
                  sessions={sessions}
                  soulIdentity={soulIdentity}
                />
                <ResizeHandle
                  aria-label="Resize sessions panel"
                  aria-pressed={resizing === "rail"}
                  placement="end"
                  onPointerDown={beginRailResize}
                />
              </GridItem>
            ) : null}
            <GridItem area="main" tag="main">
              <ChatShell
                activity={activity}
                busy={debouncedBusy}
                connection={debouncedConnection}
                error={visibleError}
                inspecting={inspecting}
                onDraftChange={setDraft}
                onOpenInspect={openInspect}
                onSend={send}
                onTitleCommit={updateTitle}
                selectedSessionId={selectedSessionId}
                title={selectedTitle}
                titleValue={selectedSession?.profile.title ?? null}
                timeline={timeline}
                soulIdentity={soulIdentity}
                draft={draft}
              />
            </GridItem>
            {inspecting ? (
              <GridItem area="inspect" tag="aside">
                <InspectPanel
                  onClose={closeInspect}
                  runtime={runtime}
                  target={inspectTarget?.sessionId === selectedSessionId ? inspectTarget : null}
                />
                <ResizeHandle
                  aria-label="Resize inspect panel"
                  aria-pressed={resizing === "inspect"}
                  placement="start"
                  onPointerDown={beginInspectResize}
                />
              </GridItem>
            ) : null}
          </Grid>
        </DockShell.Grid>
      </DockShell.Root>
    </AppRoot>
  );
}

function sessionLabel(session: SessionSummary) {
  return session.profile.title?.trim() || "Untitled chat";
}

function clampWidth(width: number, target: "inspect" | "rail") {
  const range = target === "rail" ? RAIL_WIDTH_RANGE : INSPECT_WIDTH_RANGE;
  return Math.round(Math.min(range.max, Math.max(range.min, width)));
}

type NavigationState = {
  mode: NavigationMode;
  open: boolean;
};

function nextNavigationState(current: NavigationState, event: NavigationEvent) {
  switch (event.type) {
    case "navigation:mode-selected":
      if (current.mode === event.mode) {
        return {
          ...current,
          open: !current.open,
        };
      }
      return {
        mode: event.mode,
        open: true,
      };
    case "navigation:panel-toggled":
      return {
        ...current,
        open: !current.open,
      };
  }
}

function gridTemplate(navigationOpen: boolean, inspecting: boolean) {
  if (navigationOpen && inspecting) {
    return "sidebar-main-inspect";
  }
  if (navigationOpen) {
    return "sidebar-main";
  }
  return inspecting ? "main-inspect" : "main";
}
