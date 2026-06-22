import { ChevronRight } from "lucide-react";

import { Icon, type IconProps } from "./Icon/Icon";

export function ChevronRightIcon(props: Omit<IconProps, "glyph">) {
  return <Icon {...props} glyph={ChevronRight} />;
}
