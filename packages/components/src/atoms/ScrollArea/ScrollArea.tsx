import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./ScrollArea.scss";

type ScrollAreaProps = ComponentPropsWithoutRef<"div"> & {
  axis?: "y" | "x" | "both";
  grow?: boolean;
  tone?: "none" | "inset";
};

export function ScrollArea({
  axis = "y",
  className,
  grow = false,
  tone = "none",
  ...props
}: ScrollAreaProps) {
  return (
    <div
      {...props}
      className={cx(
        "msScrollArea",
        `msScrollArea--${axis}`,
        `msScrollArea--tone-${tone}`,
        grow && "msScrollArea--grow",
        className,
      )}
    />
  );
}
