import type { TimelineItem, TurnGroup } from "@mini-stim/hooks";

export interface AnnotatedTimelineItem {
  item: TimelineItem;
  showIdentity: boolean;
}

export type AnnotatedTurnGroup = Omit<TurnGroup, "items"> & {
  items: AnnotatedTimelineItem[];
};

export function annotateIdentityGroups(groups: TurnGroup[]): AnnotatedTurnGroup[] {
  let previousIdentityKey: string | null = null;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const identityKey = messageIdentityKey(item);
      const showIdentity = identityKey === null || identityKey !== previousIdentityKey;
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
