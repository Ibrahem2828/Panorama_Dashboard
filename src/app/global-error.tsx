"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: replaces the root layout, so it renders its own <html><body> and cannot rely on providers,
 * i18n or Tailwind tokens. Text is static and bilingual.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Digest only: never log message/stack that could contain user data.
    console.error("panorama.dashboard.global_error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#111" }}>
        <main role="alert" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>حدث خطأ غير متوقع</h1>
          <p style={{ margin: 0 }}>نعتذر عن ذلك. يمكنك المحاولة مرة أخرى.</p>
          <h2 dir="ltr" lang="en" style={{ fontSize: 18, margin: "12px 0 0" }}>Something went wrong</h2>
          <p dir="ltr" lang="en" style={{ margin: 0 }}>We are sorry about that. You can try again.</p>
          {error.digest ? (
            <p dir="ltr" style={{ fontSize: 12, color: "#555", margin: "8px 0 0" }}>
              Ref: {error.digest}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={reset} style={{ padding: "10px 20px", fontSize: 16, borderRadius: 10, border: "1px solid #1d3a8a", background: "#1d3a8a", color: "#fff", cursor: "pointer" }}>
              إعادة المحاولة · Try again
            </button>
            <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 20px", fontSize: 16, borderRadius: 10, border: "1px solid #888", background: "#fff", color: "#111", cursor: "pointer" }}>
              تحديث الصفحة · Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
