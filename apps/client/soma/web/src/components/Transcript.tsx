import { Notice, Stack, Text, useAppComponentRef } from "@mini-stim/components";
import type { TurnGroup } from "@mini-stim/hooks";

import { STIM_APP_NAMESPACE } from "../appNamespace";
import type { AnnotatedTurnGroup } from "../projections/identityGrouping";
import { annotateIdentityGroups } from "../projections/identityGrouping";
import { TimelineItemView } from "./TimelineItemView";

export interface SoulIdentity {
  avatarSeed: string;
  name: string;
}

export function Transcript(props: { soulIdentity: SoulIdentity; timeline: TurnGroup[] }) {
  const groups = annotateIdentityGroups(props.timeline);
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
    <Stack ref={transcriptRef} gap="lg" grow>
      {groups.map((group) => (
        <TurnGroupView key={group.id} group={group} soulIdentity={props.soulIdentity} />
      ))}
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

function TurnGroupView(props: { group: AnnotatedTurnGroup; soulIdentity: SoulIdentity }) {
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
            <Text size="xs" tone="subtle">
              TURN FAILED
            </Text>
            <Text>{turn.error_text ?? "The turn failed without an error message."}</Text>
          </Stack>
        </Notice>
      ) : null}
      {turn?.status === "running" && !group.items.length ? (
        <Text size="sm" tone="subtle">
          Working…
        </Text>
      ) : null}
    </Stack>
  );
}
