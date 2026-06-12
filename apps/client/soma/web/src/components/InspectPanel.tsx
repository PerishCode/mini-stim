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

import type { InspectTarget } from "../events/inspect";

export function InspectPanel(props: {
  runtime: SessionRuntimeSnapshot | null;
  target: InspectTarget | null;
}) {
  const { runtime, target } = props;
  if (!runtime) {
    return (
      <Pane padding="lg">
        <Text tone="muted">No runtime snapshot loaded for this session yet.</Text>
      </Pane>
    );
  }

  const memory = runtime.soul_session?.session_memory.trim() ?? "";
  const selected = target ? selectRuntimeTarget(runtime, target) : null;

  return (
    <ScrollArea grow>
      <Pane padding="lg">
        <Stack gap="lg">
          {target ? <SelectedTarget target={target} selected={selected} /> : null}

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

function SelectedTarget(props: {
  target: InspectTarget;
  selected: RuntimeTargetSelection | null;
}) {
  const { selected, target } = props;
  return (
    <Stack gap="sm">
      <Inline justify="between" align="center" gap="sm">
        <Text size="xs" tone="subtle">SELECTED</Text>
        <Text size="xs" tone="subtle">{target.kind}</Text>
      </Inline>
      {selected ? (
        <SelectedTargetBody selected={selected} />
      ) : (
        <Text size="sm" tone="muted">
          The selected runtime object is not in the current snapshot.
        </Text>
      )}
    </Stack>
  );
}

function SelectedTargetBody(props: { selected: RuntimeTargetSelection }) {
  const { selected } = props;
  if (selected.kind === "session") {
    const { profile, session } = selected;
    return (
      <Pane border="around" padding="md" tone="panel">
        <Stack gap="xs">
          <Inline justify="between" align="center" wrap gap="sm">
            <Text size="sm" tone="strong">
              {profile.title?.trim() || session.id}
            </Text>
            <Timestamp value={session.created_at} size="xs" tone="subtle" />
          </Inline>
          {profile.desc ? <Text size="sm">{profile.desc}</Text> : null}
        </Stack>
      </Pane>
    );
  }
  if (selected.kind === "turn") {
    const turn = selected.turn;
    return (
      <Pane border="around" padding="md" tone="panel">
        <Stack gap="xs">
          <Inline justify="between" align="center" wrap gap="sm">
            <Badge size="sm" tone={turn.status === "failed" ? "danger" : "neutral"}>
              {turn.status}
            </Badge>
            <Timestamp value={turn.created_at} size="xs" tone="subtle" />
          </Inline>
          <Text size="sm">input through seq {turn.input_through_session_seq}</Text>
          {turn.error_text ? <CodeBlock>{turn.error_text}</CodeBlock> : null}
        </Stack>
      </Pane>
    );
  }
  if (selected.kind === "message") {
    const message = selected.message;
    return (
      <Pane border="around" padding="md" tone="panel">
        <Stack gap="xs">
          <Inline justify="between" align="center" wrap gap="sm">
            <Text size="xs" tone="subtle">
              {message.message.actor_type} seq {message.relation.session_seq}
            </Text>
            <Timestamp value={message.message.created_at} size="xs" tone="subtle" />
          </Inline>
          <CodeBlock>{message.content_text}</CodeBlock>
        </Stack>
      </Pane>
    );
  }
  if (selected.kind === "tool_call") {
    const toolCall = selected.toolCall;
    return (
      <Pane border="around" padding="md" tone="panel">
        <Stack gap="xs">
          <Inline justify="between" align="center" wrap gap="sm">
            <Text size="sm" tone="strong">{toolCall.tool_name}</Text>
            <Timestamp value={toolCall.created_at} size="xs" tone="subtle" />
          </Inline>
          <CodeBlock>{formatJson(toolCall.arguments)}</CodeBlock>
        </Stack>
      </Pane>
    );
  }

  const toolResult = selected.toolResult;
  return (
    <Pane border="around" padding="md" tone="panel">
      <Stack gap="xs">
        <Inline justify="between" align="center" wrap gap="sm">
          <Badge size="sm" tone={toolResult.error_text ? "danger" : "neutral"}>
            {toolResult.error_text ? "failed" : "completed"}
          </Badge>
          <Timestamp value={toolResult.created_at} size="xs" tone="subtle" />
        </Inline>
        <CodeBlock>{toolResult.error_text ?? formatJson(toolResult.output)}</CodeBlock>
      </Stack>
    </Pane>
  );
}

type RuntimeTargetSelection =
  | {
      kind: "session";
      profile: SessionRuntimeSnapshot["profile"];
      session: SessionRuntimeSnapshot["session"];
    }
  | { kind: "turn"; turn: SessionRuntimeSnapshot["turns"][number] }
  | { kind: "message"; message: SessionRuntimeSnapshot["messages"][number] }
  | { kind: "tool_call"; toolCall: SessionRuntimeSnapshot["tool_calls"][number] }
  | { kind: "tool_result"; toolResult: SessionRuntimeSnapshot["tool_results"][number] };

function selectRuntimeTarget(
  runtime: SessionRuntimeSnapshot,
  target: InspectTarget,
): RuntimeTargetSelection | null {
  if (target.kind === "session") {
    return {
      kind: "session",
      profile: runtime.profile,
      session: runtime.session,
    };
  }
  if (target.kind === "turn") {
    const turn = runtime.turns.find((item) => item.id === target.turnId);
    return turn ? { kind: "turn", turn } : null;
  }
  if (target.kind === "message") {
    const message = runtime.messages.find(
      (item) => item.message.id === target.messageId,
    );
    return message ? { kind: "message", message } : null;
  }
  if (target.kind === "tool_call") {
    const toolCall = runtime.tool_calls.find(
      (item) => item.id === target.toolCallId,
    );
    return toolCall ? { kind: "tool_call", toolCall } : null;
  }
  if (target.kind === "tool_result") {
    const toolResult = runtime.tool_results.find(
      (item) => item.id === target.toolResultId,
    );
    return toolResult ? { kind: "tool_result", toolResult } : null;
  }
  return null;
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}
