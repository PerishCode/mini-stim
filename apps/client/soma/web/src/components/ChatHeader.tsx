import { useEffect, useState } from "react";

import {
  Badge,
  Button,
  Input,
  Inline,
  Pane,
  Stack,
  Text,
} from "@mini-stim/components";

export function ChatHeader(props: {
  busy: boolean;
  connection: string;
  onTitleCommit: (title: string | null) => void;
  selectedSessionId: string | null;
  title: string;
  titleValue: string | null;
}) {
  const [draft, setDraft] = useState(props.title);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(props.title);
    }
  }, [editing, props.title]);

  function commit() {
    if (!props.selectedSessionId) {
      setEditing(false);
      return;
    }
    const normalized = normalizeTitle(draft);
    setEditing(false);
    if (normalized === normalizeTitle(props.titleValue ?? null)) {
      setDraft(props.title);
      return;
    }
    props.onTitleCommit(normalized);
  }

  return (
    <Pane padding="lg">
      <Inline justify="between" align="start" wrap gap="md">
        <Stack gap="xs">
          <Text size="xs" tone="subtle">SESSION</Text>
          {editing ? (
            <Input
              autoFocus
              value={draft}
              variant="title"
              onBlur={commit}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setEditing(false);
                  setDraft(props.title);
                }
              }}
            />
          ) : (
            <Button
              justify="start"
              size="sm"
              variant="ghost"
              disabled={!props.selectedSessionId}
              type="button"
              onClick={() => {
                if (props.selectedSessionId) {
                  setEditing(true);
                }
              }}
            >
              <Text size="lg" tone="strong">
                {props.title}
              </Text>
            </Button>
          )}
        </Stack>
        <Inline gap="sm" wrap>
          <Badge size="sm" tone={props.busy ? "success" : "neutral"}>
            {props.busy ? "sending" : "idle"}
          </Badge>
          {props.selectedSessionId ? <Badge size="sm" tone="accent">{props.connection}</Badge> : null}
          {!props.selectedSessionId ? <Badge size="sm">new</Badge> : null}
        </Inline>
      </Inline>
    </Pane>
  );
}

function normalizeTitle(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
