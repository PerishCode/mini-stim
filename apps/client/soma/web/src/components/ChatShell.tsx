import { Notice, Pane, Stack, Text } from "@mini-stim/components";

import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { Transcript } from "./Transcript";

export function ChatShell(props: {
  busy: boolean;
  connection: string;
  error: string | null;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  selectedSessionId: string | null;
  title: string;
  timeline: Parameters<typeof Transcript>[0]["timeline"];
  draft: string;
}) {
  return (
    <Pane tone="subtle" grow>
      <Stack grow>
        <ChatHeader
          busy={props.busy}
          connection={props.connection}
          selectedSessionId={props.selectedSessionId}
          title={props.title}
        />
        <Transcript timeline={props.timeline} />
        {props.error ? (
          <Pane padding="md">
            <Notice tone="danger">
              <Text>{props.error}</Text>
            </Notice>
          </Pane>
        ) : null}
        <Pane border="top" padding="md" tone="panel">
          <Composer
            value={props.draft}
            disabled={props.busy}
            onChange={props.onDraftChange}
            onSubmit={props.onSend}
          />
        </Pane>
      </Stack>
    </Pane>
  );
}
