import {
  CodeBlock,
  Inline,
  Pane,
  Stack,
  Text,
  Timestamp,
  useAppComponentRef,
} from "@mini-stim/components";
import type { SessionRuntimeSnapshot } from "@mini-stim/hooks";

import { STIM_APP_NAMESPACE } from "../../../../appNamespace";

export function MessageInspectPanel(props: { messageId: string; runtime: SessionRuntimeSnapshot }) {
  const panelRef = useAppComponentRef({
    domain: "message",
    id: `inspect-message-${props.messageId}`,
    kind: "section",
    label: "Inspect Message",
    namespace: STIM_APP_NAMESPACE,
    projection: "detail",
    role: "message",
    surface: "inspect panel",
  });
  const message =
    props.runtime.messages.find((item) => item.message.id === props.messageId) ?? null;

  return (
    <Stack ref={panelRef} gap="lg">
      <Text size="xs" tone="subtle">
        MESSAGE
      </Text>
      {message ? (
        <Pane border="around" padding="md" tone="panel">
          <Stack gap="sm">
            <Inline justify="between" align="center" wrap gap="sm">
              <Text size="xs" tone="subtle">
                {message.message.actor_type} · {message.message.message_kind} · seq{" "}
                {message.relation.session_seq}
              </Text>
              <Timestamp value={message.message.created_at} size="xs" tone="subtle" />
            </Inline>
            <CodeBlock>{message.content_text}</CodeBlock>
          </Stack>
        </Pane>
      ) : (
        <Text size="sm" tone="muted">
          The selected message is not in the current snapshot.
        </Text>
      )}
    </Stack>
  );
}
