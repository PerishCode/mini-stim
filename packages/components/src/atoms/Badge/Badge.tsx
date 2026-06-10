import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Badge.scss";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: "neutral" | "success" | "danger";
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={cx("msBadge", `msBadge--tone-${tone}`, className)}
    />
  );
}
