import { Notice, Pane, ScrollArea, Stack, Text } from "@mini-stim/components";
import type { TurnGroup } from "@mini-stim/hooks";

import { TimelineItemView } from "./TimelineItemView";

export interface SoulIdentity {
  avatarSeed: string;
  name: string;
}

export function Transcript(props: {
  soulIdentity: SoulIdentity;
  timeline: TurnGroup[];
}) {
  const empty = !props.timeline.some(
    (group) => group.items.length || group.turn,
  );
  return (
    <ScrollArea grow>
      <Pane padding="xl">
        <Stack gap="lg">
          {props.timeline.map((group) => (
            <TurnGroupView
              key={group.id}
              group={group}
              soulIdentity={props.soulIdentity}
            />
          ))}
          {empty ? (
            <Notice>
              <Text tone="muted">Start a session to see the transcript build here.</Text>
            </Notice>
          ) : null}
        </Stack>
      </Pane>
    </ScrollArea>
  );
}

function TurnGroupView(props: { group: TurnGroup; soulIdentity: SoulIdentity }) {
  const { group, soulIdentity } = props;
  const turn = group.turn;
  return (
    <Stack gap="lg">
      {group.items.map((item) => (
        <TimelineItemView
          key={item.id}
          item={item}
          soulIdentity={soulIdentity}
        />
      ))}
      {turn?.status === "failed" ? (
        <Notice tone="danger">
          <Stack gap="xs">
            <Text size="xs" tone="subtle">TURN FAILED</Text>
            <Text>{turn.error_text ?? "The turn failed without an error message."}</Text>
          </Stack>
        </Notice>
      ) : null}
      {turn?.status === "running" && !group.items.length ? (
        <Text size="sm" tone="subtle">Working…</Text>
      ) : null}
    </Stack>
  );
}
