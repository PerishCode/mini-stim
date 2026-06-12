import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Avatar } from "../../atoms/Avatar/Avatar";
import { cx } from "../../internal/cx";
import "./IdentityLine.scss";

type IdentityLineProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  avatarLabel?: string;
  avatarSeed: string;
  marker?: ReactNode;
  meta?: ReactNode;
  name: ReactNode;
  size?: "sm" | "md";
};

export function IdentityLine({
  avatarLabel,
  avatarSeed,
  className,
  marker,
  meta,
  name,
  size = "md",
  ...props
}: IdentityLineProps) {
  return (
    <div {...props} className={cx("msIdentityLine", `msIdentityLine--size-${size}`, className)}>
      <Avatar label={avatarLabel} seed={avatarSeed} size={size} />
      <span className="msIdentityLine__body">
        <span className="msIdentityLine__row">
          <span className="msIdentityLine__name">{name}</span>
          {marker ? <span className="msIdentityLine__marker">{marker}</span> : null}
        </span>
        {meta ? <span className="msIdentityLine__meta">{meta}</span> : null}
      </span>
    </div>
  );
}
