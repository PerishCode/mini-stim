import { Button, FieldActionLayout, TextArea } from "@mini-stim/components";

export function Composer(props: {
  disabled?: boolean;
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
      <FieldActionLayout
        actionWidth="lg"
        action={(
          <Button
            type="submit"
            tone="accent"
            size="lg"
            disabled={props.disabled || !props.value.trim()}
          >
            Send
          </Button>
        )}
      >
        <TextArea
          autosize={{ min: 1, max: 6 }}
          value={props.value}
          disabled={props.disabled}
          placeholder="Message mini-stim and press Enter"
          resize="none"
          variant="composer"
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
      </FieldActionLayout>
    </form>
  );
}
