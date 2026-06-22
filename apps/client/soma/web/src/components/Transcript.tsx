import {
  AnchoredContentGroup,
  AnchoredContentGroupDivider,
  Notice,
  Stack,
  Text,
  Timestamp,
  useAppComponentRef,
} from "@mini-stim/components";
import type { TurnGroup } from "@mini-stim/hooks";
import { Fragment } from "react";

import { STIM_APP_NAMESPACE } from "../appNamespace";
import type { TranscriptGroup } from "../projections/transcriptGrouping";
import { buildTranscriptGroups, flattenTimelineItems } from "../projections/transcriptGrouping";
import { TimelineItemView } from "./TimelineItemView";

export interface SoulIdentity {
  avatarSeed: string;
  name: string;
}

export function Transcript(props: { soulIdentity: SoulIdentity; timeline: TurnGroup[] }) {
  const items = flattenTimelineItems(props.timeline);
  const groups = buildTranscriptGroups(items);
  const empty = !props.timeline.some((group) => group.items.length || group.turn);
  const transcriptRef = useAppComponentRef({
    domain: "message",
    id: "transcript",
    kind: "section",
    label: "Transcript",
    namespace: STIM_APP_NAMESPACE,
    projection: "timeline",
    surface: "chat shell",
  });

  return (
    <Stack ref={transcriptRef} gap="sm" grow={empty}>
      {groups.map((group) => (
        <TranscriptGroupView
          key={group.id}
          group={group}
          items={items}
          soulIdentity={props.soulIdentity}
        />
      ))}
      <TurnStateNotices timeline={props.timeline} />
      {empty ? <TranscriptEmpty /> : null}
    </Stack>
  );
}

function TranscriptEmpty() {
  return (
    <Stack grow align="center" justify="center" gap="none">
      <Text tag="p" size="xl" tone="embossed">
        Message Santi
      </Text>
    </Stack>
  );
}

function TranscriptGroupView(props: {
  group: TranscriptGroup;
  items: ReturnType<typeof flattenTimelineItems>;
  soulIdentity: SoulIdentity;
}) {
  const { group, items, soulIdentity } = props;
  const identity = identityForGroup(group, items, soulIdentity);
  const groupItems = items.slice(group.start, group.end);
  let breakCursor = 0;

  return (
    <AnchoredContentGroup
      anchorLabel={identity.name}
      anchorSeed={identity.avatarSeed}
      divider={<Timestamp value={group.startedAt} size="xs" tone="subtle" />}
      side={group.side}
    >
      {groupItems.map((item, offset) => {
        const absoluteIndex = group.start + offset;
        const nextBreak = group.breaks[breakCursor];
        const divider =
          nextBreak?.before === absoluteIndex ? (
            <AnchoredContentGroupDivider key={`${group.id}:break:${absoluteIndex}`}>
              <Timestamp value={nextBreak.timestamp} size="xs" tone="subtle" />
            </AnchoredContentGroupDivider>
          ) : null;
        if (divider) {
          breakCursor += 1;
        }
        return (
          <Fragment key={item.id}>
            {divider}
            <TimelineItemView item={item} align={alignForSide(group.side)} />
          </Fragment>
        );
      })}
    </AnchoredContentGroup>
  );
}

function TurnStateNotices(props: { timeline: TurnGroup[] }) {
  return (
    <>
      {props.timeline.map((group) => {
        const turn = group.turn;
        if (turn?.status === "failed") {
          return (
            <Notice key={`${group.id}:failed`} tone="danger">
              <Stack gap="xs">
                <Text size="xs" tone="subtle">
                  TURN FAILED
                </Text>
                <Text>{turn.error_text ?? "The turn failed without an error message."}</Text>
              </Stack>
            </Notice>
          );
        }
        if (turn?.status === "running" && !group.items.length) {
          return (
            <Text key={`${group.id}:running`} size="sm" tone="subtle">
              Working…
            </Text>
          );
        }
        return null;
      })}
    </>
  );
}

function identityForGroup(
  group: TranscriptGroup,
  items: ReturnType<typeof flattenTimelineItems>,
  soulIdentity: SoulIdentity,
) {
  if (group.actor === "account") {
    const first = items[group.start];
    const actorId = first?.kind === "message" ? first.message.message.actor_id : "account";
    return {
      avatarSeed: `account:${actorId}`,
      name: "You",
    };
  }

  if (group.actor === "system") {
    return {
      avatarSeed: "system",
      name: "System",
    };
  }

  return {
    avatarSeed: soulIdentity.avatarSeed,
    name: soulIdentity.name,
  };
}

function alignForSide(side: TranscriptGroup["side"]) {
  return side === "end" ? "end" : "start";
}
