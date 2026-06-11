import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./GridRows.scss";

type GridRowsProps = ComponentPropsWithoutRef<"div"> & {
  gap?: "none" | "sm" | "md";
  grow?: boolean;
  template?: "header-body" | "header-body-footer";
};

export function GridRows({
  className,
  gap = "none",
  grow = false,
  template = "header-body",
  ...props
}: GridRowsProps) {
  return (
    <div
      {...props}
      className={cx(
        "msGridRows",
        `msGridRows--gap-${gap}`,
        `msGridRows--template-${template}`,
        grow && "msGridRows--grow",
        className,
      )}
    />
  );
}
