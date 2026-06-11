import { type TextareaHTMLAttributes } from "react";

import { cx } from "../../internal/cx";
import {
  type TextAreaAutosize,
  useTextAreaAutosize,
} from "./hooks/useTextAreaAutosize";
import "./TextArea.scss";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autosize?: TextAreaAutosize;
  resize?: "none" | "vertical";
  variant?: "default" | "composer";
};

export function TextArea({
  autosize = false,
  className,
  resize = "vertical",
  variant = "default",
  rows = 3,
  style,
  value,
  ...props
}: TextAreaProps) {
  const { autosizeConfig, frameElementRef, resolvedRows, textareaRef } =
    useTextAreaAutosize({
      autosize,
      rows,
      value,
    });

  const textarea = (
    <textarea
      {...props}
      ref={textareaRef}
      rows={resolvedRows}
      value={value}
      style={style}
      className={cx(
        "msTextArea",
        autosizeConfig && "msTextArea--autosize",
        `msTextArea--resize-${resize}`,
        `msTextArea--variant-${variant}`,
        className,
      )}
    />
  );

  if (!autosizeConfig) {
    return textarea;
  }

  return (
    <div ref={frameElementRef} className="msTextAreaFrame">
      {textarea}
    </div>
  );
}
