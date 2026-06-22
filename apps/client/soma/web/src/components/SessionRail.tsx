import {
  Badge,
  Button,
  Inline,
  Pane,
  Panel,
  PlusIcon,
  Stack,
  Text,
  Timestamp,
  useAppComponentRef,
} from "@mini-stim/components";
import type { SessionSummary } from "@mini-stim/hooks";
import { useState } from "react";

import { STIM_APP_NAMESPACE } from "../appNamespace";
import type { NavigationMode } from "../navigationMode";

export function SessionRail(props: {
  onCreate: () => void;
  onSelect: (sessionId: string) => void;
  previews: Record<string, string>;
  mode: NavigationMode;
  selectedSessionId: string | null;
  sessions: SessionSummary[];
  soulIdentity: {
    name: string;
  };
}) {
  const [selectingSoul, setSelectingSoul] = useState(false);
  const railRef = useAppComponentRef({
    domain: "session",
    id: "session-rail",
    kind: "panel",
    label: "Session Rail",
    namespace: STIM_APP_NAMESPACE,
    projection: "rail",
    surface: "workspace",
  });
  const soulSwitcherRef = useAppComponentRef({
    domain: "soul",
    id: "soul-switcher",
    kind: "control",
    label: "Soul Selector",
    namespace: STIM_APP_NAMESPACE,
    projection: "selector",
    surface: "session rail",
  });
  const newSoulRef = useAppComponentRef({
    domain: "soul",
    id: "new-soul",
    kind: "control",
    label: "New Soul",
    namespace: STIM_APP_NAMESPACE,
    projection: "create action",
    surface: "session rail",
  });
  const soulSelectRef = useAppComponentRef({
    domain: "soul",
    id: "soul-select",
    kind: "control",
    label: "Soul Select",
    namespace: STIM_APP_NAMESPACE,
    projection: "rail item",
    surface: "session rail",
  });
  const newSessionRef = useAppComponentRef({
    domain: "session",
    id: "new-session",
    kind: "control",
    label: "New Session",
    namespace: STIM_APP_NAMESPACE,
    projection: "create action",
    surface: "session rail",
  });
  const soulName = props.soulIdentity.name.trim() || "Santi";

  return (
    <Panel.Root ref={railRef}>
      <Panel.Header>
        <Button
          ref={soulSwitcherRef}
          block
          justify="start"
          size="sm"
          title={soulName}
          variant={selectingSoul ? "selected" : "ghost"}
          aria-pressed={selectingSoul}
          onClick={() => setSelectingSoul((current) => !current)}
        >
          <Text size="lg" tone="strong" truncate>
            {soulName}
          </Text>
        </Button>
      </Panel.Header>
      <Panel.Body scroll>
        {props.mode === "sessions" ? (
          <Stack gap="sm">
            <Inline justify="between" align="center">
              <Inline gap="sm" align="center">
                <Text size="xs" tone="subtle">
                  Sessions
                </Text>
                <Badge size="sm">{props.sessions.length}</Badge>
              </Inline>
              <Button ref={newSessionRef} size="sm" tone="accent" onClick={props.onCreate}>
                <PlusIcon size="sm" />
                New session
              </Button>
            </Inline>
            {props.sessions.map((session) => {
              const id = session.session.id;
              const selected = id === props.selectedSessionId;
              const label = sessionLabel(session, props.previews[id]);
              return (
                <Button
                  key={id}
                  block
                  justify="start"
                  size="lg"
                  title={label}
                  variant={selected ? "rail-selected" : "rail"}
                  onClick={() => props.onSelect(id)}
                >
                  <Stack tag="span" gap="xs" grow align="start">
                    <Text tone={selected ? "strong" : "default"} truncate>
                      {label}
                    </Text>
                    <Inline tag="span" justify="between" align="center" grow gap="sm">
                      <Timestamp
                        value={session.session.updated_at}
                        size="xs"
                        tone="subtle"
                        truncate
                      />
                      {selected ? (
                        <Badge size="sm" tone="accent">
                          active
                        </Badge>
                      ) : null}
                    </Inline>
                  </Stack>
                </Button>
              );
            })}
            {!props.sessions.length ? (
              <Pane border="around" padding="md" tone="panel">
                <Text tone="muted">No sessions yet. Start a new conversation.</Text>
              </Pane>
            ) : null}
          </Stack>
        ) : (
          <Stack gap="sm">
            <Inline justify="between" align="center">
              <Inline gap="sm" align="center">
                <Text size="xs" tone="subtle">
                  Souls
                </Text>
                <Badge size="sm">1</Badge>
              </Inline>
              <Button ref={newSoulRef} size="sm" tone="accent" disabled>
                <PlusIcon size="sm" />
                New soul
              </Button>
            </Inline>
            <Button
              ref={soulSelectRef}
              block
              justify="start"
              size="lg"
              title={soulName}
              variant="rail-selected"
              onClick={() => {
                setSelectingSoul(true);
              }}
            >
              <Stack tag="span" gap="xs" grow align="start">
                <Text tone="strong" truncate>
                  {soulName}
                </Text>
                <Inline tag="span" justify="between" align="center" grow gap="sm">
                  <Text size="xs" tone="subtle" truncate>
                    Current soul
                  </Text>
                  <Badge size="sm" tone="accent">
                    active
                  </Badge>
                </Inline>
              </Stack>
            </Button>
          </Stack>
        )}
      </Panel.Body>
    </Panel.Root>
  );
}

function sessionLabel(session: SessionSummary, preview?: string) {
  return session.profile.title?.trim() || preview || "Untitled chat";
}
