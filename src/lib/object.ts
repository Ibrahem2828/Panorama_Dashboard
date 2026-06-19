export function readString(source: unknown, keys: string[], fallback = "-") {
  const value = readValue(source, keys);
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

export function readNumber(source: unknown, keys: string[], fallback = 0) {
  const value = readValue(source, keys);
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readBoolean(source: unknown, keys: string[], fallback = false) {
  const value = readValue(source, keys);
  return typeof value === "boolean" ? value : fallback;
}

export function readValue(source: unknown, keys: string[]) {
  for (const key of keys) {
    const value = byPath(source, key);
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function byPath(source: unknown, path: string): unknown {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, source);
}
