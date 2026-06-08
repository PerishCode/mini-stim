import type { ReactNode } from "react";

export function IconButton(props: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={props.type ?? "button"}
      className="iconButton"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function Composer(props: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <textarea
        value={props.value}
        disabled={props.disabled}
        placeholder="Message"
        rows={3}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      />
      <IconButton
        type="submit"
        label="Send"
        disabled={props.disabled || !props.value.trim()}
      >
        <span aria-hidden="true">↑</span>
      </IconButton>
    </form>
  );
}
