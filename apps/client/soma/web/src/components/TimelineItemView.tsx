import {
  AnchoredContentGroupItem,
  MarkdownText,
  Stack,
  Surface,
  Text,
  Timestamp,
  useAppComponentRef,
} from "@mini-stim/components";
import type { TimelineItem } from "@mini-stim/hooks";

import { STIM_APP_NAMESPACE } from "../appNamespace";
import { selectInspectTarget } from "../events/inspect";
import {
  createShellToolModel,
  getToolCallStatus,
  isShellTool,
  truncateMiddle,
} from "./domains/tool-call/model/toolCallModel";
import { ToolCallWhisper, ToolResultWhisper } from "./domains/tool-call/transcript/ToolCallWhisper";

type ThinkingTimelineItem = Extract<TimelineItem, { kind: "thinking" }>;

export function TimelineItemView(props: {
  align?: "start" | "center" | "end";
  item: TimelineItem;
}) {
  const { align = "start", item } = props;
  const target = targetForItem(item);
  const itemRef = useAppComponentRef(registrationForItem(item));

  switch (item.kind) {
    case "message":
      return <MessageTimelineItem align={align} item={item} itemRef={itemRef} target={target} />;
    case "thinking":
      return (
        <AnchoredContentGroupItem
          align={align}
          innerRef={itemRef}
          onClick={() => selectInspectTarget(target)}
        >
          <ThinkingWhisper item={item} />
        </AnchoredContentGroupItem>
      );
    case "tool_call":
      return (
        <AnchoredContentGroupItem
          align={align}
          innerRef={itemRef}
          onClick={() => selectInspectTarget(target)}
        >
          <ToolCallWhisper item={item} showTimestamp={false} />
        </AnchoredContentGroupItem>
      );
    case "tool_result":
      return (
        <AnchoredContentGroupItem
          align={align}
          innerRef={itemRef}
          onClick={() => selectInspectTarget(target)}
        >
          <ToolResultWhisper item={item} showTimestamp={false} />
        </AnchoredContentGroupItem>
      );
  }
}

function ThinkingWhisper(props: { item: ThinkingTimelineItem }) {
  const thinking = props.item.thinking;
  const running = thinking.state === "running";
  const failed = thinking.state === "failed";
  const duration = thinking.finished_at
    ? durationLabel(thinking.created_at, thinking.finished_at)
    : "";
  const headline = thinkingHeadlineText(props.item, duration);
  const summary = thinking.summary?.trim();

  return (
    <Surface tone={failed ? "danger" : "inset"} padding="sm" width="content">
      <Stack gap="xs">
        <Text size="xs" tone={running || failed ? "strong" : "subtle"}>
          {headline}
        </Text>
        {summary ? (
          <Text size="xs" tone="muted">
            {summary}
          </Text>
        ) : null}
        {failed && thinking.error_text ? (
          <Text size="xs" tone={failed ? "strong" : "muted"}>
            {thinking.error_text}
          </Text>
        ) : null}
        <Timestamp value={thinking.created_at} size="xs" tone="subtle" />
      </Stack>
    </Surface>
  );
}

function MessageTimelineItem(props: {
  align: "start" | "center" | "end";
  item: Extract<TimelineItem, { kind: "message" }>;
  itemRef: (element: HTMLElement | null) => void;
  target: ReturnType<typeof targetForItem>;
}) {
  const role = props.item.message.message.actor_type;
  const pending = props.item.message.message.state === "pending";

  return (
    <AnchoredContentGroupItem
      align={props.align}
      element="div"
      innerRef={props.itemRef}
      onClick={() => selectInspectTarget(props.target)}
    >
      <MarkdownText tone={role === "account" ? "strong" : "default"}>
        {props.item.message.content_text}
      </MarkdownText>
      {pending ? (
        <Text size="xs" tone="subtle">
          generating…
        </Text>
      ) : null}
    </AnchoredContentGroupItem>
  );
}

