import { MessageCircle } from "lucide-react";

import { Icon, type IconProps } from "./Icon/Icon";

export function SessionsIcon(props: Omit<IconProps, "glyph">) {
  return <Icon {...props} glyph={MessageCircle} />;
}
