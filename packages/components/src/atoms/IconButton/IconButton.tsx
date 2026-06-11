import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../../internal/cx";
import "./IconButton.scss";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
  tone?: "neutral" | "accent";
};

export function IconButton({
  children,
  className,
  label,
  tone = "neutral",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx("msIconButton", `msIconButton--tone-${tone}`, className)}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
