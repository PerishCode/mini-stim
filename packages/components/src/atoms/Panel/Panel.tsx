import type { ComponentPropsWithoutRef, ComponentPropsWithRef, Ref } from "react";

import { cx } from "../../internal/cx";
import "./Panel.scss";

type PanelRootProps = ComponentPropsWithRef<"section">;
type PanelSlotProps = ComponentPropsWithoutRef<"div">;

type PanelBodyProps = PanelSlotProps & {
  innerRef?: Ref<HTMLDivElement>;
  scroll?: boolean;
  tone?: "default" | "inset";
};

function Root({ className, ...props }: PanelRootProps) {
  return <section {...props} className={cx("msPanel", className)} />;
}

function Header({ className, ...props }: PanelSlotProps) {
  return <div {...props} className={cx("msPanel__header", className)} />;
}

function Body({ className, innerRef, scroll = false, tone = "default", ...props }: PanelBodyProps) {
  return (
    <div
      {...props}
      className={cx(
        "msPanel__body",
        `msPanel__body--tone-${tone}`,
        scroll && "msPanel__body--scroll",
        className,
      )}
      ref={innerRef}
    />
  );
}

function Footer({ className, ...props }: PanelSlotProps) {
  return <div {...props} className={cx("msPanel__footer", className)} />;
}

export const Panel = {
  Body,
  Footer,
  Header,
  Root,
};
