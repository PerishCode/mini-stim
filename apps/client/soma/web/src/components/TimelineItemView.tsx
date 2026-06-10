import {
  CodeBlock,
  Inline,
  Stack,
  Surface,
  Text,
} from "@mini-stim/components";
import type { TimelineItem } from "@mini-stim/hooks";

export function TimelineItemView(props: {
  item: TimelineItem;
}) {
  const { item } = props;

  if (item.kind === "message") {
    const role = item.message.message.actor_type;
    return (
      <Surface
        align={roleAlign(role)}
        tone={roleTone(role)}
        width="content"
      >
        <Text>{item.message.content_text}</Text>
      </Surface>
    );
  }

  if (item.kind === "tool_call") {
    const result = item.toolResult;
    const failed = Boolean(result?.error_text);
    return (
      <Surface tone={failed ? "danger" : "success"} width="full">
        <Stack gap="sm">
          <Inline justify="between" wrap gap="sm">
            <Text>{item.toolCall.tool_name}</Text>
            <Text size="sm" tone="muted">
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
    <Surface tone={failed ? "danger" : "success"} width="full">
      <Stack gap="sm">
        <Inline justify="between" wrap gap="sm">
          <Text>tool result</Text>
          <Text size="sm" tone="muted">
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
