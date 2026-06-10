import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../../internal/cx";
import "./IconButton.scss";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
};

export function IconButton({
  children,
  className,
  label,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx("msIconButton", className)}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
