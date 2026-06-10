import { IconButton, Inline, TextArea } from "@mini-stim/components";

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
      <Inline align="end" gap="sm">
        <TextArea
          value={props.value}
          disabled={props.disabled}
          placeholder="Message"
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
        <IconButton
          type="submit"
          label="Send"
          disabled={props.disabled || !props.value.trim()}
        >
          <span aria-hidden="true">↑</span>
        </IconButton>
      </Inline>
    </form>
  );
}
