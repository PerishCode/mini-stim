import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Heading.scss";

type HeadingProps = ComponentPropsWithoutRef<"h1"> & {
  size?: "sm" | "md" | "lg";
  tag?: "h1" | "h2" | "h3";
  truncate?: boolean;
};

export function Heading({
  className,
  size = "md",
  tag = "h2",
  truncate = false,
  ...props
}: HeadingProps) {
  const Component = tag;
  return (
    <Component
      {...props}
      className={cx(
        "msHeading",
        `msHeading--size-${size}`,
        truncate && "msHeading--truncate",
        className,
      )}
    />
  );
}
