"use client";

import { useEffect } from "react";

import { ErrorPanel } from "@/components/feedback/error-panel";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Panorama UI error", { name: error.name, digest: error.digest }); }, [error]);
  return <div className="mx-auto max-w-3xl p-8"><ErrorPanel error={error} retry={reset} /></div>;
}
