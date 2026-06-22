export type InspectTarget =
  | { kind: "session"; sessionId: string }
  | { kind: "turn"; sessionId: string; turnId: string }
  | { kind: "message"; sessionId: string; messageId: string }
  | { kind: "tool_call"; sessionId: string; toolCallId: string }
  | { kind: "tool_result"; sessionId: string; toolResultId: string };

export interface InspectTargetSelectedEvent {
  type: "inspect:target:selected";
  target: InspectTarget;
}

export interface InspectPanelOpenedEvent {
  type: "inspect:panel:opened";
}

export interface InspectPanelClosedEvent {
  type: "inspect:panel:closed";
}

export interface InspectPanelToggledEvent {
  type: "inspect:panel:toggled";
}

export type InspectEvent =
  | InspectPanelClosedEvent
  | InspectPanelOpenedEvent
  | InspectPanelToggledEvent
  | InspectTargetSelectedEvent;

const INSPECT_EVENT = "mini-stim:inspect";

type InspectListener = (event: InspectTargetSelectedEvent) => void;
type InspectEventListener = (event: InspectEvent) => void;

export function selectInspectTarget(target: InspectTarget) {
  dispatchInspectEvent({
    type: "inspect:target:selected",
    target,
  });
}

export function openInspectPanel() {
  dispatchInspectEvent({
    type: "inspect:panel:opened",
  });
}

export function closeInspectPanel() {
  dispatchInspectEvent({
    type: "inspect:panel:closed",
  });
}

export function toggleInspectPanel() {
  dispatchInspectEvent({
    type: "inspect:panel:toggled",
  });
}

export function subscribeInspect(listener: InspectEventListener) {
  function handleEvent(event: Event) {
    const detail = (event as CustomEvent<InspectEvent>).detail;
    if (isInspectEvent(detail)) {
      listener(detail);
    }
  }

  window.addEventListener(INSPECT_EVENT, handleEvent);
  return () => window.removeEventListener(INSPECT_EVENT, handleEvent);
}

export function subscribeInspectTarget(listener: InspectListener) {
  function handleEvent(event: Event) {
    const detail = (event as CustomEvent<InspectEvent>).detail;
    if (detail?.type === "inspect:target:selected") {
      listener(detail);
    }
  }

  window.addEventListener(INSPECT_EVENT, handleEvent);
  return () => window.removeEventListener(INSPECT_EVENT, handleEvent);
}

function dispatchInspectEvent(event: InspectEvent) {
  window.dispatchEvent(new CustomEvent(INSPECT_EVENT, { detail: event }));
}

function isInspectEvent(value: unknown): value is InspectEvent {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }

  const event = value as Partial<InspectEvent>;
  return (
    event.type === "inspect:panel:closed" ||
    event.type === "inspect:panel:opened" ||
    event.type === "inspect:panel:toggled" ||
    (event.type === "inspect:target:selected" && isInspectTarget(event.target))
  );
}

function isInspectTarget(value: unknown): value is InspectTarget {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    return false;
  }

  const target = value as Record<string, unknown>;
  switch (target.kind) {
    case "session":
      return typeof target.sessionId === "string";
    case "turn":
      return typeof target.sessionId === "string" && typeof target.turnId === "string";
    case "message":
      return typeof target.sessionId === "string" && typeof target.messageId === "string";
    case "tool_call":
      return typeof target.sessionId === "string" && typeof target.toolCallId === "string";
    case "tool_result":
      return typeof target.sessionId === "string" && typeof target.toolResultId === "string";
    case undefined:
      return false;
    default:
      return false;
  }
}
