import type { ButtonHTMLAttributes } from "react";

import { cx } from "../../internal/cx";
import "./Pressable.scss";

type PressableProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  display?: "block" | "inline";
};

export function Pressable({
  className,
  display = "block",
  type = "button",
  ...props
}: PressableProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx("msPressable", `msPressable--display-${display}`, className)}
    />
  );
}
