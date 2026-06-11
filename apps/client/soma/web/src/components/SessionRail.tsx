import {
  Badge,
  Button,
  GridRows,
  Heading,
  Inline,
  Pane,
  ScrollArea,
  Stack,
  Text,
} from "@mini-stim/components";
import type { Session } from "@mini-stim/hooks";

export function SessionRail(props: {
  busy: boolean;
  onCreate: () => void;
  onSelect: (sessionId: string) => void;
  selectedSessionId: string | null;
  sessions: Session[];
}) {
  return (
    <Pane border="right" padding="lg" tone="raised" grow>
      <GridRows grow template="header-body" gap="md">
        <Stack gap="sm">
          <Inline justify="between" align="start" gap="md">
            <Stack gap="xs">
              <Text size="xs" tone="subtle">WORKSPACE</Text>
              <Heading tag="h1" size="lg">mini-stim</Heading>
            </Stack>
          <Button
            size="sm"
            variant="outline"
            disabled={props.busy}
            onClick={props.onCreate}
          >
            New
          </Button>
          </Inline>
          <Inline justify="between" align="center">
            <Text size="xs" tone="subtle">CONVERSATIONS</Text>
            <Badge size="sm">{props.sessions.length}</Badge>
          </Inline>
        </Stack>
        <ScrollArea grow>
          <Stack gap="xs">
            {props.sessions.map((session) => {
              const selected = session.id === props.selectedSessionId;
              return (
                <Button
                  key={session.id}
                  block
                  justify="start"
                  size="lg"
                  variant={selected ? "rail-selected" : "rail"}
                  onClick={() => props.onSelect(session.id)}
                >
                  <Stack tag="span" gap="xs" grow align="start">
                    <Text tone={selected ? "strong" : "default"} truncate>
                      {sessionLabel(session)}
                    </Text>
                    <Inline tag="span" justify="between" grow wrap gap="sm">
                      <Text size="xs" tone="subtle" truncate>
                        {formatSessionStamp(session.updated_at)}
                      </Text>
                      {selected ? <Badge size="sm" tone="accent">current</Badge> : null}
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
