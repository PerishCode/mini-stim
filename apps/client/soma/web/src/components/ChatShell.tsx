import { GridRows, Notice, Pane, Stack, Text } from "@mini-stim/components";

import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { Transcript } from "./Transcript";

export function ChatShell(props: {
  busy: boolean;
  connection: string;
  error: string | null;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onTitleCommit: (title: string | null) => void;
  selectedSessionId: string | null;
  title: string;
  titleValue: string | null;
  timeline: Parameters<typeof Transcript>[0]["timeline"];
  draft: string;
}) {
  return (
    <Pane chrome="panel" tone="subtle" grow>
      <GridRows grow template="header-body-footer">
        <ChatHeader
          busy={props.busy}
          connection={props.connection}
          onTitleCommit={props.onTitleCommit}
          selectedSessionId={props.selectedSessionId}
          title={props.title}
          titleValue={props.titleValue}
        />
        <Transcript timeline={props.timeline} />
        <Stack gap="none">
          {props.error ? (
            <Pane padding="md">
              <Notice tone="danger">
                <Text>{props.error}</Text>
              </Notice>
            </Pane>
          ) : null}
          <Pane border="top" padding="md" tone="raised">
            <Composer
              value={props.draft}
              disabled={props.busy}
              onChange={props.onDraftChange}
              onSubmit={props.onSend}
            />
          </Pane>
        </Stack>
      </GridRows>
    </Pane>
  );
}
