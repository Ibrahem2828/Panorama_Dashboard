"use client";

import { Search } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/config/constants";
import { allNavigationItems } from "@/config/navigation";
import { useSession } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { hasCapability } from "@/lib/auth/capabilities";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { t } = useI18n();
  const { capabilities } = useSession();
  const params = useParams<{ locale: Locale }>();
  const router = useRouter();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allNavigationItems
      .filter((item) => hasCapability(capabilities, item.capability))
      .filter((item) => !normalized || `${t(item.label)} ${item.key} ${(item.keywords ?? []).join(" ")}`.toLowerCase().includes(normalized))
      .slice(0, 12);
  }, [capabilities, query, t]);

  return (
    <>
      <Button variant="outline" className="hidden min-w-56 justify-between text-muted-foreground lg:flex" onClick={() => setOpen(true)}>
        <span className="flex items-center gap-2"><Search />{t("common.globalSearch")}</span>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label={t("common.search")}><Search /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only"><DialogTitle>{t("common.globalSearch")}</DialogTitle><DialogDescription>{t("common.globalSearch")}</DialogDescription></DialogHeader>
          <div className="border-b p-4"><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("common.globalSearch")} className="h-11" /></div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {results.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => { setOpen(false); setQuery(""); router.push(localizePath(params.locale, item.href)); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition hover:bg-accent"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
                  <span className="font-medium">{t(item.label)}</span>
                </button>
              );
            })}
            {!results.length ? <p className="p-8 text-center text-sm text-muted-foreground">{t("common.noData")}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
