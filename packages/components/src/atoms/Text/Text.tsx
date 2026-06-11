import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Text.scss";

type TextProps = ComponentPropsWithoutRef<"span"> & {
  // `dateTime` is only meaningful on tag="time"; allow it without widening the
  // whole prop surface to a polymorphic union.
  dateTime?: string;
  size?: "xs" | "sm" | "md" | "lg";
  tag?: "p" | "span" | "small" | "time";
  tone?: "default" | "strong" | "muted" | "subtle";
  truncate?: boolean;
};

export function Text({
  className,
  size = "md",
  tag = "span",
  tone = "default",
  truncate = false,
  ...props
}: TextProps) {
  const Component = tag;
  return (
    <Component
      {...props}
      className={cx(
        "msText",
        `msText--size-${size}`,
        `msText--tone-${tone}`,
        truncate && "msText--truncate",
        className,
      )}
    />
  );
}
