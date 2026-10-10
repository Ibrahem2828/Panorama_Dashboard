import "server-only";

import { API_OPERATIONS } from "@/contracts/generated/operations";

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function pathPattern(template: string) {
  const pattern = template
    .split(/(\{[^}]+\})/gu)
    .map((part) => part.startsWith("{") && part.endsWith("}") ? "[^/]+" : escapeRegularExpression(part))
    .join("");
  return new RegExp(`^${pattern}$`, "u");
}

const documentedOperations = API_OPERATIONS.map((operation) => ({
  method: operation.method,
  pattern: pathPattern(operation.path),
}));

/**
 * The BFF is a contract-bound gateway, never a generic authenticated proxy.
 * Query parameters are intentionally excluded: authorization is based on a
 * documented method and pathname, while parameter validation stays upstream.
 */
export function isDocumentedBackendOperation(method: string, pathname: string) {
  const normalizedMethod = method.toUpperCase();
  return documentedOperations.some((operation) =>
    (operation.method === normalizedMethod || (normalizedMethod === "HEAD" && operation.method === "GET"))
    && operation.pattern.test(pathname),
  );
}
