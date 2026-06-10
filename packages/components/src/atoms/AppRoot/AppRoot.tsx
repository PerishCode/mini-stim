import type { ReactNode } from "react";

import "./AppRoot.scss";

export function AppRoot(props: { children: ReactNode }) {
  return <div className="msAppRoot">{props.children}</div>;
}
