import type { ComponentPropsWithoutRef, CSSProperties } from "react";

import { cx } from "../../internal/cx";
import "./Avatar.scss";

type AvatarProps = ComponentPropsWithoutRef<"span"> & {
  label?: string;
  seed: string;
  size?: "sm" | "md" | "lg";
};

type AvatarStyle = CSSProperties & {
  "--ms-avatar-color-a"?: string;
  "--ms-avatar-color-b"?: string;
  "--ms-avatar-color-c"?: string;
};

export function Avatar({
  className,
  label,
  seed,
  size = "md",
  style,
  ...props
}: AvatarProps) {
  const palette = avatarPalette(seed);
  const mergedStyle: AvatarStyle = {
    "--ms-avatar-color-a": palette[0],
    "--ms-avatar-color-b": palette[1],
    "--ms-avatar-color-c": palette[2],
    ...style,
  };

  return (
    <span
      {...props}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cx("msAvatar", `msAvatar--size-${size}`, className)}
      role={label ? "img" : undefined}
      style={mergedStyle}
    >
      <span className="msAvatar__mark">{avatarInitial(label ?? seed)}</span>
    </span>
  );
}

function avatarPalette(seed: string) {
  const hash = hashSeed(seed);
  const hue = hash % 360;
  return [
    `hsl(${hue} 52% 44%)`,
    `hsl(${(hue + 52) % 360} 43% 62%)`,
    `hsl(${(hue + 196) % 360} 35% 78%)`,
  ] as const;
}

function avatarInitial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "S";
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
