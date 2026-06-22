import Prism from "prismjs";
import type { ReactNode } from "react";
import "prismjs/components/prism-bash";

export type CodeLanguage = "bash" | "shell";

export function HighlightedCode(props: { children: string; language: CodeLanguage }) {
  const normalizedLanguage = normalizeCodeLanguage(props.language);
  const grammar = Prism.languages[normalizedLanguage];

  if (!grammar) {
    return props.children;
  }

  return renderTokenStream(Prism.tokenize(props.children, grammar));
}

export function normalizeCodeLanguage(language: CodeLanguage) {
  switch (language) {
    case "bash":
    case "shell":
      return "bash";
  }
}

function renderTokenStream(tokenStream: Prism.TokenStream, keyPrefix = "token"): ReactNode {
  if (typeof tokenStream === "string") {
    return tokenStream;
  }
  if (Array.isArray(tokenStream)) {
    return tokenStream.map((token, index) => renderTokenStream(token, `${keyPrefix}-${index}`));
  }

  return (
    <span key={keyPrefix} className={tokenClassName(tokenStream)}>
      {renderTokenStream(tokenStream.content, `${keyPrefix}-content`)}
    </span>
  );
}

function tokenClassName(token: Prism.Token) {
  const aliases = Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : [];
  return ["token", token.type, ...aliases].join(" ");
}
