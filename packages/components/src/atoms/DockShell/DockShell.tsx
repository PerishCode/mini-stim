import type { ComponentPropsWithoutRef } from "react";

import { cx } from "../../internal/cx";
import "./DockShell.scss";

type DockShellRootProps = ComponentPropsWithoutRef<"div">;

type DockShellSlotProps = ComponentPropsWithoutRef<"div">;

function Root({ className, ...props }: DockShellRootProps) {
  return <div {...props} className={cx("msDockShell", className)} />;
}

function Dock({ className, ...props }: DockShellSlotProps) {
  return <div {...props} className={cx("msDockShell__dock", className)} />;
}

function Grid({ className, ...props }: DockShellSlotProps) {
  return <div {...props} className={cx("msDockShell__grid", className)} />;
}

export const DockShell = {
  Dock,
  Grid,
  Root,
};
