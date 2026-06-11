import { useMemo } from "react";

import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

import { Text } from "../Text/Text";

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

type TimestampProps = {
  // ISO 8601 string (UTC, e.g. "2026-06-11T09:35:45.087Z").
  value: string;
  // "relative" → "3 minutes ago"; "absolute" → localized date-time.
  variant?: "relative" | "absolute";
  size?: "xs" | "sm" | "md" | "lg";
  tone?: "default" | "strong" | "muted" | "subtle";
  truncate?: boolean;
};

export function Timestamp({
  value,
  variant = "relative",
  size = "xs",
  tone = "subtle",
  truncate = false,
}: TimestampProps) {
  const { display, absolute, dateTime } = useMemo(() => {
    const parsed = dayjs(value);
    if (!parsed.isValid()) {
      return { display: value, absolute: value, dateTime: undefined };
    }
    const absolute = parsed.format("LLL");
    return {
      display: variant === "relative" ? parsed.fromNow() : absolute,
      absolute,
      dateTime: parsed.toISOString(),
    };
  }, [value, variant]);

  return (
    <Text
      tag="time"
      size={size}
      tone={tone}
      truncate={truncate}
      dateTime={dateTime}
      title={absolute}
    >
      {display}
    </Text>
  );
}
