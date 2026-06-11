import type { SVGProps } from "react";
import type { LucideIcon } from "lucide-react";

import { cx } from "../../internal/cx";
import "./Icon.scss";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  decorative?: boolean;
  glyph: LucideIcon;
  size?: "sm" | "md" | "lg";
  strokeWidth?: number;
  title?: string;
};

export function Icon({
  className,
  decorative = true,
  glyph: Glyph,
  size = "md",
  strokeWidth = 1.9,
  title,
  ...props
}: IconProps) {
  return (
    <Glyph
      {...props}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      className={cx("msIcon", `msIcon--size-${size}`, className)}
      focusable="false"
      strokeWidth={strokeWidth}
    />
  );
}
