import { describe, expect, test } from "vitest";
import type { TimelineItem, TurnGroup } from "@mini-stim/hooks";

import { annotateIdentityGroups } from "@web/projections/identityGrouping";

describe("annotateIdentityGroups", () => {
  test("elides consecutive messages from the same identity", () => {
    const result = annotateIdentityGroups([
      group("group", [
        messageItem("msg_1", "account", "account_local", 1),
        messageItem("msg_2", "account", "account_local", 2),
        messageItem("msg_3", "account", "account_local", 3),
      ]),
    ]);

    expect(identityFlags(result)).toEqual([true, false, false]);
  });

  test("shows identity again when the actor changes", () => {
    const result = annotateIdentityGroups([
      group("group", [
        messageItem("msg_1", "account", "account_local", 1),
        messageItem("msg_2", "soul", "soul_default", 2),
        messageItem("msg_3", "account", "account_local", 3),
      ]),
    ]);

    expect(identityFlags(result)).toEqual([true, true, true]);
  });

  test("resets continuity after non-message timeline items", () => {
    const result = annotateIdentityGroups([
      group("group", [
        messageItem("msg_1", "soul", "soul_default", 1),
        toolCallItem("call_1", 2),
        messageItem("msg_2", "soul", "soul_default", 3),
      ]),
    ]);

    expect(identityFlags(result)).toEqual([true, true, true]);
  });

  test("preserves identity continuity across turn groups", () => {
    const result = annotateIdentityGroups([
      group("group_1", [messageItem("msg_1", "account", "account_local", 1)]),
      group("group_2", [messageItem("msg_2", "account", "account_local", 2)]),
    ]);

    expect(identityFlags(result)).toEqual([true, false]);
  });
});

function identityFlags(groups: ReturnType<typeof annotateIdentityGroups>) {
  return groups.flatMap((group) => group.items.map((item) => item.showIdentity));
}

function group(id: string, items: TimelineItem[]): TurnGroup {
  return {
    id,
    sessionId: "sess_test",
    createdAt: stamp(0),
    items,
  };
}

function messageItem(
  id: string,
  actorType: "account" | "soul" | "system",
  actorId: string,
  seq: number,
): TimelineItem {
  return {
    kind: "message",
    id,
    sessionId: "sess_test",
    createdAt: stamp(seq),
    message: {
      content_text: id,
      relation: {
        session_id: "sess_test",
        message_id: id,
        session_seq: seq,
        created_at: stamp(seq),
      },
      message: {
        id,
        actor_type: actorType,
        actor_id: actorId,
        content: { parts: [{ type: "text", text: id }] },
        state: "fixed",
        version: 1,
        deleted_at: null,
        created_at: stamp(seq),
        updated_at: stamp(seq),
      },
    },
  };
}

function toolCallItem(id: string, seq: number): TimelineItem {
  return {
    kind: "tool_call",
    id,
    sessionId: "sess_test",
    createdAt: stamp(seq),
    toolCall: {
      id,
      turn_id: "turn_test",
      tool_name: "shell",
      arguments: { command: "true" },
      created_at: stamp(seq),
    },
  };
}

function stamp(seq: number) {
  return `2026-06-12T00:00:${String(seq).padStart(2, "0")}.000Z`;
}
