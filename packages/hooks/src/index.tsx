import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  installSantiMqueue,
  type MessageConnectionState,
  type MessagePart,
  type MqueueError,
  type PubAck,
  type SantiMqueue,
  type SantiWindow,
  type MessageProjection,
  type Session,
  type SessionMessage,
  type SessionProjection,
  type TimelineItem,
} from "@mini-stim/mqueue";

export type {
  MessageConnectionState,
  MessagePart,
  MqueueError,
  PubAck,
  SantiMqueue,
  Session,
  SessionMessage,
  SessionProjection,
  TimelineItem,
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
  select(sessionId: string | null): PubAck;
  selectAndGet(sessionId: string): PubAck[];
  send(input: { sessionId?: string | null; content: MessagePart[] }): PubAck;
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

  return (
    <SantiMqueueContext.Provider value={mqueue}>
      {children}
    </SantiMqueueContext.Provider>
  );
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
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

export function useSessions(): Session[] {
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

export function useSessionTimeline(sessionId?: string | null): TimelineItem[] {
  const mqueue = useSantiMqueue();
  const selectedSessionId = useSelectedSessionId();
  const store = useMemo(() => createMessageStore(mqueue), [mqueue]);
  const resolvedSessionId = sessionId ?? selectedSessionId;
  const projection = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  if (!resolvedSessionId) {
    return [];
  }
  return projection.timelineBySessionId[resolvedSessionId] ?? [];
}

export function useSessionPending(): number {
  return useSessionProjection().pending;
}

export function useSessionError(): MqueueError | null {
  return useSessionProjection().error;
}

export function useMessageConnection(sessionId?: string | null): MessageConnectionState {
  const mqueue = useSantiMqueue();
  const selectedSessionId = useSelectedSessionId();
  const store = useMemo(() => createMessageStore(mqueue), [mqueue]);
  const resolvedSessionId = sessionId ?? selectedSessionId;
  const projection = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
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

function createMessageStore(mqueue: SantiMqueue) {
  let snapshot: MessageProjection = mqueue.message.snapshot();
  return {
    getSnapshot: () => snapshot,
    subscribe: (onStoreChange: () => void) =>
      mqueue.message.sub(() => {
        snapshot = mqueue.message.snapshot();
        onStoreChange();
      }),
  };
}

export function useSessionActions(): SessionActions {
  const mqueue = useSantiMqueue();
  return useMemo(
    () => ({
      create: () => mqueue.session.pub("create"),
      get: (sessionId: string) => mqueue.session.pub("get", { sessionId }),
      list: () => mqueue.session.pub("list"),
      select: (sessionId: string | null) =>
        mqueue.session.pub("select", { sessionId }),
      selectAndGet: (sessionId: string) => [
        mqueue.session.pub("select", { sessionId }),
        mqueue.session.pub("get", { sessionId }),
        mqueue.session.pub("runtime", { sessionId }),
      ],
      send: (input: { sessionId?: string | null; content: MessagePart[] }) =>
        mqueue.session.pub("send", input),
    }),
    [mqueue],
  );
}

function installBrowserMqueue(target?: Window & SantiWindow): SantiMqueue {
  const resolvedTarget =
    target ??
    (typeof window === "undefined" ? undefined : (window as Window & SantiWindow));
  if (!resolvedTarget) {
    throw new Error("SantiMqueueProvider requires a browser window or mqueue prop");
  }
  return installSantiMqueue(resolvedTarget);
}
