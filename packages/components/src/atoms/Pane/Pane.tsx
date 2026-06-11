import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Pane.scss";

type PaneProps = ComponentPropsWithoutRef<"div"> & {
  border?: "none" | "right" | "top" | "bottom" | "around";
  chrome?: "none" | "panel";
  grow?: boolean;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  tone?: "canvas" | "panel" | "raised" | "subtle";
};

export function Pane({
  border = "none",
  className,
  chrome = "none",
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
        `msPane--chrome-${chrome}`,
        `msPane--padding-${padding}`,
        `msPane--tone-${tone}`,
        grow && "msPane--grow",
        className,
      )}
    />
  );
}
