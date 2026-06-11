import type { InputHTMLAttributes } from "react";

import { cx } from "../../internal/cx";
import "./Input.scss";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "title";
};

export function Input({
  className,
  type = "text",
  variant = "default",
  ...props
}: InputProps) {
  return (
    <input
      {...props}
      type={type}
      className={cx("msInput", `msInput--variant-${variant}`, className)}
    />
  );
}
