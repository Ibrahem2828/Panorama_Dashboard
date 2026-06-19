"use client";

import Image from "next/image";

import { navigationItems } from "@/config/navigation";
import { RoleBadge } from "@/components/shared/role-badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { NavItem } from "@/components/layout/nav-item";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const visibleItems = navigationItems.filter((item) => item.canAccess(user?.role));

  return (
    <aside className="flex h-full flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-5">
        <div className="relative h-10 w-44">
          <Image
            src="/brand/panorama-logo-horizontal.png"
            alt="Panorama Dashboard"
            fill
            sizes="176px"
            className="object-contain object-left"
            priority
          />
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleItems.map((item) => (
          <NavItem key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      {user ? (
        <div className="mt-auto border-t p-3 text-xs">
          <div className="truncate font-medium">{user.full_name}</div>
          <div className="mt-1"><RoleBadge role={user.role} /></div>
        </div>
      ) : null}
    </aside>
  );
}
