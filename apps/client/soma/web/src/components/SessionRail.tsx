import {
  Badge,
  Button,
  GridRows,
  Heading,
  Inline,
  Pane,
  PlusIcon,
  ScrollArea,
  Stack,
  Text,
} from "@mini-stim/components";
import type { Session } from "@mini-stim/hooks";

import { parseCoreStamp } from "./coreStamp";

export function SessionRail(props: {
  busy: boolean;
  onCreate: () => void;
  onSelect: (sessionId: string) => void;
  selectedSessionId: string | null;
  sessions: Session[];
}) {
  return (
    <Pane chrome="panel" padding="lg" tone="raised" grow>
      <GridRows grow template="header-body" gap="md">
        <Stack gap="sm">
          <Inline justify="between" align="start" gap="md">
            <Stack gap="xs">
              <Heading tag="h1" size="lg" truncate>mini-stim</Heading>
              <Text size="xs" tone="subtle">Local-first AI chat</Text>
            </Stack>
          <Button
            size="sm"
            variant="outline"
            disabled={props.busy}
            onClick={props.onCreate}
          >
            <PlusIcon size="sm" />
            New
          </Button>
          </Inline>
          <Inline justify="between" align="center">
            <Text size="xs" tone="subtle">Conversations</Text>
            <Badge size="sm">{props.sessions.length}</Badge>
          </Inline>
        </Stack>
        <ScrollArea grow>
          <Stack gap="xs">
            {props.sessions.map((session) => {
              const selected = session.id === props.selectedSessionId;
              const label = sessionLabel(session);
              return (
                <Button
                  key={session.id}
                  block
                  justify="start"
                  size="lg"
                  title={label}
                  variant={selected ? "rail-selected" : "rail"}
                  onClick={() => props.onSelect(session.id)}
                >
                  <Stack tag="span" gap="xs" grow align="start">
                    <Text tone={selected ? "strong" : "default"} truncate>
                      {label}
                    </Text>
                    <Inline tag="span" justify="between" align="center" grow gap="sm">
                      <Text size="xs" tone="subtle" truncate>
                        {formatSessionStamp(session.updated_at)}
                      </Text>
                      {selected ? <Badge size="sm" tone="accent">active</Badge> : null}
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
        </ScrollArea>
      </GridRows>
    </Pane>
  );
}

function sessionLabel(session: { id: string; title?: string | null }) {
  return session.title?.trim() || session.id;
}

function formatSessionStamp(value: string) {
  const date = parseCoreStamp(value);
  if (!date) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
