"use client";

import Link from "next/link";

import { useI18n } from "@/i18n/provider";

/** A customer's name as a link to their profile (`/dashboard/users/<id>`); plain text when there is no account (counter customers). */
export function CustomerLink({ userId, name, className }: { userId: number | null | undefined; name: string; className?: string }) {
  const { locale } = useI18n();
  if (userId === null || userId === undefined) return <span className={className} dir="auto">{name}</span>;
  return <Link href={`/${locale}/dashboard/users/${userId}`} className={className ?? "font-semibold text-primary underline-offset-4 hover:underline"} dir="auto">{name}</Link>;
}
