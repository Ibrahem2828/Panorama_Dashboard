import { redirect } from "next/navigation";

/** The counter sale lives in the printing workspace (one obvious path); this address keeps old links and bookmarks working. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/printing?tab=counter`);
}
