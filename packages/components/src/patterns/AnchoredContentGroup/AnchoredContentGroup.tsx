import type {
  ComponentPropsWithoutRef,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  Ref,
} from "react";

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

type AnchoredContentGroupItemProps = ComponentPropsWithoutRef<"div"> & {
  align?: "start" | "center" | "end";
  element?: "button" | "div";
  innerRef?: Ref<HTMLElement>;
  type?: ComponentPropsWithoutRef<"button">["type"];
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
  element = "button",
  children,
  className,
  innerRef,
  onClick,
  onKeyDown,
  tabIndex,
  type = "button",
  ...props
}: AnchoredContentGroupItemProps) {
  const itemClassName = cx(
    "msAnchoredContentGroup__item",
    `msAnchoredContentGroup__item--align-${align}`,
    className,
  );
  const itemBody = <span className="msAnchoredContentGroup__itemBody">{children}</span>;

  if (element === "div") {
    return (
      // biome-ignore lint/a11y/useSemanticElements: Markdown message bodies can contain anchors, so this cannot be a native button.
      <div
        {...props}
        className={itemClassName}
        onClick={onClick}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
        ref={innerRef as Ref<HTMLDivElement>}
        role="button"
        tabIndex={tabIndex ?? 0}
      >
        {itemBody}
      </div>
    );
  }

  return (
    <button
      {...(props as ComponentPropsWithoutRef<"button">)}
      className={itemClassName}
      onClick={onClick as unknown as MouseEventHandler<HTMLButtonElement>}
      onKeyDown={onKeyDown as unknown as KeyboardEventHandler<HTMLButtonElement>}
      ref={innerRef as Ref<HTMLButtonElement>}
      type={type}
    >
      {itemBody}
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
