import Image from "next/image";

import { LoginForm } from "@/features/auth/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="brand-gradient flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border-white/30 bg-background/95 shadow-2xl shadow-slate-950/25 backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-20 w-28 items-center justify-center">
            <Image
              src="/brand/panorama-logo.png"
              alt="Panorama"
              width={112}
              height={80}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">Panorama Dashboard</CardTitle>
            <CardDescription>Manage Panorama operations, students, printing, groups, and support.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
