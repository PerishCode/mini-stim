import {
  Badge,
  Button,
  CodeBlock,
  Inline,
  Pane,
  Stack,
  Surface,
  Text,
  Timestamp,
  useAppComponentRef,
} from "@mini-stim/components";
import type { SessionRuntimeSnapshot } from "@mini-stim/hooks";
import type { ReactNode } from "react";
import { useState } from "react";

import { STIM_APP_NAMESPACE } from "../../../../appNamespace";
import type { InspectTarget } from "../../../../events/inspect";
import { ShellCommand } from "../atoms/ShellCommand";
import {
  createShellToolModel,
  formatJson,
  getToolCallStatus,
  isShellTool,
  selectToolCallRuntime,
  type ToolCallRuntimeSelection,
  type ToolCallStatus,
  type ToolResultRecord,
  toolCallRawPayload,
} from "../model/toolCallModel";

type ToolCallInspectMode = "pretty" | "raw";

type ToolCallInspectProps = {
  runtime: SessionRuntimeSnapshot;
  target: Extract<InspectTarget, { kind: "tool_call" | "tool_result" }>;
};

type ToolCallModePanel = (props: { selection: ToolCallRuntimeSelection }) => ReactNode;
type ToolKindPanel = (props: { selection: ToolCallRuntimeSelection }) => ReactNode;

const inspectModeRegistry = {
  pretty: ToolCallPrettyPanel,
  raw: ToolCallRawPanel,
} satisfies Record<ToolCallInspectMode, ToolCallModePanel>;

const toolKindPrettyRegistry = {
  shell: ShellToolPrettyPanel,
  unknown: UnknownToolPrettyPanel,
} satisfies Record<"shell" | "unknown", ToolKindPanel>;

export function ToolCallInspectPanel(props: ToolCallInspectProps) {
  const [mode, setMode] = useState<ToolCallInspectMode>("pretty");
  const selection = selectToolCallRuntime(props.runtime, props.target);
  const toolVariant = selection.toolCall?.tool_name ?? "unknown";
  const panelRef = useAppComponentRef({
    domain: "tool call",
    id: selection.toolCall ? `inspect-tool-run-${selection.toolCall.id}` : "inspect-tool-run",
    kind: "section",
    label:
      selection.toolCall && isShellTool(selection.toolCall.tool_name)
        ? "Shell Inspect"
        : "Tool Inspect",
    metadata: {
      tool_call_id: selection.toolCall?.id,
      tool_result_id: selection.toolResult?.id,
    },
    namespace: STIM_APP_NAMESPACE,
    projection: "detail",
    role: toolVariant,
    surface: "inspect panel",
    variant: toolVariant,
  });
  const ModePanel = inspectModeRegistry[mode];

  return (
    <Stack ref={panelRef} gap="md" grow>
      <Inline justify="between" align="center" wrap gap="sm">
        <Text size="xs" tone="subtle">
          TOOL CALL
        </Text>
        <Inline gap="xs" align="center">
          <Button
            size="sm"
            variant={mode === "pretty" ? "selected" : "ghost"}
            onClick={() => setMode("pretty")}
          >
            Pretty
          </Button>
          <Button
            size="sm"
            variant={mode === "raw" ? "selected" : "ghost"}
            onClick={() => setMode("raw")}
          >
            Raw
          </Button>
        </Inline>
      </Inline>
      <ModePanel selection={selection} />
    </Stack>
  );
}

function ToolCallPrettyPanel(props: { selection: ToolCallRuntimeSelection }) {
  const { toolCall } = props.selection;
  if (!toolCall) {
    return (
      <Text size="sm" tone="muted">
        The selected tool call is not in the current snapshot.
      </Text>
    );
  }

  const kind = isShellTool(toolCall.tool_name) ? "shell" : "unknown";
  const KindPanel = toolKindPrettyRegistry[kind];
  return <KindPanel selection={props.selection} />;
}

