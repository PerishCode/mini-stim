import { UserRound } from "lucide-react";

import { Icon, type IconProps } from "./Icon/Icon";

export function SoulsIcon(props: Omit<IconProps, "glyph">) {
  return <Icon {...props} glyph={UserRound} />;
}
