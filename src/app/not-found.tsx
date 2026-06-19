import Link from "next/link";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <EmptyState
        title="Page not found"
        description="The page you requested does not exist in the Panorama Dashboard."
        action={
          <Button asChild>
            <Link href={ROUTES.overview}>Back to dashboard</Link>
          </Button>
        }
      />
    </main>
  );
}
