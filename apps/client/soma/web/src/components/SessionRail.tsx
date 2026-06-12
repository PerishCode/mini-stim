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
  Timestamp,
} from "@mini-stim/components";
import type { SessionSummary } from "@mini-stim/hooks";

export function SessionRail(props: {
  busy: boolean;
  onCreate: () => void;
  onSelect: (sessionId: string) => void;
  previews: Record<string, string>;
  selectedSessionId: string | null;
  sessions: SessionSummary[];
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
                      <Timestamp value={session.session.updated_at} size="xs" tone="subtle" truncate />
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

function sessionLabel(
  session: SessionSummary,
  preview?: string,
) {
  return session.profile.title?.trim() || preview || session.session.id;
}
