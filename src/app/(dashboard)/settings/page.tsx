"use client";

import { LogOut, Moon, Server, Shield, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";

import { FieldGrid, FieldItem } from "@/components/shared/field-grid";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge } from "@/components/shared/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { env } from "@/config/env";
import { useLogout } from "@/features/auth/hooks";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function SettingsPage() {
  const user = useCurrentUser();
  const logout = useLogout();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Profile, dashboard preferences, and environment information." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="size-5" />Current user</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGrid title="Profile">
              <FieldItem label="Name" value={user?.full_name ?? "-"} />
              <FieldItem label="Email" value={user?.email ?? "-"} />
              <FieldItem label="Phone" value={user?.phone_number ?? "-"} />
              <FieldItem label="Role" value={user ? <RoleBadge role={user.role} /> : "-"} />
            </FieldGrid>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="size-5" />Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="destructive" className="w-full" onClick={() => logout.mutate()} isLoading={logout.isPending}>
              <LogOut />
              Sign out
            </Button>
            <p className="text-sm text-muted-foreground">Password changes are not enabled because no change-password endpoint is listed in the dashboard collection.</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{isDark ? <Moon className="size-5" /> : <Sun className="size-5" />}Appearance</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark mode</p>
              <p className="text-sm text-muted-foreground">Use a clean high-contrast dashboard theme.</p>
            </div>
            <Switch checked={isDark} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} aria-label="Toggle dark mode" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="size-5" />Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGrid title="Runtime">
              <FieldItem label="API base URL" value={env.apiBaseUrl} />
              <FieldItem label="WebSocket base URL" value={env.wsBaseUrl} />
              <FieldItem label="App environment" value={env.appEnv} />
              <FieldItem label="App name" value={env.appName} />
            </FieldGrid>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
