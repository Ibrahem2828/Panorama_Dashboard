/**
 * The WhatsApp invite link is a secret: the dashboard must never show, cache or log it. The backend schema declares a
 * `url` in the PUT whatsapp-channel response, so the BFF strips it before anything reaches the browser.
 */
const WHATSAPP_CHANNEL_PATH = /^\/api\/v1\/dashboard\/groups\/[^/]+\/whatsapp-channel\/?$/u;
const SECRET_KEYS = new Set(["url", "whatsapp_url", "invite_url", "invite_link", "link"]);

export function isWhatsappChannelPath(pathname: string): boolean {
  return WHATSAPP_CHANNEL_PATH.test(pathname);
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !SECRET_KEYS.has(key)).map(([key, child]) => [key, strip(child)]));
  }
  return value;
}

/** Removes every link-like key from a JSON body; anything that is not JSON becomes an empty object. */
export function scrubWhatsappChannelBody(text: string): string {
  try {
    return JSON.stringify(strip(JSON.parse(text)));
  } catch {
    return "{}";
  }
}
