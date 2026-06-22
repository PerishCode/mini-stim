import type { SessionRuntimeSnapshot, TimelineItem } from "@mini-stim/hooks";

export type ToolCallRecord = SessionRuntimeSnapshot["tool_calls"][number];
export type ToolResultRecord = SessionRuntimeSnapshot["tool_results"][number];

export type ToolCallStatus = "running" | "completed" | "failed";

export type ShellToolModel = {
  command: string | null;
  cwd: string | null;
  exitCode: number | null;
  shell: string | null;
  status: ToolCallStatus;
  stderr: string;
  stdout: string;
};

export type ToolCallRuntimeSelection = {
  toolCall: ToolCallRecord | null;
  toolResult: ToolResultRecord | null;
};

export function selectToolCallRuntime(
  runtime: SessionRuntimeSnapshot,
  target: { kind: "tool_call"; toolCallId: string } | { kind: "tool_result"; toolResultId: string },
): ToolCallRuntimeSelection {
  switch (target.kind) {
    case "tool_call": {
      const toolCall = runtime.tool_calls.find((item) => item.id === target.toolCallId) ?? null;
      const toolResult = toolCall
        ? (runtime.tool_results.find((item) => item.tool_call_id === toolCall.id) ?? null)
        : null;
      return { toolCall, toolResult };
    }
    case "tool_result": {
      const toolResult =
        runtime.tool_results.find((item) => item.id === target.toolResultId) ?? null;
      const toolCall = toolResult
        ? (runtime.tool_calls.find((item) => item.id === toolResult.tool_call_id) ?? null)
        : null;
      return { toolCall, toolResult };
    }
  }
}

export function getToolCallStatus(toolResult: ToolResultRecord | null | undefined): ToolCallStatus {
  switch (true) {
    case !toolResult:
      return "running";
    case Boolean(toolResult?.error_text):
      return "failed";
    default:
      return "completed";
  }
}

export function isShellTool(toolName: string) {
  return normalizeToolName(toolName) === "shell";
}

export function createShellToolModel(
  toolCall: ToolCallRecord,
  toolResult: ToolResultRecord | null | undefined,
): ShellToolModel {
  const args = objectRecord(toolCall.arguments);
  const output = objectRecord(toolResult?.output);

  return {
    command: stringValue(args.command) ?? stringValue(args.cmd),
    cwd: stringValue(args.cwd) ?? stringValue(args.working_directory),
    exitCode: numberValue(output.exit_code),
    shell: stringValue(args.shell) ?? stringValue(output.shell),
    status: getToolCallStatus(toolResult),
    stderr: stringValue(output.stderr) ?? "",
    stdout: stringValue(output.stdout) ?? "",
  };
}

export function toolCallRawPayload(selection: ToolCallRuntimeSelection) {
  return {
    tool_call: selection.toolCall,
    tool_result: selection.toolResult,
  };
}

export function formatJson(value: unknown) {
  switch (typeof value) {
    case "undefined":
      return "";
    case "string":
      return value;
    default:
      return value === null ? "" : JSON.stringify(value, null, 2);
  }
}

export function truncateMiddle(value: string, maxChars: number) {
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const marker = " ... ";
  const available = Math.max(0, maxChars - marker.length);
  const headLength = Math.ceil(available / 2);
  const tailLength = Math.floor(available / 2);

  return `${normalized.slice(0, headLength)}${marker}${normalized.slice(
    normalized.length - tailLength,
  )}`;
}

export function toolCallFromTimeline(item: Extract<TimelineItem, { kind: "tool_call" }>) {
  return {
    toolCall: item.toolCall,
    toolResult: item.toolResult ?? null,
  };
}

function normalizeToolName(toolName: string) {
  return toolName.trim().toLowerCase().replaceAll("-", "_");
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  switch (typeof value) {
    case "number":
      return Number.isFinite(value) ? value : null;
    case "string": {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    default:
      return null;
  }
}
