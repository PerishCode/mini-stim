import {
  ChevronRightIcon,
  IconButton,
  Inline,
  Pane,
  Panel,
  Text,
  useAppComponentRef,
} from "@mini-stim/components";
import type { SessionRuntimeSnapshot } from "@mini-stim/hooks";
import type { ReactNode } from "react";

import { STIM_APP_NAMESPACE } from "../appNamespace";
import { closeInspectPanel, type InspectTarget } from "../events/inspect";
import { MessageInspectPanel } from "./domains/message/InspectPanel/MessageInspectPanel";
import { SessionInspectPanel } from "./domains/session/InspectPanel/SessionInspectPanel";
import { ToolCallInspectPanel } from "./domains/tool-call/InspectPanel/ToolCallInspectPanel";

type InspectDomain = "session" | "message" | "tool-call";

type InspectDomainPanelProps = {
  runtime: SessionRuntimeSnapshot;
  target: InspectTarget | null;
};

type InspectDomainPanel = (props: InspectDomainPanelProps) => ReactNode;

const inspectDomainRegistry = {
  message: MessageInspectDomain,
  session: SessionInspectDomain,
  "tool-call": ToolCallInspectDomain,
} satisfies Record<InspectDomain, InspectDomainPanel>;

export function InspectPanel(props: {
  runtime: SessionRuntimeSnapshot | null;
  target: InspectTarget | null;
}) {
  const { runtime, target } = props;
  const panelRef = useAppComponentRef({
    domain: "inspect",
    id: "inspect-panel",
    kind: "panel",
    label: "Inspect Panel",
    namespace: STIM_APP_NAMESPACE,
    projection: "panel",
    surface: "workspace",
  });

  const domain = resolveInspectDomain(target);
  const DomainPanel = inspectDomainRegistry[domain];

  return (
    <Panel.Root ref={panelRef}>
      <Panel.Header>
        <Inline justify="between" align="center" gap="md">
          <Inline gap="sm" align="center" wrap>
            <Text size="lg" tone="strong">
              Inspect
            </Text>
            <Text size="xs" tone="subtle">
              {inspectDomainTitle(domain)}
            </Text>
          </Inline>
          <IconButton label="Close Inspect" size="sm" variant="ghost" onClick={closeInspectPanel}>
            <ChevronRightIcon size="sm" />
          </IconButton>
        </Inline>
      </Panel.Header>
      <Panel.Body tone="inset" scroll>
        {runtime ? (
          <DomainPanel runtime={runtime} target={target} />
        ) : (
          <Pane padding="lg">
            <Text tone="muted">No runtime snapshot loaded for this session yet.</Text>
          </Pane>
        )}
      </Panel.Body>
    </Panel.Root>
  );
}

function SessionInspectDomain(props: InspectDomainPanelProps) {
  return <SessionInspectPanel runtime={props.runtime} />;
}

function MessageInspectDomain(props: InspectDomainPanelProps) {
  switch (props.target?.kind) {
    case "message":
      return <MessageInspectPanel runtime={props.runtime} messageId={props.target.messageId} />;
    case "session":
    case "turn":
    case "tool_call":
    case "tool_result":
    case undefined:
      return <SessionInspectPanel runtime={props.runtime} />;
  }
}

function ToolCallInspectDomain(props: InspectDomainPanelProps) {
  switch (props.target?.kind) {
    case "tool_call":
    case "tool_result":
      return <ToolCallInspectPanel runtime={props.runtime} target={props.target} />;
    case "message":
    case "session":
    case "turn":
    case undefined:
      return <SessionInspectPanel runtime={props.runtime} />;
  }
}

function resolveInspectDomain(target: InspectTarget | null): InspectDomain {
  switch (target?.kind) {
    case "message":
      return "message";
    case "tool_call":
    case "tool_result":
      return "tool-call";
    case "session":
    case "turn":
    case undefined:
      return "session";
  }
}

function inspectDomainTitle(domain: InspectDomain) {
  switch (domain) {
    case "message":
      return "Message";
    case "session":
      return "Session";
    case "tool-call":
      return "Tool Call";
  }
}
