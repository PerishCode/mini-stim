import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "../../internal/cx";
import "./IconButton.scss";

type IconButtonProps = ComponentPropsWithRef<"button"> & {
  children: ReactNode;
  label: string;
  size?: "sm" | "md";
  tone?: "neutral" | "accent";
  variant?: "solid" | "ghost";
};

export function IconButton({
  children,
  className,
  label,
  size = "md",
  tone = "neutral",
  type = "button",
  variant = "solid",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx(
        "msIconButton",
        `msIconButton--size-${size}`,
        `msIconButton--tone-${tone}`,
        `msIconButton--variant-${variant}`,
        className,
      )}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
