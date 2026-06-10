import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Inline.scss";

type InlineProps = ComponentPropsWithoutRef<"div"> & {
  align?: "start" | "center" | "end" | "stretch";
  gap?: "xs" | "sm" | "md" | "lg";
  grow?: boolean;
  justify?: "start" | "center" | "between" | "end";
  tag?: "div" | "span";
  wrap?: boolean;
};

export function Inline({
  align = "center",
  className,
  gap = "md",
  grow = false,
  justify = "start",
  tag = "div",
  wrap = false,
  ...props
}: InlineProps) {
  const Component = tag;
  return (
    <Component
      {...props}
      className={cx(
        "msInline",
        `msInline--gap-${gap}`,
        `msInline--align-${align}`,
        `msInline--justify-${justify}`,
        grow && "msInline--grow",
        wrap && "msInline--wrap",
        className,
      )}
    />
  );
}
