import { Notice, Pane, ScrollArea, Stack, Text } from "@mini-stim/components";
import type { TimelineItem } from "@mini-stim/hooks";

import { TimelineItemView } from "./TimelineItemView";

export function Transcript(props: {
  timeline: TimelineItem[];
}) {
  return (
    <ScrollArea grow>
      <Pane padding="lg">
        <Stack gap="md">
          {props.timeline.map((item) => (
            <TimelineItemView key={item.id} item={item} />
          ))}
          {!props.timeline.length ? (
            <Notice>
              <Text tone="muted">Start a session</Text>
            </Notice>
          ) : null}
        </Stack>
      </Pane>
    </ScrollArea>
  );
}
