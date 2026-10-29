"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Route of the student/staff profile page. */
export function userProfilePath(userId: number | string): string {
  return `/dashboard/users/${encodeURIComponent(String(userId))}`;
}

/**
 * Link to the profile page of one user. Renders plain text (no link) when the id is unknown so callers never have to
 * branch. `children` replaces the name (for example an avatar plus name).
 */
export function UserLink({ userId, name, className, children }: { userId: number | string | null | undefined; name: string; className?: string; children?: ReactNode }) {
  const { locale, t } = useI18n();
  if (userId === null || userId === undefined || userId === "") return <span className={className}>{children ?? name}</span>;
  return (
    <Link
      href={localizePath(locale, userProfilePath(userId))}
      title={t("userProfile.open")}
      aria-label={children ? `${t("userProfile.open")}: ${name}` : undefined}
      className={cn("rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      {children ?? name}
    </Link>
  );
}
