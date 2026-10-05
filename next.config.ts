import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  output: "standalone", poweredByHeader: false, reactStrictMode: true, compress: true,
  // Backend routes all end with "/"; the BFF restores it, so Next must not 308 those requests to the slashless form.
  skipTrailingSlashRedirect: true,
  images: { formats: ["image/avif", "image/webp"], minimumCacheTTL: 31_536_000 },
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; },
};
export default nextConfig;
