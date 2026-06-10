import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Pane.scss";

type PaneProps = ComponentPropsWithoutRef<"div"> & {
  border?: "none" | "right" | "top" | "bottom" | "around";
  grow?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  tone?: "canvas" | "panel" | "subtle";
};

export function Pane({
  border = "none",
  className,
  grow = false,
  padding = "none",
  tone = "canvas",
  ...props
}: PaneProps) {
  return (
    <div
      {...props}
      className={cx(
        "msPane",
        `msPane--border-${border}`,
        `msPane--padding-${padding}`,
        `msPane--tone-${tone}`,
        grow && "msPane--grow",
        className,
      )}
    />
  );
}
