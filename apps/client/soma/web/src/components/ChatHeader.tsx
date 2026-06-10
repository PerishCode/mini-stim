import {
  Badge,
  Heading,
  Inline,
  Pane,
} from "@mini-stim/components";

export function ChatHeader(props: {
  busy: boolean;
  connection: string;
  selectedSessionId: string | null;
  title: string;
}) {
  return (
    <Pane border="bottom" padding="md" tone="panel">
      <Inline justify="between" wrap gap="sm">
        <Heading tag="h2" size="md" truncate>
          {props.title}
        </Heading>
        <Inline gap="sm" wrap>
          {props.busy ? <Badge tone="success">Sending</Badge> : null}
          {props.selectedSessionId ? <Badge>{props.connection}</Badge> : null}
        </Inline>
      </Inline>
    </Pane>
  );
}
