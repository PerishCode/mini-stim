import {
  installSantiMqueue,
  type MaterialKind,
  type MessageConnectionState,
  type MessageEvent,
  type MessagePart,
  type MessageProjection,
  type MqueueError,
  type PubAck,
  type SantiMqueue,
  type SantiWindow,
  type SessionMaterial,
  type SessionMessage,
  type SessionProjection,
  type SessionRuntimeSnapshot,
  type SessionSummary,
  type TurnGroup,
} from "@mini-stim/mqueue";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type {
  Compact,
  MaterialKind,
  MaterialUpdated,
  MessageConnectionState,
  MessagePart,
  MqueueError,
  PubAck,
  SantiMqueue,
  Session,
  SessionEffect,
  SessionMaterial,
  SessionMessage,
  SessionProjection,
  SessionRuntimeSnapshot,
  SessionSummary,
  SoulSession,
  ThinkingCompletionReason,
  ThinkingSpan,
  ThinkingSpanState,
  TimelineItem,
  Turn,
  TurnActivity,
  TurnActivityProjection,
  TurnActivityState,
  TurnGroup,
  TurnStatus,
} from "@mini-stim/mqueue";

interface SantiMqueueProviderProps {
  children: ReactNode;
  mqueue?: SantiMqueue;
  target?: Window & SantiWindow;
  autoList?: boolean;
}

interface SessionActions {
  create(): PubAck;
  get(sessionId: string): PubAck;
  list(): PubAck;
  refreshMaterial(sessionId: string, kind: MaterialKind): PubAck;
  refreshRuntime(sessionId: string): PubAck;
  select(sessionId: string | null): PubAck;
  selectAndGet(sessionId: string): PubAck[];
  send(input: { sessionId?: string | null; content: MessagePart[] }): PubAck;
  updateTitle(sessionId: string, title: string | null): PubAck;
}

const SantiMqueueContext = createContext<SantiMqueue | null>(null);

export function SantiMqueueProvider({
  autoList = true,
  children,
  mqueue: provided,
  target,
}: SantiMqueueProviderProps) {
  const mqueueRef = useRef<SantiMqueue | null>(null);
  if (!mqueueRef.current) {
    mqueueRef.current = provided ?? installBrowserMqueue(target);
  }
  const mqueue = mqueueRef.current;

  useEffect(() => {
    if (autoList) {
      mqueue.session.pub("list");
    }
  }, [autoList, mqueue]);

  return <SantiMqueueContext.Provider value={mqueue}>{children}</SantiMqueueContext.Provider>;
}

export function useSantiMqueue(): SantiMqueue {
  const mqueue = useContext(SantiMqueueContext);
  if (!mqueue) {
    throw new Error("useSantiMqueue must be used inside SantiMqueueProvider");
  }
  return mqueue;
}

