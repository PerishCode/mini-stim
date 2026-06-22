import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cx } from "../../internal/cx";
import { CodeBlock } from "../CodeBlock/CodeBlock";
import type { CodeLanguage } from "../CodeBlock/codeHighlight";
import { CodeText } from "../CodeText/CodeText";
import "./MarkdownText.scss";

type MarkdownTextProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: string;
  tone?: "default" | "strong";
};

export function MarkdownText({
  children,
  className,
  tone = "default",
  ...props
}: MarkdownTextProps) {
  return (
    <div {...props} className={cx("msMarkdownText", `msMarkdownText--tone-${tone}`, className)}>
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

const markdownComponents: Components = {
  a({ children, href }) {
    return (
      <a
        href={href}
        onClick={stopMessageActivation}
        rel="noreferrer"
        target={href ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return <blockquote>{children}</blockquote>;
  },
  code({ children, className }) {
    const source = textFromChildren(children).replace(/\n$/, "");
    const language = languageFromClassName(className);
    if (className?.startsWith("language-")) {
      return <CodeBlock language={language}>{source}</CodeBlock>;
    }
    return <CodeText>{children}</CodeText>;
  },
  img({ alt, src }) {
    if (src) {
      return (
        <a href={src} onClick={stopMessageActivation} rel="noreferrer" target="_blank">
          {alt || src}
        </a>
      );
    }
    return <span>{alt}</span>;
  },
  input({ checked, type }) {
    if (type !== "checkbox") {
      return null;
    }
    return <input checked={Boolean(checked)} disabled readOnly tabIndex={-1} type="checkbox" />;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  table({ children }) {
    return (
      <div className="msMarkdownText__tableScroll">
        <table>{children}</table>
      </div>
    );
  },
};

function stopMessageActivation(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function languageFromClassName(className?: string): CodeLanguage | undefined {
  const match = className?.match(/(?:^|\s)language-(\S+)/);
  switch (match?.[1]) {
    case "bash":
    case "sh":
    case "shell":
      return "shell";
    default:
      return undefined;
  }
}

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join("");
  }
  return "";
}
