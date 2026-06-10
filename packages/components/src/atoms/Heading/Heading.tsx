import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Heading.scss";

type HeadingProps = ComponentPropsWithoutRef<"h1"> & {
  as?: "h1" | "h2" | "h3";
  size?: "sm" | "md" | "lg";
  truncate?: boolean;
};

export function Heading({
  as: Component = "h2",
  className,
  size = "md",
  truncate = false,
  ...props
}: HeadingProps) {
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
