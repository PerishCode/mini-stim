// core stamps are `<unix-seconds>-<millis>` strings, not ISO dates.
// This is product-semantic knowledge of the core contract, so it lives in web
// rather than in the business-blind component layer.
export function parseCoreStamp(value: string): Date | null {
  const match = /^(\d+)-(\d{1,3})$/.exec(value.trim());
  if (!match) {
    const iso = new Date(value);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }
  const seconds = Number(match[1]);
  const millis = Number(match[2]);
  return new Date(seconds * 1000 + millis);
}
