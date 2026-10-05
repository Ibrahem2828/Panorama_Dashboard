"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { SidebarContent } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/provider";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const { t, direction } = useI18n();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu"><Menu /></Button></SheetTrigger>
      <SheetContent side={direction === "rtl" ? "right" : "left"} className="w-[min(88vw,340px)] p-0 sm:max-w-[340px]">
        <SheetHeader className="sr-only"><SheetTitle>{t("app.name")}</SheetTitle><SheetDescription>{t("nav.overview")}</SheetDescription></SheetHeader>
        <SidebarContent mobile onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
