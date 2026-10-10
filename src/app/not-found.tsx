import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="text-center"><div className="brand-text-gradient text-8xl font-black">404</div><h1 className="mt-4 text-2xl font-bold">Page not found</h1><Link href="/ar/login" className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Panorama Dashboard</Link></div>
    </main>
  );
}
