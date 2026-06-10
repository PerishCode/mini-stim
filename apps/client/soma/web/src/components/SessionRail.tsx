import {
  Badge,
  Button,
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
    <Pane border="right" padding="md" tone="panel" grow>
      <Stack gap="md" grow>
        <Inline justify="between">
          <Heading as="h1" size="md">mini-stim</Heading>
          <Button
            size="sm"
            variant="outline"
            disabled={props.busy}
            onClick={props.onCreate}
          >
            New
          </Button>
        </Inline>
        <ScrollArea grow>
          <Stack gap="sm">
            {props.sessions.map((session) => {
              const selected = session.id === props.selectedSessionId;
              return (
                <Button
                  key={session.id}
                  block
                  justify="start"
                  variant={selected ? "selected" : "ghost"}
                  onClick={() => props.onSelect(session.id)}
                >
                  <Stack as="span" gap="xs" grow align="start">
                    <Text truncate>{sessionLabel(session)}</Text>
                    <Inline as="span" justify="between" grow wrap gap="sm">
                      <Text size="sm" tone="muted" truncate>
                        {session.updated_at}
                      </Text>
                      {selected ? <Badge>current</Badge> : null}
                    </Inline>
                  </Stack>
                </Button>
              );
            })}
          </Stack>
        </ScrollArea>
      </Stack>
    </Pane>
  );
}

function sessionLabel(session: { id: string; title?: string | null }) {
  return session.title?.trim() || session.id;
}
