/** Freeze owned plain data; callers must clone external input before using this. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Canonical JSON DTOs omit absent optional properties instead of storing undefined. */
export function omitUndefined<T extends object>(value: T): T {
  const result = { ...value };
  for (const key of Object.keys(result) as Array<keyof T>) {
    if (result[key] === undefined) delete result[key];
  }
  return result;
}
