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

const INSPECT_TARGET_SELECTED = "mini-stim:inspect-target-selected";

type InspectListener = (event: InspectTargetSelectedEvent) => void;

export function selectInspectTarget(target: InspectTarget) {
  dispatchInspectEvent({
    type: "inspect:target:selected",
    target,
  });
}

export function subscribeInspectTarget(listener: InspectListener) {
  function handleEvent(event: Event) {
    const detail = (event as CustomEvent<InspectTargetSelectedEvent>).detail;
    if (detail?.type === "inspect:target:selected") {
      listener(detail);
    }
  }

  window.addEventListener(INSPECT_TARGET_SELECTED, handleEvent);
  return () => window.removeEventListener(INSPECT_TARGET_SELECTED, handleEvent);
}

function dispatchInspectEvent(event: InspectTargetSelectedEvent) {
  window.dispatchEvent(new CustomEvent(INSPECT_TARGET_SELECTED, { detail: event }));
}
