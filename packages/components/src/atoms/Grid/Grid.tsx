import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Grid.scss";

type GridProps = ComponentPropsWithoutRef<"div"> & {
  gap?: "none" | "shell" | "sm" | "md";
  grow?: boolean;
  template?: "sidebar-main" | "sidebar-main-inspect";
};

type GridItemProps = ComponentPropsWithoutRef<"div"> & {
  area: "inspect" | "main" | "sidebar";
  tag?: "aside" | "div" | "main" | "section";
};

export function Grid({
  className,
  gap = "none",
  grow = false,
  template = "sidebar-main",
  ...props
}: GridProps) {
  return (
    <div
      {...props}
      className={cx(
        "msGrid",
        `msGrid--gap-${gap}`,
        `msGrid--template-${template}`,
        grow && "msGrid--grow",
        className,
      )}
    />
  );
}

export function GridItem({
  area,
  className,
  tag = "div",
  ...props
}: GridItemProps) {
  const Component = tag;
  return (
    <Component
      {...props}
      className={cx("msGrid__item", `msGrid__item--area-${area}`, className)}
    />
  );
}
