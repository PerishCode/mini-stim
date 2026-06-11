import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "../../internal/cx";
import "./SectionStackLayout.scss";

type SectionStackLayoutProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  bottom: ReactNode;
  middle: ReactNode;
  top: ReactNode;
};

export function SectionStackLayout({
  bottom,
  className,
  middle,
  top,
  ...props
}: SectionStackLayoutProps) {
  return (
    <div {...props} className={cx("msSectionStackLayout", className)}>
      <div className="msSectionStackLayout__top">{top}</div>
      <div className="msSectionStackLayout__middle">{middle}</div>
      <div className="msSectionStackLayout__bottom">{bottom}</div>
    </div>
  );
}
