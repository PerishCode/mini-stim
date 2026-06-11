import {
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";

import { cx } from "../../internal/cx";
import "./TextArea.scss";

type TextAreaAutosize =
  | boolean
  | {
      max: number;
      min: number;
    };

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autosizeConfig = resolveAutosize(autosize);
  const resolvedRows = autosizeConfig?.min ?? rows;

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element || !autosizeConfig) {
      return;
    }

    const computed = window.getComputedStyle(element);
    const borderBox =
      parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth);
    const paddingBox =
      parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
    const lineHeight = parseFloat(computed.lineHeight);

    if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
      return;
    }

    const minHeight = lineHeight * autosizeConfig.min + paddingBox + borderBox;
    const maxHeight = lineHeight * autosizeConfig.max + paddingBox + borderBox;

    element.style.height = "auto";
    const nextHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [autosizeConfig, value]);

  return (
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
}

function resolveAutosize(input: TextAreaAutosize) {
  if (!input) {
    return null;
  }

  if (input === true) {
    return { min: 1, max: 6 };
  }

  const min = Number.isFinite(input.min) ? Math.max(1, Math.floor(input.min)) : 1;
  const max = Number.isFinite(input.max)
    ? Math.max(min, Math.floor(input.max))
    : Math.max(min, 6);

  return { min, max };
}
