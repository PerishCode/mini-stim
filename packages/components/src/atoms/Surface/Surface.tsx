import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Surface.scss";

type SurfaceProps = ComponentPropsWithoutRef<"div"> & {
  align?: "start" | "center" | "end" | "stretch";
  padding?: "sm" | "md" | "lg";
  tone?: "default" | "accent" | "muted" | "success" | "warning" | "danger";
  width?: "full" | "content";
};

export function Surface({
  align = "stretch",
  className,
  padding = "md",
  tone = "default",
  width = "full",
  ...props
}: SurfaceProps) {
  return (
    <div
      {...props}
      className={cx(
        "msSurface",
        `msSurface--padding-${padding}`,
        `msSurface--tone-${tone}`,
        `msSurface--align-${align}`,
        `msSurface--width-${width}`,
        className,
      )}
    />
  );
}
