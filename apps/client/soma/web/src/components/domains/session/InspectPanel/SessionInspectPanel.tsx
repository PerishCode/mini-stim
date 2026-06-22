import {
  Badge,
  CodeBlock,
  Inline,
  Pane,
  Stack,
  Surface,
  Text,
  Timestamp,
  useAppComponentRef,
} from "@mini-stim/components";
import type { SessionRuntimeSnapshot } from "@mini-stim/hooks";
import type { ReactNode } from "react";

import { STIM_APP_NAMESPACE } from "../../../../appNamespace";

export function SessionInspectPanel(props: { runtime: SessionRuntimeSnapshot }) {
  const { runtime } = props;
  const memory = runtime.soul_session?.session_memory.trim() ?? "";

  return (
    <Stack gap="lg" grow>
      <InspectSection
        title="SESSION"
        aside={<Timestamp value={runtime.session.created_at} size="xs" tone="subtle" />}
      >
        <Stack gap="xs">
          <Text size="sm" tone="strong">
            {runtime.profile.title?.trim() || runtime.session.id}
          </Text>
          {runtime.profile.desc ? <Text size="sm">{runtime.profile.desc}</Text> : null}
        </Stack>
      </InspectSection>

      <InspectSection
        title="SESSION MEMORY"
        aside={
          runtime.soul_session ? (
            <Text size="xs" tone="subtle">
              seen through seq {runtime.soul_session.last_seen_session_seq}
            </Text>
          ) : null
        }
      >
        {memory ? (
          <CodeBlock>{memory}</CodeBlock>
        ) : (
          <Text size="sm" tone="muted">
            The agent has not written any session memory yet.
          </Text>
        )}
      </InspectSection>

      <InspectSection title="COMPACTS">
        {runtime.compacts.length ? (
          runtime.compacts.map((compact) => (
            <Pane key={compact.id} border="around" padding="md" tone="panel">
              <Stack gap="xs">
                <Inline justify="between" align="center" wrap gap="sm">
                  <Text size="xs" tone="subtle">
                    replaces seq {compact.start_session_seq}-{compact.end_session_seq}
                  </Text>
                  <Timestamp value={compact.created_at} size="xs" tone="subtle" />
                </Inline>
                <Text size="sm">{compact.summary}</Text>
              </Stack>
            </Pane>
          ))
        ) : (
          <Text size="sm" tone="muted">
            No context compaction has happened in this session.
          </Text>
        )}
      </InspectSection>

      <InspectSection title="EFFECTS">
        {runtime.effects.length ? (
          runtime.effects.map((effect) => (
            <Inline key={effect.id} justify="between" align="center" wrap gap="sm">
              <Text size="sm">{effect.effect_type}</Text>
              <Badge size="sm" tone={effect.error_text ? "danger" : "neutral"}>
                {effect.status}
              </Badge>
            </Inline>
          ))
        ) : (
          <Text size="sm" tone="muted">
            No hook effects recorded in this session.
          </Text>
        )}
      </InspectSection>
    </Stack>
  );
}

function InspectSection(props: { aside?: ReactNode; children: ReactNode; title: string }) {
  const sectionRef = useAppComponentRef({
    domain: "session",
    id: `inspect-${slugTitle(props.title)}`,
    kind: "section",
    label: `Inspect ${titleCase(props.title)}`,
    namespace: STIM_APP_NAMESPACE,
    projection: titleCase(props.title),
    surface: "inspect panel",
  });

  return (
    <Surface ref={sectionRef} padding="md" tone="muted">
      <Stack gap="sm">
        <Inline justify="between" align="center" gap="sm">
          <Text size="xs" tone="subtle">
            {props.title}
          </Text>
          {props.aside}
        </Inline>
        {props.children}
      </Stack>
    </Surface>
  );
}

function slugTitle(title: string) {
  return title.toLowerCase().replaceAll(/\s+/g, "-");
}

function titleCase(title: string) {
  return title
    .toLowerCase()
    .split(/\s+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
