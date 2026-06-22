import type { ComponentPropsWithRef } from "react";

import { cx } from "../../internal/cx";
import "./Pane.scss";

type PaneProps = ComponentPropsWithRef<"div"> & {
  border?: "none" | "right" | "top" | "bottom" | "around";
  chrome?: "none" | "panel";
  grow?: boolean;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  tone?: "canvas" | "panel" | "workspace" | "raised" | "subtle";
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
