import { Panel, useAppComponentRef } from "@mini-stim/components";

import { STIM_APP_NAMESPACE } from "../appNamespace";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { Transcript } from "./Transcript";

export function ChatShell(props: {
  activity: string;
  busy: boolean;
  connection: string;
  error: string | null;
  inspecting: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onTitleCommit: (title: string | null) => void;
  selectedSessionId: string | null;
  soulIdentity: Parameters<typeof Transcript>[0]["soulIdentity"];
  title: string;
  titleValue: string | null;
  timeline: Parameters<typeof Transcript>[0]["timeline"];
  draft: string;
}) {
  const shellRef = useAppComponentRef({
    domain: "chat",
    id: "chat-shell",
    kind: "panel",
    label: "Chat Shell",
    namespace: STIM_APP_NAMESPACE,
    projection: "primary panel",
    surface: "workspace",
  });

  return (
    <Panel.Root ref={shellRef}>
      <Panel.Header>
        <ChatHeader
          activity={props.activity}
          busy={props.busy}
          connection={props.connection}
          inspecting={props.inspecting}
          onTitleCommit={props.onTitleCommit}
          selectedSessionId={props.selectedSessionId}
          title={props.title}
          titleValue={props.titleValue}
        />
      </Panel.Header>
      <Panel.Body tone="inset" scroll>
        <Transcript soulIdentity={props.soulIdentity} timeline={props.timeline} />
      </Panel.Body>
      <Panel.Footer>
        <Composer
          value={props.draft}
          disabled={props.busy || !props.selectedSessionId}
          error={props.error}
          onChange={props.onDraftChange}
          onSubmit={props.onSend}
        />
      </Panel.Footer>
    </Panel.Root>
  );
}
