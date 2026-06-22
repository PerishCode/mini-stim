import { Inline, Stack, Surface, Text, Timestamp } from "@mini-stim/components";
import type { TimelineItem } from "@mini-stim/hooks";

import { ShellCommand } from "../atoms/ShellCommand";
import {
  createShellToolModel,
  getToolCallStatus,
  isShellTool,
  type ToolCallRecord,
  type ToolResultRecord,
  truncateMiddle,
} from "../model/toolCallModel";

type ToolCallItem = Extract<TimelineItem, { kind: "tool_call" }>;
type ToolResultItem = Extract<TimelineItem, { kind: "tool_result" }>;

const COMMAND_LIMIT = 92;
const OUTPUT_LIMIT = 120;

export function ToolCallWhisper(props: { item: ToolCallItem }) {
  return (
    <ToolWhisperBody
      createdAt={props.item.createdAt}
      toolCall={props.item.toolCall}
      toolResult={props.item.toolResult ?? null}
    />
  );
}

export function ToolResultWhisper(props: { item: ToolResultItem }) {
  return (
    <ToolWhisperBody
      createdAt={props.item.createdAt}
      toolCall={props.item.toolCall ?? null}
      toolResult={props.item.toolResult}
    />
  );
}

function ToolWhisperBody(props: {
  createdAt: string;
  toolCall: ToolCallRecord | null;
  toolResult: ToolResultRecord | null;
}) {
  const failed = Boolean(props.toolResult?.error_text);

  if (!props.toolCall) {
    return (
      <Surface tone={failed ? "danger" : "inset"} padding="sm" width="content">
        <Stack gap="xs">
          <Inline align="center" gap="sm" wrap>
            <Text size="xs" tone="subtle">
              Tool result
            </Text>
            <Text size="sm" tone="strong">
              unknown tool
            </Text>
            <Text size="xs" tone="subtle">
              {failed ? "failed" : "completed"}
            </Text>
          </Inline>
          <Timestamp value={props.createdAt} size="xs" tone="subtle" />
        </Stack>
      </Surface>
    );
  }

  const variant = isShellTool(props.toolCall.tool_name) ? "shell" : "unknown";

  switch (variant) {
    case "shell":
      return (
        <ShellToolWhisper
          createdAt={props.createdAt}
          toolCall={props.toolCall}
          toolResult={props.toolResult}
        />
      );
    case "unknown":
      return (
        <UnknownToolWhisper
          createdAt={props.createdAt}
          toolCall={props.toolCall}
          toolResult={props.toolResult}
        />
      );
  }
}

function ShellToolWhisper(props: {
  createdAt: string;
  toolCall: ToolCallRecord;
  toolResult: ToolResultRecord | null;
}) {
  const shell = createShellToolModel(props.toolCall, props.toolResult);
  const failed = shell.status === "failed";
  const output = props.toolResult?.error_text || shell.stderr || shell.stdout;
  const outputLabel = props.toolResult?.error_text || shell.stderr ? "stderr" : "stdout";

  return (
    <Surface tone={failed ? "danger" : "inset"} padding="sm" width="content">
      <Stack gap="xs">
        <Inline align="center" gap="sm" wrap>
          <Text size="xs" tone="subtle">
            shell
          </Text>
          <ShellCommand
            command={shell.command ?? props.toolCall.tool_name}
            maxChars={COMMAND_LIMIT}
            presentation="inline"
          />
          <Text size="xs" tone="subtle">
            {shell.status}
          </Text>
        </Inline>
        {output ? (
          <Text size="xs" tone="muted">
            {outputLabel}: {truncateMiddle(output, OUTPUT_LIMIT)}
          </Text>
        ) : null}
        <Timestamp value={props.createdAt} size="xs" tone="subtle" />
      </Stack>
    </Surface>
  );
}

function UnknownToolWhisper(props: {
  createdAt: string;
  toolCall: ToolCallRecord;
  toolResult: ToolResultRecord | null;
}) {
  const status = getToolCallStatus(props.toolResult);
  return (
    <Surface tone={status === "failed" ? "danger" : "inset"} padding="sm" width="content">
      <Stack gap="xs">
        <Inline align="center" gap="sm" wrap>
          <Text size="xs" tone="subtle">
            Used
          </Text>
          <Text size="sm" tone="strong">
            {props.toolCall.tool_name}
          </Text>
          <Text size="xs" tone="subtle">
            {status}
          </Text>
        </Inline>
        <Timestamp value={props.createdAt} size="xs" tone="subtle" />
      </Stack>
    </Surface>
  );
}
