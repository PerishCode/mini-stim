import { Button, Inline, Notice, SendIcon, Stack, Text, TextArea } from "@mini-stim/components";

export function Composer(props: {
  disabled?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  value: string;
}) {
  return (
    <form
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
        <Inline align="stretch" gap="sm">
          <Stack grow gap="none">
            <TextArea
              autosize={{ min: 1, max: 6 }}
              value={props.value}
              disabled={props.disabled}
              placeholder="Message mini-stim and press Enter"
              resize="none"
              variant="composer"
              onChange={(event) => props.onChange(event.currentTarget.value)}
            />
          </Stack>
          <Button
            type="submit"
            tone="accent"
            size="lg"
            disabled={props.disabled || !props.value.trim()}
          >
            <SendIcon size="sm" />
            Send
          </Button>
        </Inline>
      </Stack>
    </form>
  );
}
