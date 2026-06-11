import { Notice, Pane, ScrollArea, Stack, Text } from "@mini-stim/components";
import type { TimelineItem } from "@mini-stim/hooks";

import { TimelineItemView } from "./TimelineItemView";

export function Transcript(props: {
  timeline: TimelineItem[];
}) {
  return (
    <ScrollArea grow>
      <Pane padding="xl">
        <Stack gap="lg">
          {props.timeline.map((item) => (
            <TimelineItemView key={item.id} item={item} />
          ))}
          {!props.timeline.length ? (
            <Notice>
              <Text tone="muted">Start a session to see the transcript build here.</Text>
            </Notice>
          ) : null}
        </Stack>
      </Pane>
    </ScrollArea>
  );
}
