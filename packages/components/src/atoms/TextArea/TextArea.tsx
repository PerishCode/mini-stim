import type { TextareaHTMLAttributes } from "react";

import { cx } from "../../internal/cx";
import "./TextArea.scss";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  resize?: "none" | "vertical";
};

export function TextArea({
  className,
  resize = "vertical",
  rows = 3,
  ...props
}: TextAreaProps) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={cx("msTextArea", `msTextArea--resize-${resize}`, className)}
    />
  );
}
