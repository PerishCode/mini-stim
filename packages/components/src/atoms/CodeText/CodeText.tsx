import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../../internal/cx";
import { type CodeLanguage, HighlightedCode } from "../CodeBlock/codeHighlight";
import "./CodeText.scss";

type CodeTextProps = ComponentPropsWithoutRef<"code"> & {
  language?: CodeLanguage;
  truncate?: boolean;
};

export function CodeText({
  children,
  className,
  language,
  truncate = false,
  ...props
}: CodeTextProps) {
  return (
    <code {...props} className={cx("msCodeText", truncate && "msCodeText--truncate", className)}>
      {language && typeof children === "string" ? (
        <HighlightedCode language={language}>{children}</HighlightedCode>
      ) : (
        children
      )}
    </code>
  );
}
