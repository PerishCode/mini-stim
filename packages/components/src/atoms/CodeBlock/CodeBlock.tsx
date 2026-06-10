import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./CodeBlock.scss";

type CodeBlockProps = ComponentPropsWithoutRef<"pre">;

export function CodeBlock({ className, ...props }: CodeBlockProps) {
  return <pre {...props} className={cx("msCodeBlock", className)} />;
}
