import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./ResizeHandle.scss";

type ResizeHandleProps = ComponentPropsWithoutRef<"button"> & {
  placement: "end" | "start";
};

export function ResizeHandle({
  className,
  placement,
  type = "button",
  ...props
}: ResizeHandleProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx("msResizeHandle", `msResizeHandle--placement-${placement}`, className)}
    />
  );
}
