import { Plus } from "lucide-react";

import { Icon, type IconProps } from "./Icon/Icon";

export function PlusIcon(props: Omit<IconProps, "glyph">) {
  return <Icon {...props} glyph={Plus} />;
}
