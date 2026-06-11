import { Pane, SectionStackLayout } from "@mini-stim/components";

import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { Transcript } from "./Transcript";

export function ChatShell(props: {
  activity: string;
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
      <SectionStackLayout
        top={(
          <ChatHeader
            activity={props.activity}
            busy={props.busy}
            connection={props.connection}
            onTitleCommit={props.onTitleCommit}
            selectedSessionId={props.selectedSessionId}
            title={props.title}
            titleValue={props.titleValue}
          />
        )}
        middle={<Transcript timeline={props.timeline} />}
        bottom={(
          <Composer
            value={props.draft}
            disabled={props.busy}
            error={props.error}
            onChange={props.onDraftChange}
            onSubmit={props.onSend}
          />
        )}
      />
    </Pane>
  );
}
