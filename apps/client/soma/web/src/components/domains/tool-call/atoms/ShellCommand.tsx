import { CodeBlock, CodeText } from "@mini-stim/components";

import { truncateMiddle } from "../model/toolCallModel";

export function ShellCommand(props: {
  command: string;
  maxChars?: number;
  presentation: "block" | "inline";
}) {
  switch (props.presentation) {
    case "block":
      return <CodeBlock language="bash">{props.command}</CodeBlock>;
    case "inline": {
      const command = props.maxChars
        ? truncateMiddle(props.command, props.maxChars)
        : props.command;
      return (
        <CodeText language="bash" title={props.command} truncate>
          {command}
        </CodeText>
      );
    }
  }
}
