type PublicEnv = {
  apiBaseUrl: string;
  wsBaseUrl: string;
  appName: string;
  appEnv: "local" | "development" | "staging" | "production";
};

const rawEnv = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL,
  appName: process.env.NEXT_PUBLIC_APP_NAME,
  appEnv: process.env.NEXT_PUBLIC_APP_ENV,
};

function requireValue(key: keyof typeof rawEnv) {
  const value = rawEnv[key]?.trim();
  if (!value) {
    throw new Error(`Missing required public environment value: ${key}`);
  }
  return value;
}

function requireUrl(key: keyof typeof rawEnv, allowedProtocols: string[]) {
  const value = requireValue(key).replace(/\/+$/, "");

  try {
    const parsed = new URL(value);
    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error(`${key} must be a valid URL using ${allowedProtocols.join(" or ")}`);
  }

  return value;
}

function requireAppEnv() {
  const value = requireValue("appEnv");
  if (!["local", "development", "staging", "production"].includes(value)) {
    throw new Error("NEXT_PUBLIC_APP_ENV must be local, development, staging, or production");
  }
  return value as PublicEnv["appEnv"];
}

export const env: PublicEnv = {
  apiBaseUrl: requireUrl("apiBaseUrl", ["http:", "https:"]),
  wsBaseUrl: requireUrl("wsBaseUrl", ["ws:", "wss:"]),
  appName: requireValue("appName"),
  appEnv: requireAppEnv(),
};
