/**
 * Idempotency keys. One key identifies one *logical* submit: a browser retry of the same payload must reuse it so the
 * backend can de-duplicate; editing the payload (or a successful submit) starts a new logical submit.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface IdempotencyKeyStore {
  /** Key for the current logical submit. A different `signature` than last time starts a new one. */
  get(signature?: string): string;
  /** Call after a successful submit (or any definitive server answer that consumed the key). */
  reset(): void;
  peek(): string | null;
}

export function createIdempotencyKeyStore(generate: () => string = newIdempotencyKey): IdempotencyKeyStore {
  let key: string | null = null;
  let current: string | undefined;
  return {
    get(signature) {
      if (key === null || signature !== current) {
        key = generate();
        current = signature;
      }
      return key;
    },
    reset() {
      key = null;
      current = undefined;
    },
    peek: () => key,
  };
}

/**
 * Stable text identity of a request payload, used as the key-store signature so editing the payload starts a new
 * logical submit. Files contribute name/size/lastModified (never content); FormData entries are ordered by insertion.
 */
export function payloadSignature(...parts: unknown[]): string {
  const describe = (value: unknown): unknown => {
    if (typeof FormData !== "undefined" && value instanceof FormData) {
      return Array.from(value.entries(), ([name, entry]) => [name, typeof entry === "string" ? entry : `file:${entry.name}:${entry.size}:${entry.lastModified}`]);
    }
    return value;
  };
  return JSON.stringify(parts.map(describe));
}
