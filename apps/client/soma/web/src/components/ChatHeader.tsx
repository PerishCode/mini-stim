import { Badge, Button, Inline, Input, Pane, Stack, Text } from "@mini-stim/components";
import { useEffect, useState } from "react";

export function ChatHeader(props: {
  activity: string;
  busy: boolean;
  connection: string;
  inspecting: boolean;
  onTitleCommit: (title: string | null) => void;
  onToggleInspect: () => void;
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
        <Stack gap="none" grow>
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
              block
              justify="start"
              size="sm"
              title={props.title}
              variant="ghost"
              disabled={!props.selectedSessionId}
              type="button"
              onClick={() => {
                if (props.selectedSessionId) {
                  setEditing(true);
                }
              }}
            >
              <Text size="lg" tone="strong" truncate>
                {props.title}
              </Text>
            </Button>
          )}
        </Stack>
        <Inline gap="sm" align="center" wrap>
          {props.busy ? (
            <Badge size="sm" tone="success">
              {props.activity}
            </Badge>
          ) : null}
          {props.connection === "error" ? (
            <Badge size="sm" tone="danger">
              reconnecting
            </Badge>
          ) : null}
          <Button
            size="sm"
            variant={props.inspecting ? "outline" : "ghost"}
            disabled={!props.selectedSessionId}
            type="button"
            onClick={props.onToggleInspect}
          >
            {props.inspecting ? "Close Inspect" : "Inspect"}
          </Button>
        </Inline>
      </Inline>
    </Pane>
  );
}

function normalizeTitle(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