function registrationForItem(item: TimelineItem) {
  switch (item.kind) {
    case "message": {
      const role = item.message.message.actor_type;
      return {
        domain: "message",
        id: `message-${item.message.message.id}`,
        kind: "message",
        label: `${role} Message`,
        metadata: {
          message_id: item.message.message.id,
          session_id: item.sessionId,
        },
        namespace: STIM_APP_NAMESPACE,
        projection: "bubble",
        role,
        surface: "transcript",
      } as const;
    }
    case "thinking":
      return {
        copyText: thinkingCopyText(item),
        domain: "thinking",
        id: `thinking-${item.thinking.id}`,
        kind: "message",
        label: "Thinking",
        metadata: {
          session_id: item.sessionId,
          thinking_id: item.thinking.id,
          turn_id: item.thinking.turn_id,
        },
        namespace: STIM_APP_NAMESPACE,
        projection: "thinking whisper",
        role: "soul",
        surface: "transcript",
        variant: item.thinking.state,
      } as const;
    case "tool_call":
      return {
        copyText: toolRunCopyText(item),
        domain: "tool call",
        id: `tool-call-${item.toolCall.id}`,
        kind: "tool",
        label: toolRunLabel(item.toolCall.tool_name),
        metadata: {
          session_id: item.sessionId,
          tool_call_id: item.toolCall.id,
          tool_result_id: item.toolResult?.id,
          turn_id: item.toolCall.turn_id,
        },
        namespace: STIM_APP_NAMESPACE,
        projection: "run whisper",
        role: item.toolCall.tool_name,
        surface: "transcript",
        variant: item.toolCall.tool_name,
      } as const;
    case "tool_result":
      return {
        copyText: toolResultCopyText(item),
        domain: "tool call",
        id: `tool-result-${item.toolResult.id}`,
        kind: "tool",
        label: item.toolCall ? toolResultLabel(item.toolCall.tool_name) : "Tool Result",
        metadata: {
          session_id: item.sessionId,
          tool_call_id: item.toolCall?.id,
          tool_result_id: item.toolResult.id,
        },
        namespace: STIM_APP_NAMESPACE,
        projection: "result whisper",
        role: item.toolCall?.tool_name ?? "unknown tool",
        surface: "transcript",
        variant: item.toolCall?.tool_name ?? "unknown",
      } as const;
  }
}

function targetForItem(item: TimelineItem) {
  switch (item.kind) {
    case "message":
      return {
        kind: "message",
        sessionId: item.sessionId,
        messageId: item.message.message.id,
      } as const;
    case "thinking":
      return {
        kind: "thinking",
        sessionId: item.sessionId,
        thinkingId: item.thinking.id,
      } as const;
    case "tool_call":
      return {
        kind: "tool_call",
        sessionId: item.sessionId,
        toolCallId: item.toolCall.id,
      } as const;
    case "tool_result":
      return {
        kind: "tool_result",
        sessionId: item.sessionId,
        toolResultId: item.toolResult.id,
      } as const;
  }
}

function thinkingCopyText(item: ThinkingTimelineItem) {
  const duration = item.thinking.finished_at
    ? durationLabel(item.thinking.created_at, item.thinking.finished_at)
    : "";

  return compactLines([
    thinkingHeadlineText(item, duration),
    `status: ${thinkingStateLabel(item)}`,
    duration ? `duration: ${duration}` : null,
    item.thinking.summary ? `summary: ${item.thinking.summary}` : null,
    item.thinking.error_text ? `error: ${item.thinking.error_text}` : null,
    refsLine([
      ["session", item.sessionId],
      ["turn", item.thinking.turn_id],
      ["thinking", item.thinking.id],
    ]),
  ]);
}

function thinkingStateLabel(item: ThinkingTimelineItem) {
  switch (item.thinking.state) {
    case "running":
      return "waiting";
    case "completed":
      return "ready";
    case "failed":
      return "failed";
  }
}

function thinkingHeadlineText(item: ThinkingTimelineItem, duration: string) {
  const thinking = item.thinking;
  if (thinking.state === "running") {
    return "thinking · waiting";
  }

  if (thinking.state === "failed") {
    return "thinking · failed";
  }

  const milestone = thinkingCompletionReasonLabel(thinking.completion_reason);
  return compactJoin("\u00a0·\u00a0", ["thinking", milestone, duration]);
}

