import type { ComponentPropsWithoutRef, ComponentPropsWithRef, ReactNode } from "react";

import { Avatar } from "../../atoms/Avatar/Avatar";
import { cx } from "../../internal/cx";
import "./AnchoredContentGroup.scss";

type AnchoredContentGroupSide = "start" | "end";

type AnchoredContentGroupProps = ComponentPropsWithoutRef<"section"> & {
  anchorLabel?: string;
  anchorSeed: string;
  children: ReactNode;
  divider: ReactNode;
  side?: AnchoredContentGroupSide;
};

type AnchoredContentGroupItemProps = ComponentPropsWithRef<"button"> & {
  align?: "start" | "center" | "end";
};

type AnchoredContentGroupDividerProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
};

export function AnchoredContentGroup({
  anchorLabel,
  anchorSeed,
  children,
  className,
  divider,
  side = "start",
  ...props
}: AnchoredContentGroupProps) {
  return (
    <section
      {...props}
      className={cx("msAnchoredContentGroup", `msAnchoredContentGroup--side-${side}`, className)}
    >
      <div className="msAnchoredContentGroup__topDivider">
        <span className="msAnchoredContentGroup__rule" />
        <span className="msAnchoredContentGroup__dividerLabel">{divider}</span>
        <span className="msAnchoredContentGroup__rule" />
      </div>
      <Avatar
        className="msAnchoredContentGroup__anchor"
        label={anchorLabel}
        seed={anchorSeed}
        size="md"
      />
      <div className="msAnchoredContentGroup__content">{children}</div>
    </section>
  );
}

export function AnchoredContentGroupItem({
  align = "start",
  children,
  className,
  type = "button",
  ...props
}: AnchoredContentGroupItemProps) {
  return (
    <button
      {...props}
      className={cx(
        "msAnchoredContentGroup__item",
        `msAnchoredContentGroup__item--align-${align}`,
        className,
      )}
      type={type}
    >
      <span className="msAnchoredContentGroup__itemBody">{children}</span>
    </button>
  );
}

export function AnchoredContentGroupDivider({
  children,
  className,
  ...props
}: AnchoredContentGroupDividerProps) {
  return (
    <div {...props} className={cx("msAnchoredContentGroup__breakDivider", className)}>
      <span className="msAnchoredContentGroup__breakRule" />
      <span className="msAnchoredContentGroup__breakLabel">{children}</span>
      <span className="msAnchoredContentGroup__breakRule" />
    </div>
  );
}
