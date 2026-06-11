import { SendHorizontal } from "lucide-react";

import { Icon, type IconProps } from "./Icon/Icon";

export function SendIcon(props: Omit<IconProps, "glyph">) {
  return <Icon {...props} glyph={SendHorizontal} />;
}
