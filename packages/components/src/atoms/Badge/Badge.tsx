import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Badge.scss";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  size?: "sm" | "md";
  tone?: "neutral" | "accent" | "success" | "danger";
};

export function Badge({ className, size = "md", tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx("msBadge", `msBadge--size-${size}`, `msBadge--tone-${tone}`, className)}
    />
  );
}
