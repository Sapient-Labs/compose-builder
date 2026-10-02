export function uniqueStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

export function splitCommaSeparated(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
