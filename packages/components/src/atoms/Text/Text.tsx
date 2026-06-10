import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Text.scss";

type TextProps = ComponentPropsWithoutRef<"span"> & {
  as?: "p" | "span" | "small";
  size?: "sm" | "md";
  tone?: "default" | "muted";
  truncate?: boolean;
};

export function Text({
  as: Component = "span",
  className,
  size = "md",
  tone = "default",
  truncate = false,
  ...props
}: TextProps) {
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
