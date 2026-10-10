import { redirect } from "next/navigation";

import type { Locale } from "@/config/constants";

export default async function LocalePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
