import {
  CodeBlock,
  Inline,
  Stack,
  Surface,
  Text,
  Timestamp,
} from "@mini-stim/components";
import type { TimelineItem } from "@mini-stim/hooks";

export function TimelineItemView(props: {
  item: TimelineItem;
}) {
  const { item } = props;

  if (item.kind === "message") {
    const role = item.message.message.actor_type;
    const pending = item.message.message.state === "pending";
    return (
      <Surface
        align={roleAlign(role)}
        tone={roleTone(role)}
        padding="lg"
        width="content"
      >
        <Stack gap="sm">
          <Inline justify="between" align="center" wrap gap="sm">
            <Text size="xs" tone="subtle">
              {roleLabel(role)}
            </Text>
            {pending ? (
              <Text size="xs" tone="subtle">generating…</Text>
            ) : (
              <Timestamp value={item.createdAt} size="xs" tone="subtle" />
            )}
          </Inline>
          <Text>{item.message.content_text}</Text>
        </Stack>
      </Surface>
    );
  }

  if (item.kind === "tool_call") {
    const result = item.toolResult;
    const failed = Boolean(result?.error_text);
    return (
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
    );
  }

  const failed = Boolean(item.toolResult.error_text);
  return (
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
  );
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

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function roleLabel(role: string) {
  if (role === "account") {
    return "YOU";
  }
  if (role === "system") {
    return "SYSTEM";
  }
  return "ASSISTANT";
}
