import {
  Badge,
  CodeBlock,
  IdentityLine,
  Inline,
  Pressable,
  Stack,
  Surface,
  Text,
  Timestamp,
} from "@mini-stim/components";
import type { TimelineItem } from "@mini-stim/hooks";

import { selectInspectTarget } from "../events/inspect";
import type { SoulIdentity } from "./Transcript";

export function TimelineItemView(props: {
  item: TimelineItem;
  soulIdentity: SoulIdentity;
}) {
  const { item, soulIdentity } = props;
  const target = targetForItem(item);

  if (item.kind === "message") {
    const role = item.message.message.actor_type;
    const pending = item.message.message.state === "pending";
    const identity = identityForMessage(role, item.message.message.actor_id, soulIdentity);
    return (
      <Pressable onClick={() => selectInspectTarget(target)}>
        <Surface
          align={roleAlign(role)}
          tone={roleTone(role)}
          padding="lg"
          width="content"
        >
          <Stack gap="sm">
            <Inline justify="between" align="center" wrap gap="sm">
              <IdentityLine
                avatarSeed={identity.avatarSeed}
                marker={identity.marker}
                name={identity.name}
                size="sm"
              />
              {pending ? (
                <Text size="xs" tone="subtle">generating…</Text>
              ) : (
                <Timestamp value={item.createdAt} size="xs" tone="subtle" />
              )}
            </Inline>
            <Text>{item.message.content_text}</Text>
          </Stack>
        </Surface>
      </Pressable>
    );
  }

  if (item.kind === "tool_call") {
    const result = item.toolResult;
    const failed = Boolean(result?.error_text);
    return (
      <Pressable onClick={() => selectInspectTarget(target)}>
        <Surface tone={failed ? "danger" : "inset"} padding="lg" width="full">
          <Stack gap="sm">
            <Inline justify="between" wrap gap="sm">
              <Stack tag="span" gap="xs">
                <Text size="xs" tone="subtle">TOOL CALL</Text>
                <Text tone="strong">{item.toolCall.tool_name}</Text>
              </Stack>
              <Text size="xs" tone="subtle">
                {result ? (failed ? "failed" : "completed") : "running"}
              </Text>
            </Inline>
            <CodeBlock>{formatJson(item.toolCall.arguments)}</CodeBlock>
            {result ? (
              <CodeBlock>
                {result.error_text ?? formatJson(result.output)}
              </CodeBlock>
            ) : null}
          </Stack>
        </Surface>
      </Pressable>
    );
  }

  const failed = Boolean(item.toolResult.error_text);
  return (
    <Pressable onClick={() => selectInspectTarget(target)}>
      <Surface tone={failed ? "danger" : "inset"} padding="lg" width="full">
        <Stack gap="sm">
          <Inline justify="between" wrap gap="sm">
            <Stack tag="span" gap="xs">
              <Text size="xs" tone="subtle">TOOL RESULT</Text>
              <Text tone="strong">
                {item.toolCall?.tool_name ?? "tool result"}
              </Text>
            </Stack>
            <Text size="xs" tone="subtle">
              {failed ? "failed" : "completed"}
            </Text>
          </Inline>
          <CodeBlock>
            {item.toolResult.error_text ?? formatJson(item.toolResult.output)}
          </CodeBlock>
        </Stack>
      </Surface>
    </Pressable>
  );
}

function targetForItem(item: TimelineItem) {
  if (item.kind === "message") {
    return {
      kind: "message",
      sessionId: item.sessionId,
      messageId: item.message.message.id,
    } as const;
  }
  if (item.kind === "tool_call") {
    return {
      kind: "tool_call",
      sessionId: item.sessionId,
      toolCallId: item.toolCall.id,
    } as const;
  }
  return {
    kind: "tool_result",
    sessionId: item.sessionId,
    toolResultId: item.toolResult.id,
  } as const;
}

function roleTone(role: string) {
  if (role === "account") {
    return "accent";
  }
  if (role === "system") {
    return "warning";
  }
  return "muted";
}

function roleAlign(role: string) {
  if (role === "account") {
    return "end";
  }
  if (role === "system") {
    return "center";
  }
  return "start";
}

function identityForMessage(
  role: string,
  actorId: string,
  soulIdentity: SoulIdentity,
) {
  if (role === "account") {
    return {
      avatarSeed: `account:${actorId}`,
      name: "You",
    };
  }
  if (role === "system") {
    return {
      avatarSeed: "system",
      name: "System",
    };
  }
  return {
    avatarSeed: soulIdentity.avatarSeed,
    marker: <Badge size="sm" tone="accent">Santi</Badge>,
    name: soulIdentity.name,
  };
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
