"use client";

import Link from "next/link";
import { Bell, LogOut, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { RoleBadge } from "@/components/shared/role-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useLogout } from "@/features/auth/hooks";
import { useUnreadNotificationCount } from "@/features/notifications/hooks";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ROUTES } from "@/lib/routes";

export function Topbar() {
  const user = useCurrentUser();
  const logoutMutation = useLogout();
  const unreadQuery = useUnreadNotificationCount();
  const { setTheme, theme } = useTheme();
  const initials = user?.full_name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const unreadCount = (unreadQuery.data as number | undefined) ?? 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
      <MobileSidebar />
      <div className="relative hidden w-full max-w-sm md:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input className="pl-9" placeholder="Search dashboard" disabled aria-label="Search dashboard" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {user && (user.role === "it_support" || user.role === "admin" || user.role === "print_staff") ? (
          <Link href={ROUTES.notifications} className="relative" aria-label="Notifications">
            <Button variant="ghost" size="icon">
              <Bell className="size-4" />
            </Button>
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
        ) : null}

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-3 px-2">
                <Avatar>
                  <AvatarFallback>{initials || "U"}</AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 text-left lg:block">
                  <span className="block truncate text-sm font-medium">{user.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="space-y-2">
                <div className="truncate">{user.full_name}</div>
                <RoleBadge role={user.role} />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