export function useSessionProjection(): SessionProjection {
  const mqueue = useSantiMqueue();
  const store = useMemo(() => createSessionStore(mqueue), [mqueue]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useSessions(): SessionSummary[] {
  return useSessionProjection().sessions;
}

export function useSelectedSessionId(): string | null {
  return useSessionProjection().selectedSessionId;
}

export function useSessionMessages(sessionId?: string | null): SessionMessage[] {
  const projection = useSessionProjection();
  const resolvedSessionId = sessionId ?? projection.selectedSessionId;
  if (!resolvedSessionId) {
    return [];
  }
  return projection.messagesBySessionId[resolvedSessionId] ?? [];
}

export function useSessionTurnTimeline(sessionId?: string | null): TurnGroup[] {
  const mqueue = useSantiMqueue();
  const selectedSessionId = useSelectedSessionId();
  const store = useMemo(() => createMessageStore(mqueue, isProjectionEvent), [mqueue]);
  const resolvedSessionId = sessionId ?? selectedSessionId;
  const projection = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  if (!resolvedSessionId) {
    return [];
  }
  return projection.turnTimelineBySessionId[resolvedSessionId] ?? [];
}

/**
 * First user-authored line of each loaded session, keyed by session id.
 * Only sessions whose messages have been fetched appear; callers fall
 * back to their own label (title or id) for the rest.
 */
export function useSessionPreviews(): Record<string, string> {
  const projection = useSessionProjection();
  return useMemo(() => {
    const previews: Record<string, string> = {};
    for (const [sessionId, messages] of Object.entries(projection.messagesBySessionId)) {
      const first = messages.find(
        (message) => message.message.actor_type === "account" && message.content_text.trim(),
      );
      if (first) {
        previews[sessionId] = first.content_text.trim();
      }
    }
    return previews;
  }, [projection]);
}

export function useSessionRuntime(sessionId?: string | null): SessionRuntimeSnapshot | null {
  const projection = useSessionProjection();
  const resolvedSessionId = sessionId ?? projection.selectedSessionId;
  if (!resolvedSessionId) {
    return null;
  }
  return projection.runtimeBySessionId[resolvedSessionId] ?? null;
}

export function useSessionMaterial(
  sessionId: string | null | undefined,
  kind: MaterialKind,
): SessionMaterial | null {
  const projection = useSessionProjection();
  if (!sessionId) {
    return null;
  }
  return projection.materialsBySessionId[sessionId]?.[kind] ?? null;
}

export function useSessionPending(): number {
  return useSessionProjection().pending;
}

export function useSessionError(): MqueueError | null {
  return useSessionProjection().error;
}

export function useDebouncedValue<T>(
  value: T,
  options: {
    debounceMs: number;
    equality?: (left: T, right: T) => boolean;
  },
): T {
  const { debounceMs, equality = defaultEquality } = options;
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (equality(value, debouncedValue)) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedValue((current) => (equality(value, current) ? current : value));
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [debouncedValue, debounceMs, equality, value]);

  return debouncedValue;
}

export function useMessageConnection(sessionId?: string | null): MessageConnectionState {
  const mqueue = useSantiMqueue();
  const selectedSessionId = useSelectedSessionId();
  const store = useMemo(() => createMessageStore(mqueue, isConnectionEvent), [mqueue]);
  const resolvedSessionId = sessionId ?? selectedSessionId;
  const projection = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  if (!resolvedSessionId) {
    return "closed";
  }
  return projection.connectionBySessionId[resolvedSessionId] ?? "closed";
}

function createSessionStore(mqueue: SantiMqueue) {
  let snapshot = mqueue.session.snapshot();
  return {
    getSnapshot: () => snapshot,
    subscribe: (onStoreChange: () => void) =>
      mqueue.session.sub(() => {
        snapshot = mqueue.session.snapshot();
        onStoreChange();
      }),
  };
}

function createMessageStore(mqueue: SantiMqueue, shouldUpdate: (event: MessageEvent) => boolean) {
  let snapshot: MessageProjection = mqueue.message.snapshot();
  return {
    getSnapshot: () => snapshot,
    subscribe: (onStoreChange: () => void) =>
      mqueue.message.sub((event) => {
        if (!shouldUpdate(event)) {
          return;
        }
        snapshot = mqueue.message.snapshot();
        onStoreChange();
      }),
  };
}

function isProjectionEvent(event: MessageEvent) {
  return event.phase === "projection";
}

function isConnectionEvent(event: MessageEvent) {
  return (
    event.phase === "connecting" ||
    event.phase === "open" ||
    event.phase === "closed" ||
    event.phase === "error"
  );
}

export function useSessionActions(): SessionActions {
  const mqueue = useSantiMqueue();
  return useMemo(
    () => ({
      create: () => mqueue.session.pub("create"),
      get: (sessionId: string) => mqueue.session.pub("get", { sessionId }),
      list: () => mqueue.session.pub("list"),
      refreshMaterial: (sessionId: string, kind: MaterialKind) =>
        mqueue.session.pub("material", { sessionId, kind }),
      refreshRuntime: (sessionId: string) => mqueue.session.pub("runtime", { sessionId }),
      select: (sessionId: string | null) => mqueue.session.pub("select", { sessionId }),
      selectAndGet: (sessionId: string) => [
        mqueue.session.pub("select", { sessionId }),
        mqueue.session.pub("get", { sessionId }),
        mqueue.session.pub("runtime", { sessionId }),
      ],
      send: (input: { sessionId?: string | null; content: MessagePart[] }) =>
        mqueue.session.pub("send", input),
      updateTitle: (sessionId: string, title: string | null) =>
        mqueue.session.pub("update", { sessionId, title }),
    }),
    [mqueue],
  );
}

function installBrowserMqueue(target?: Window & SantiWindow): SantiMqueue {
  const resolvedTarget =
    target ?? (typeof window === "undefined" ? undefined : (window as Window & SantiWindow));
  if (!resolvedTarget) {
    throw new Error("SantiMqueueProvider requires a browser window or mqueue prop");
  }
  return installSantiMqueue(resolvedTarget);
}

function defaultEquality<T>(left: T, right: T) {
  return left === right;
}
