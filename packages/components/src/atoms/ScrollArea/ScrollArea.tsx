import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./ScrollArea.scss";

type ScrollAreaProps = ComponentPropsWithoutRef<"div"> & {
  axis?: "y" | "x" | "both";
  grow?: boolean;
};

export function ScrollArea({ axis = "y", className, grow = false, ...props }: ScrollAreaProps) {
  return (
    <div
      {...props}
      className={cx(
        "msScrollArea",
        `msScrollArea--${axis}`,
        grow && "msScrollArea--grow",
        className,
      )}
    />
  );
}
