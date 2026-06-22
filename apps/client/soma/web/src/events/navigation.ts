import type { NavigationMode } from "../navigationMode";

export interface NavigationModeSelectedEvent {
  mode: NavigationMode;
  type: "navigation:mode-selected";
}

export interface NavigationPanelToggledEvent {
  type: "navigation:panel-toggled";
}

export type NavigationEvent = NavigationModeSelectedEvent | NavigationPanelToggledEvent;

const NAVIGATION_EVENT = "mini-stim:navigation";

type NavigationListener = (event: NavigationEvent) => void;

export function selectNavigationMode(mode: NavigationMode) {
  dispatchNavigationEvent({
    mode,
    type: "navigation:mode-selected",
  });
}

export function toggleNavigationPanel() {
  dispatchNavigationEvent({
    type: "navigation:panel-toggled",
  });
}

export function subscribeNavigation(listener: NavigationListener) {
  function handleEvent(event: Event) {
    const detail = (event as CustomEvent<NavigationEvent>).detail;
    if (isNavigationEvent(detail)) {
      listener(detail);
    }
  }

  window.addEventListener(NAVIGATION_EVENT, handleEvent);
  return () => window.removeEventListener(NAVIGATION_EVENT, handleEvent);
}

function dispatchNavigationEvent(event: NavigationEvent) {
  window.dispatchEvent(new CustomEvent(NAVIGATION_EVENT, { detail: event }));
}

function isNavigationEvent(value: unknown): value is NavigationEvent {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }

  const event = value as Partial<NavigationEvent>;
  return (
    event.type === "navigation:panel-toggled" ||
    (event.type === "navigation:mode-selected" &&
      (event.mode === "sessions" || event.mode === "souls"))
  );
}
