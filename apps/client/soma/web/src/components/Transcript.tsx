import { Notice, Pane, ScrollArea, Stack, Text } from "@mini-stim/components";
import type { TimelineItem, TurnGroup } from "@mini-stim/hooks";

import { TimelineItemView } from "./TimelineItemView";

export interface SoulIdentity {
  avatarSeed: string;
  name: string;
}

export function Transcript(props: {
  soulIdentity: SoulIdentity;
  timeline: TurnGroup[];
}) {
  const groups = annotateIdentityGroups(props.timeline);
  const empty = !props.timeline.some(
    (group) => group.items.length || group.turn,
  );
  return (
    <ScrollArea grow>
      <Pane padding="xl">
        <Stack gap="lg">
          {groups.map((group) => (
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

function TurnGroupView(props: {
  group: AnnotatedTurnGroup;
  soulIdentity: SoulIdentity;
}) {
  const { group, soulIdentity } = props;
  const turn = group.turn;
  return (
    <Stack gap="lg">
      {group.items.map(({ item, showIdentity }) => (
        <TimelineItemView
          key={item.id}
          item={item}
          showIdentity={showIdentity}
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

interface AnnotatedTimelineItem {
  item: TimelineItem;
  showIdentity: boolean;
}

type AnnotatedTurnGroup = Omit<TurnGroup, "items"> & {
  items: AnnotatedTimelineItem[];
};

function annotateIdentityGroups(groups: TurnGroup[]): AnnotatedTurnGroup[] {
  let previousIdentityKey: string | null = null;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const identityKey = messageIdentityKey(item);
      const showIdentity =
        identityKey === null || identityKey !== previousIdentityKey;
      previousIdentityKey = identityKey;
      return {
        item,
        showIdentity,
      };
    }),
  }));
}

function messageIdentityKey(item: TimelineItem) {
  if (item.kind !== "message") {
    return null;
  }
  const message = item.message.message;
  return `${message.actor_type}:${message.actor_id}`;
}
