import {
  Button,
  FieldActionLayout,
  Notice,
  SendIcon,
  Stack,
  Text,
  TextArea,
  useAppComponentRef,
} from "@mini-stim/components";

import { STIM_APP_NAMESPACE } from "../appNamespace";

export function Composer(props: {
  disabled?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  value: string;
}) {
  const composerRef = useAppComponentRef({
    domain: "message",
    id: "composer",
    kind: "control",
    label: "Composer",
    namespace: STIM_APP_NAMESPACE,
    projection: "input",
    surface: "chat shell",
  });

  return (
    <form
      ref={composerRef}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <Stack gap="sm">
        {props.error ? (
          <Notice tone="danger">
            <Text>{props.error}</Text>
          </Notice>
        ) : null}
        <FieldActionLayout
          action={
            <Button
              type="submit"
              tone="accent"
              size="lg"
              disabled={props.disabled || !props.value.trim()}
            >
              <SendIcon size="sm" />
              Send
            </Button>
          }
        >
          <Stack grow gap="none">
            <TextArea
              autosize={{ min: 1, max: 6 }}
              value={props.value}
              disabled={props.disabled}
              placeholder="Message Santi"
              resize="none"
              variant="composer"
              onChange={(event) => props.onChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
                  return;
                }
                event.preventDefault();
                if (!props.disabled && props.value.trim()) {
                  props.onSubmit();
                }
              }}
            />
          </Stack>
        </FieldActionLayout>
      </Stack>
    </form>
  );
}
