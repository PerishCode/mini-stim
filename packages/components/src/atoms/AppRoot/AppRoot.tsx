import type { ReactNode } from "react";

import "./AppRoot.scss";

export function AppRoot(props: {
  sidebar: ReactNode;
  main: ReactNode;
}) {
  return (
    <div className="msAppRoot">
      <aside className="msAppRoot__sidebar">{props.sidebar}</aside>
      <main className="msAppRoot__main">{props.main}</main>
    </div>
  );
}
