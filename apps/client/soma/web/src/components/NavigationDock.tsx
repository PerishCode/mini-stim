import {
  IconButton,
  SessionsIcon,
  SoulsIcon,
  Stack,
  useAppComponentRef,
} from "@mini-stim/components";

import { STIM_APP_NAMESPACE } from "../appNamespace";
import type { NavigationMode } from "../navigationMode";

export function NavigationDock(props: {
  mode: NavigationMode;
  onModeChange: (mode: NavigationMode) => void;
}) {
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
        tone={props.mode === "sessions" ? "accent" : "neutral"}
        aria-pressed={props.mode === "sessions"}
        onClick={() => props.onModeChange("sessions")}
      >
        <SessionsIcon size="sm" />
      </IconButton>
      <IconButton
        ref={soulsRef}
        label="Souls"
        size="sm"
        tone={props.mode === "souls" ? "accent" : "neutral"}
        aria-pressed={props.mode === "souls"}
        onClick={() => props.onModeChange("souls")}
      >
        <SoulsIcon size="sm" />
      </IconButton>
    </Stack>
  );
}
