import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "../../internal/cx";
import "./FieldActionLayout.scss";

type FieldActionLayoutProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  action: ReactNode;
  actionWidth?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
};

export function FieldActionLayout({
  action,
  actionWidth = "lg",
  children,
  className,
  footer,
  ...props
}: FieldActionLayoutProps) {
  return (
    <div
      {...props}
      className={cx(
        "msFieldActionLayout",
        `msFieldActionLayout--action-width-${actionWidth}`,
        Boolean(footer) && "msFieldActionLayout--with-footer",
        className,
      )}
    >
      <div className="msFieldActionLayout__field">{children}</div>
      <div className="msFieldActionLayout__action">{action}</div>
      {footer ? <div className="msFieldActionLayout__footer">{footer}</div> : null}
    </div>
  );
}
