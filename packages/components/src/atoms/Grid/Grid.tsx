import type { ComponentPropsWithoutRef, CSSProperties } from "react";

import { cx } from "../../internal/cx";
import "./Grid.scss";

type GridProps = ComponentPropsWithoutRef<"div"> & {
  gap?: "none" | "shell" | "sm" | "md";
  grow?: boolean;
  inspectWidthPx?: number | null;
  sidebarWidthPx?: number | null;
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
  inspectWidthPx = null,
  sidebarWidthPx = null,
  style,
  template = "sidebar-main",
  ...props
}: GridProps) {
  const gridStyle = {
    ...style,
    ...(sidebarWidthPx ? { "--ms-grid-sidebar-width": `${sidebarWidthPx}px` } : null),
    ...(inspectWidthPx ? { "--ms-grid-inspect-width": `${inspectWidthPx}px` } : null),
  } as CSSProperties;
  return (
    <div
      {...props}
      style={gridStyle}
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
