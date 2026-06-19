"use client";

import { ErrorState } from "@/components/feedback/error-state";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-2xl">
        <ErrorState message={error.message || "The dashboard could not render this page."} onRetry={reset} />
      </div>
    </main>
  );
}