function thinkingCompletionReasonLabel(reason: string | null | undefined) {
  switch (reason) {
    case "first_text_delta":
      return "first\u00a0token";
    case "tool_call_requested":
      return "tool\u00a0call";
    case "provider_completed":
      return "provider\u00a0completed";
    default:
      return null;
  }
}

function toolRunLabel(toolName: string) {
  return isShellTool(toolName) ? "Shell Run" : "Tool Run";
}

function toolResultLabel(toolName: string) {
  return isShellTool(toolName) ? "Shell Result" : "Tool Result";
}

function toolRunCopyText(item: Extract<TimelineItem, { kind: "tool_call" }>) {
  if (isShellTool(item.toolCall.tool_name)) {
    const shell = createShellToolModel(item.toolCall, item.toolResult ?? null);
    return compactLines([
      "Shell Run",
      "Transcript · shell run whisper",
      shell.command ? `$ ${truncateMiddle(shell.command, 140)}` : null,
      shellRunStatusLine(shell),
      shellRunOutputLine(shell, item.toolResult?.error_text ?? null),
      refsLine([
        ["session", item.sessionId],
        ["turn", item.toolCall.turn_id],
        ["call", item.toolCall.id],
        ["result", item.toolResult?.id],
      ]),
    ]);
  }

  const status = getToolCallStatus(item.toolResult);
  return compactLines([
    "Tool Run",
    `Transcript · ${item.toolCall.tool_name} run whisper`,
    `status: ${status}`,
    refsLine([
      ["session", item.sessionId],
      ["turn", item.toolCall.turn_id],
      ["call", item.toolCall.id],
      ["result", item.toolResult?.id],
    ]),
  ]);
}

function toolResultCopyText(item: Extract<TimelineItem, { kind: "tool_result" }>) {
  if (item.toolCall && isShellTool(item.toolCall.tool_name)) {
    const shell = createShellToolModel(item.toolCall, item.toolResult);
    return compactLines([
      "Shell Result",
      "Transcript · shell result whisper",
      shellRunStatusLine(shell),
      shellRunOutputLine(shell, item.toolResult.error_text ?? null),
      refsLine([
        ["session", item.sessionId],
        ["call", item.toolCall.id],
        ["result", item.toolResult.id],
      ]),
    ]);
  }

  return compactLines([
    item.toolCall ? "Tool Result" : "Unknown Tool Result",
    item.toolCall
      ? `Transcript · ${item.toolCall.tool_name} result whisper`
      : "Transcript · tool result whisper",
    `status: ${item.toolResult.error_text ? "failed" : "completed"}`,
    refsLine([
      ["session", item.sessionId],
      ["call", item.toolCall?.id],
      ["result", item.toolResult.id],
    ]),
  ]);
}

function durationLabel(start: string, end: string) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return "";
  }
  const ms = endMs - startMs;
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function shellRunStatusLine(shell: ReturnType<typeof createShellToolModel>) {
  return compactJoin(" · ", [
    `status: ${shell.status}`,
    shell.shell ? `shell: ${shell.shell}` : null,
    shell.exitCode === null ? null : `exit: ${shell.exitCode}`,
  ]);
}

function shellRunOutputLine(
  shell: ReturnType<typeof createShellToolModel>,
  errorText: string | null,
) {
  const output = errorText || shell.stderr || shell.stdout;
  if (!output) {
    return null;
  }
  const label = errorText || shell.stderr ? "stderr" : "stdout";
  return `${label}: ${truncateMiddle(output, 180)}`;
}

function refsLine(refs: Array<[string, string | null | undefined]>) {
  const text = refs
    .filter((ref): ref is [string, string] => Boolean(ref[1]))
    .map(([key, value]) => `${key}=${value}`)
    .join(" · ");

  return text ? `refs: ${text}` : null;
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter((line): line is string => Boolean(line?.trim())).join("\n");
}

function compactJoin(separator: string, parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(separator);
}
