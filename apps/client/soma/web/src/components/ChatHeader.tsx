import {
  Badge,
  Heading,
  Inline,
  Pane,
  Stack,
  Text,
} from "@mini-stim/components";

export function ChatHeader(props: {
  busy: boolean;
  connection: string;
  selectedSessionId: string | null;
  title: string;
}) {
  return (
    <Pane border="bottom" padding="lg" tone="raised">
      <Inline justify="between" align="start" wrap gap="md">
        <Stack gap="xs">
          <Text size="xs" tone="subtle">SESSION</Text>
          <Heading tag="h2" size="lg" truncate>
            {props.title}
          </Heading>
        </Stack>
        <Inline gap="sm" wrap>
          <Badge size="sm" tone={props.busy ? "success" : "neutral"}>
            {props.busy ? "sending" : "idle"}
          </Badge>
          {props.selectedSessionId ? <Badge size="sm" tone="accent">{props.connection}</Badge> : null}
          {!props.selectedSessionId ? <Badge size="sm">new</Badge> : null}
        </Inline>
      </Inline>
    </Pane>
  );
}
