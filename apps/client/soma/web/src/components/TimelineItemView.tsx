import {
  Badge,
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
  showIdentity: boolean;
  soulIdentity: SoulIdentity;
}) {
  const { item, showIdentity, soulIdentity } = props;
  const target = targetForItem(item);

  if (item.kind === "message") {
    const role = item.message.message.actor_type;
    const pending = item.message.message.state === "pending";
    const identity = identityForMessage(role, item.message.message.actor_id, soulIdentity);
    const showHeader = showIdentity || pending;
    return (
      <Pressable onClick={() => selectInspectTarget(target)}>
        <Surface
          align={roleAlign(role)}
          tone={roleTone(role)}
          padding="lg"
          width="content"
        >
          <Stack gap="sm">
            {showHeader ? (
              <Inline justify="between" align="center" wrap gap="sm">
                {showIdentity ? (
                  <IdentityLine
                    avatarSeed={identity.avatarSeed}
                    marker={identity.marker}
                    name={identity.name}
                    size="sm"
                  />
                ) : null}
                {pending ? (
                  <Text size="xs" tone="subtle">generating…</Text>
                ) : (
                  <Timestamp value={item.createdAt} size="xs" tone="subtle" />
                )}
              </Inline>
            ) : null}
            <Text>{item.message.content_text}</Text>
          </Stack>
        </Surface>
      </Pressable>
    );
  }

  if (item.kind === "tool_call") {
    const result = item.toolResult;
    const failed = Boolean(result?.error_text);
    const status = result ? (failed ? "failed" : "completed") : "running";
    return (
      <Pressable onClick={() => selectInspectTarget(target)}>
        <Surface tone={failed ? "danger" : "inset"} padding="sm" width="content">
          <Stack gap="xs">
            <Inline align="center" gap="sm" wrap>
              <Text size="xs" tone="subtle">Used</Text>
              <Text size="sm" tone="strong">{item.toolCall.tool_name}</Text>
              <Text size="xs" tone="subtle">{status}</Text>
            </Inline>
            <Timestamp value={item.createdAt} size="xs" tone="subtle" />
          </Stack>
        </Surface>
      </Pressable>
    );
  }

  const failed = Boolean(item.toolResult.error_text);
  return (
    <Pressable onClick={() => selectInspectTarget(target)}>
      <Surface tone={failed ? "danger" : "inset"} padding="sm" width="content">
        <Stack gap="xs">
          <Inline align="center" gap="sm" wrap>
            <Text size="xs" tone="subtle">Tool result</Text>
            <Text size="sm" tone="strong">
              {item.toolCall?.tool_name ?? "unknown tool"}
            </Text>
            <Text size="xs" tone="subtle">
              {failed ? "failed" : "completed"}
            </Text>
          </Inline>
          <Timestamp value={item.createdAt} size="xs" tone="subtle" />
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
    marker: <Badge size="sm" tone="accent">verified</Badge>,
    name: soulIdentity.name,
  };
}
