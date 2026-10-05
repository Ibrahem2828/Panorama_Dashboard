export function requestId(request: Request) {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming && /^[A-Za-z0-9._:-]{8,128}$/u.test(incoming) ? incoming : crypto.randomUUID();
}
