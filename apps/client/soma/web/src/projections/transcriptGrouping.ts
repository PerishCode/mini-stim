import type { TimelineItem, TurnGroup } from "@mini-stim/hooks";

export type TranscriptActor = "account" | "soul" | "system";
export type TranscriptSide = "start" | "end";

export interface TranscriptBreak {
  before: number;
  timestamp: string;
}

export interface TranscriptGroup {
  actor: TranscriptActor;
  breaks: TranscriptBreak[];
  end: number;
  id: string;
  side: TranscriptSide;
  start: number;
  startedAt: string;
}

type MutableTranscriptGroup = TranscriptGroup & {
  lastSeenAt: string;
};

const TRANSCRIPT_GROUP_GAP_MS = 5 * 60 * 1000;

export function flattenTimelineItems(groups: TurnGroup[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      items.push(item);
    }
  }
  return items;
}

export function buildTranscriptGroups(items: TimelineItem[]): TranscriptGroup[] {
  const groups: MutableTranscriptGroup[] = [];
  let current: MutableTranscriptGroup | undefined;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const actor = actorForItem(item);
    const timestamp = item.createdAt;

    if (!current || current.actor !== actor) {
      current = acquireTranscriptGroup(groups, item, index, actor);
      continue;
    }

    if (isLongGap(current.lastSeenAt, timestamp)) {
      current.breaks.push({ before: index, timestamp });
    }

    current.end = index + 1;
    current.lastSeenAt = timestamp;
  }

  return groups.map(({ lastSeenAt: _lastSeenAt, ...group }) => group);
}

function acquireTranscriptGroup(
  groups: MutableTranscriptGroup[],
  item: TimelineItem,
  index: number,
  actor: TranscriptActor,
): MutableTranscriptGroup {
  const group: MutableTranscriptGroup = {
    actor,
    breaks: [],
    end: index + 1,
    id: `${actor}:${index}:${item.id}`,
    side: sideForActor(actor),
    start: index,
    startedAt: item.createdAt,
    lastSeenAt: item.createdAt,
  };
  groups.push(group);
  return group;
}

function actorForItem(item: TimelineItem): TranscriptActor {
  if (item.kind !== "message") {
    return "soul";
  }

  switch (item.message.message.actor_type) {
    case "account":
      return "account";
    case "system":
      return "system";
    default:
      return "soul";
  }
}

function sideForActor(actor: TranscriptActor): TranscriptSide {
  return actor === "account" ? "end" : "start";
}

function isLongGap(previous: string, next: string): boolean {
  const previousMs = Date.parse(previous);
  const nextMs = Date.parse(next);
  if (!Number.isFinite(previousMs) || !Number.isFinite(nextMs)) {
    return false;
  }
  return nextMs - previousMs > TRANSCRIPT_GROUP_GAP_MS;
}
