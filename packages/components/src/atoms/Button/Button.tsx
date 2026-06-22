import type { ComponentPropsWithRef } from "react";

import { cx } from "../../internal/cx";
import "./Button.scss";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  block?: boolean;
  justify?: "center" | "start" | "between";
  size?: "sm" | "md" | "lg";
  tone?: "neutral" | "accent";
  variant?: "solid" | "outline" | "ghost" | "selected" | "rail" | "rail-selected";
};

export function Button({
  block = false,
  className,
  justify = "center",
  size = "md",
  tone = "neutral",
  type = "button",
  variant = "solid",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx(
        "msButton",
        `msButton--size-${size}`,
        `msButton--tone-${tone}`,
        `msButton--variant-${variant}`,
        `msButton--justify-${justify}`,
        block && "msButton--block",
        className,
      )}
    />
  );
}
