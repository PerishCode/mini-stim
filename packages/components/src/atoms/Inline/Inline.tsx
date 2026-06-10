import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Inline.scss";

type InlineProps = ComponentPropsWithoutRef<"div"> & {
  align?: "start" | "center" | "end" | "stretch";
  as?: "div" | "span";
  gap?: "xs" | "sm" | "md" | "lg";
  grow?: boolean;
  justify?: "start" | "center" | "between" | "end";
  wrap?: boolean;
};

export function Inline({
  align = "center",
  as: Component = "div",
  className,
  gap = "md",
  grow = false,
  justify = "start",
  wrap = false,
  ...props
}: InlineProps) {
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
