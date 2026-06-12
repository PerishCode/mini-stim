import {
  Badge,
  CodeBlock,
  Inline,
  Pane,
  ScrollArea,
  Stack,
  Text,
  Timestamp,
} from "@mini-stim/components";
import type { SessionRuntimeSnapshot } from "@mini-stim/hooks";

export function InspectPanel(props: {
  runtime: SessionRuntimeSnapshot | null;
}) {
  const { runtime } = props;
  if (!runtime) {
    return (
      <Pane padding="lg">
        <Text tone="muted">No runtime snapshot loaded for this session yet.</Text>
      </Pane>
    );
  }

  const memory = runtime.soul_session?.session_memory.trim() ?? "";

  return (
    <ScrollArea grow>
      <Pane padding="lg">
        <Stack gap="lg">
          <Stack gap="sm">
            <Inline justify="between" align="center" gap="sm">
              <Text size="xs" tone="subtle">SESSION MEMORY</Text>
              {runtime.soul_session ? (
                <Text size="xs" tone="subtle">
                  seen through seq {runtime.soul_session.last_seen_session_seq}
                </Text>
              ) : null}
            </Inline>
            {memory ? (
              <CodeBlock>{memory}</CodeBlock>
            ) : (
              <Text size="sm" tone="muted">
                The agent has not written any session memory yet.
              </Text>
            )}
          </Stack>

          <Stack gap="sm">
            <Text size="xs" tone="subtle">COMPACTS</Text>
            {runtime.compacts.length ? (
              runtime.compacts.map((compact) => (
                <Pane key={compact.id} border="around" padding="md" tone="panel">
                  <Stack gap="xs">
                    <Inline justify="between" align="center" wrap gap="sm">
                      <Text size="xs" tone="subtle">
                        replaces seq {compact.start_session_seq}–{compact.end_session_seq}
                      </Text>
                      <Timestamp value={compact.created_at} size="xs" tone="subtle" />
                    </Inline>
                    <Text size="sm">{compact.summary}</Text>
                  </Stack>
                </Pane>
              ))
            ) : (
              <Text size="sm" tone="muted">
                No context compaction has happened in this session.
              </Text>
            )}
          </Stack>

          <Stack gap="sm">
            <Text size="xs" tone="subtle">EFFECTS</Text>
            {runtime.effects.length ? (
              runtime.effects.map((effect) => (
                <Inline key={effect.id} justify="between" align="center" wrap gap="sm">
                  <Text size="sm">{effect.effect_type}</Text>
                  <Badge size="sm" tone={effect.error_text ? "danger" : "neutral"}>
                    {effect.status}
                  </Badge>
                </Inline>
              ))
            ) : (
              <Text size="sm" tone="muted">
                No hook effects recorded in this session.
              </Text>
            )}
          </Stack>
        </Stack>
      </Pane>
    </ScrollArea>
  );
}
