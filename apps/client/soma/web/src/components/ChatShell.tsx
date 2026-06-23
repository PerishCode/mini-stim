import { Panel, useAppComponentRef } from "@mini-stim/components";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const followTailRef = useRef(true);
  const shellRef = useAppComponentRef({
    domain: "chat",
    id: "chat-shell",
    kind: "panel",
    label: "Chat Shell",
    namespace: STIM_APP_NAMESPACE,
    projection: "primary panel",
    surface: "workspace",
  });
  const handleScroll = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }
    followTailRef.current = distanceFromBottom(scrollElement) <= 48;
  }, []);
  const scrollToBottom = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }
    requestAnimationFrame(() => {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    });
  }, []);

  useLayoutEffect(() => {
    if (followTailRef.current) {
      scrollToBottom();
    }
  });

  useEffect(() => {
    const transcriptElement = transcriptRef.current;
    if (!transcriptElement) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      if (followTailRef.current) {
        scrollToBottom();
      }
    });
    observer.observe(transcriptElement);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  function handleSend() {
    followTailRef.current = true;
    props.onSend();
    scrollToBottom();
  }

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
      <Panel.Body innerRef={scrollRef} tone="inset" scroll onScroll={handleScroll}>
        <Transcript
          contentRef={transcriptRef}
          soulIdentity={props.soulIdentity}
          timeline={props.timeline}
        />
      </Panel.Body>
      <Panel.Footer>
        <Composer
          value={props.draft}
          disabled={!props.selectedSessionId}
          error={props.error}
          onChange={props.onDraftChange}
          onSubmit={handleSend}
          submitting={props.busy}
        />
      </Panel.Footer>
    </Panel.Root>
  );
}

function distanceFromBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}
