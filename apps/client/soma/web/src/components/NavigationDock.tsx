import {
  IconButton,
  SessionsIcon,
  SoulsIcon,
  Stack,
  useAppComponentRef,
} from "@mini-stim/components";

import { STIM_APP_NAMESPACE } from "../appNamespace";
import { selectNavigationMode } from "../events/navigation";
import type { NavigationMode } from "../navigationMode";

export function NavigationDock(props: { mode: NavigationMode; open: boolean }) {
  const dockRef = useAppComponentRef({
    domain: "navigation",
    id: "navigation-dock",
    kind: "panel",
    label: "Navigation Dock",
    namespace: STIM_APP_NAMESPACE,
    projection: "dock",
    surface: "app shell",
  });
  const sessionsRef = useAppComponentRef({
    domain: "navigation",
    id: "sessions-dock-item",
    kind: "control",
    label: "Sessions Dock Item",
    namespace: STIM_APP_NAMESPACE,
    projection: "dock item",
    role: "sessions",
    surface: "navigation dock",
  });
  const soulsRef = useAppComponentRef({
    domain: "navigation",
    id: "souls-dock-item",
    kind: "control",
    label: "Souls Dock Item",
    namespace: STIM_APP_NAMESPACE,
    projection: "dock item",
    role: "souls",
    surface: "navigation dock",
  });

  return (
    <Stack ref={dockRef} grow gap="sm" align="center">
      <IconButton
        ref={sessionsRef}
        label="Sessions"
        size="sm"
        tone={props.open && props.mode === "sessions" ? "accent" : "neutral"}
        aria-pressed={pressedState(props, "sessions")}
        onClick={() => selectNavigationMode("sessions")}
      >
        <SessionsIcon size="sm" />
      </IconButton>
      <IconButton
        ref={soulsRef}
        label="Souls"
        size="sm"
        tone={props.open && props.mode === "souls" ? "accent" : "neutral"}
        aria-pressed={pressedState(props, "souls")}
        onClick={() => selectNavigationMode("souls")}
      >
        <SoulsIcon size="sm" />
      </IconButton>
    </Stack>
  );
}

function pressedState(navigation: { mode: NavigationMode; open: boolean }, mode: NavigationMode) {
  if (navigation.mode !== mode) {
    return false;
  }

  return navigation.open ? true : "mixed";
}
