import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import { type CodeLanguage, HighlightedCode } from "./codeHighlight";
import "./CodeBlock.scss";

type CodeBlockProps = ComponentPropsWithoutRef<"pre"> & {
  language?: CodeLanguage;
};

export function CodeBlock({ children, className, language, ...props }: CodeBlockProps) {
  return (
    <pre {...props} className={cx("msCodeBlock", className)}>
      {language && typeof children === "string" ? (
        <code className={`language-${language}`}>
          <HighlightedCode language={language}>{children}</HighlightedCode>
        </code>
      ) : (
        children
      )}
    </pre>
  );
}