function ShellToolPrettyPanel(props: { selection: ToolCallRuntimeSelection }) {
  const { toolCall, toolResult } = props.selection;
  if (!toolCall) {
    return (
      <Text size="sm" tone="muted">
        The selected shell call is not in the current snapshot.
      </Text>
    );
  }

  const shell = createShellToolModel(toolCall, toolResult);

  return (
    <Pane border="around" padding="md" tone="panel">
      <Stack gap="md">
        <Inline justify="between" align="center" wrap gap="sm">
          <Inline align="center" gap="sm" wrap>
            <Text size="sm" tone="strong">
              shell
            </Text>
            <StatusBadge status={shell.status} toolResult={toolResult} />
          </Inline>
          <Timestamp value={toolCall.created_at} size="xs" tone="subtle" />
        </Inline>

        <KeyValueGrid
          rows={[
            ["cwd", shell.cwd ?? "workspace default"],
            ["shell", shell.shell ?? "system default"],
            ["exit", shell.exitCode === null ? shell.status : String(shell.exitCode)],
          ]}
        />

        <Stack gap="xs">
          <Text size="xs" tone="subtle">
            COMMAND
          </Text>
          <ShellCommand
            command={shell.command ?? formatJson(toolCall.arguments)}
            presentation="block"
          />
        </Stack>

        <OutputSection label="STDOUT" value={shell.stdout} empty="No stdout captured." />
        <OutputSection
          label="STDERR"
          value={toolResult?.error_text ?? shell.stderr}
          empty="No stderr captured."
        />
      </Stack>
    </Pane>
  );
}

function UnknownToolPrettyPanel(props: { selection: ToolCallRuntimeSelection }) {
  const { toolCall, toolResult } = props.selection;
  if (!toolCall) {
    return (
      <Text size="sm" tone="muted">
        The selected tool call is not in the current snapshot.
      </Text>
    );
  }

  return (
    <Pane border="around" padding="md" tone="panel">
      <Stack gap="sm">
        <Inline justify="between" align="center" wrap gap="sm">
          <Inline align="center" gap="sm" wrap>
            <Text size="sm" tone="strong">
              {toolCall.tool_name}
            </Text>
            <StatusBadge status={getToolCallStatus(toolResult)} toolResult={toolResult} />
          </Inline>
          <Timestamp value={toolCall.created_at} size="xs" tone="subtle" />
        </Inline>
        <Stack gap="xs">
          <Text size="xs" tone="subtle">
            ARGUMENTS
          </Text>
          <CodeBlock>{formatJson(toolCall.arguments)}</CodeBlock>
        </Stack>
        <Stack gap="xs">
          <Text size="xs" tone="subtle">
            RESULT
          </Text>
          {toolResult ? (
            <CodeBlock>{toolResult.error_text ?? formatJson(toolResult.output)}</CodeBlock>
          ) : (
            <Text size="sm" tone="muted">
              No tool result has been recorded yet.
            </Text>
          )}
        </Stack>
      </Stack>
    </Pane>
  );
}

function ToolCallRawPanel(props: { selection: ToolCallRuntimeSelection }) {
  return <CodeBlock>{formatJson(toolCallRawPayload(props.selection))}</CodeBlock>;
}

function KeyValueGrid(props: { rows: Array<[string, string]> }) {
  return (
    <Stack gap="xs">
      {props.rows.map(([label, value]) => (
        <Surface key={label} padding="sm" tone="inset">
          <Inline justify="between" align="center" gap="sm" wrap>
            <Text size="xs" tone="subtle">
              {label}
            </Text>
            <Text size="sm" tone="strong">
              {value}
            </Text>
          </Inline>
        </Surface>
      ))}
    </Stack>
  );
}

function OutputSection(props: { empty: string; label: string; value: string }) {
  return (
    <Stack gap="xs">
      <Text size="xs" tone="subtle">
        {props.label}
      </Text>
      {props.value ? (
        <CodeBlock>{props.value}</CodeBlock>
      ) : (
        <Text size="sm" tone="muted">
          {props.empty}
        </Text>
      )}
    </Stack>
  );
}

function StatusBadge(props: {
  status: ToolCallStatus;
  toolResult: ToolResultRecord | null | undefined;
}) {
  const tone = statusTone(props.status);
  const label = props.status === "completed" && props.toolResult ? "completed" : props.status;
  return (
    <Badge size="sm" tone={tone}>
      {label}
    </Badge>
  );
}

function statusTone(status: ToolCallStatus) {
  switch (status) {
    case "failed":
      return "danger";
    case "running":
      return "neutral";
    case "completed":
      return "success";
  }
}
