import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Notice.scss";

type NoticeProps = ComponentPropsWithoutRef<"div"> & {
  tone?: "neutral" | "danger";
};

export function Notice({
  className,
  tone = "neutral",
  ...props
}: NoticeProps) {
  return (
    <div
      {...props}
      className={cx("msNotice", `msNotice--tone-${tone}`, className)}
    />
  );
}
