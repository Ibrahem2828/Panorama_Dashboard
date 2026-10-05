export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Panorama Dashboard",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  // Compatibility values deliberately point to same-origin BFF, never the backend host.
  apiBaseUrl: "/api/backend",
  wsBaseUrl: "",
} as const;
