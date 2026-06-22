import type { ComponentPropsWithRef } from "react";

import { cx } from "../../internal/cx";
import "./Stack.scss";

type StackProps = ComponentPropsWithRef<"div"> & {
  align?: "start" | "center" | "stretch";
  gap?: "none" | "xs" | "sm" | "md" | "lg";
  grow?: boolean;
  justify?: "start" | "center" | "between";
  tag?: "div" | "span";
};

export function Stack({
  align = "stretch",
  className,
  gap = "md",
  grow = false,
  justify = "start",
  tag = "div",
  ...props
}: StackProps) {
  const Component = tag;
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
