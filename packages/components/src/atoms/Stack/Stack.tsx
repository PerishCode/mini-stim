import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./Stack.scss";

type StackProps = ComponentPropsWithoutRef<"div"> & {
  align?: "start" | "center" | "stretch";
  as?: "div" | "span";
  gap?: "xs" | "sm" | "md" | "lg";
  grow?: boolean;
  justify?: "start" | "center" | "between";
};

export function Stack({
  align = "stretch",
  as: Component = "div",
  className,
  gap = "md",
  grow = false,
  justify = "start",
  ...props
}: StackProps) {
  return (
    <Component
      {...props}
      className={cx(
        "msStack",
        `msStack--gap-${gap}`,
        `msStack--align-${align}`,
        `msStack--justify-${justify}`,
        grow && "msStack--grow",
        className,
      )}
    />
  );
}
