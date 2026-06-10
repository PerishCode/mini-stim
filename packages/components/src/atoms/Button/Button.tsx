import type { ButtonHTMLAttributes } from "react";

import { cx } from "../../internal/cx";
import "./Button.scss";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  block?: boolean;
  justify?: "center" | "start" | "between";
  size?: "sm" | "md";
  tone?: "neutral" | "accent";
  variant?: "solid" | "outline" | "ghost" | "selected";
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
