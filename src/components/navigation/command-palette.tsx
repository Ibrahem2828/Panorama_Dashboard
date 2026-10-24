"use client";

import { Clock, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/config/constants";
import { allNavigationItems } from "@/config/navigation";
import { useQuickAccessCounts } from "@/features/notifications/inbox";
import { CREATE_ACTIONS, ATTENTION_ACTIONS } from "@/features/quick-access/quick-actions";
import { useSession } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { hasCapability } from "@/lib/auth/capabilities";
import { cn, formatNumber } from "@/lib/utils";

interface Entry {
  id: string;
  section: "attention" | "create" | "recent" | "pages";
  label: string;
  hint?: string;
  icon: LucideIcon;
  href: string;
  count?: number;
  search: string;
}

const RECENT_KEY = "panorama.dashboard.recent-pages";
const MAX_RECENT = 5;

function readRecent(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function rememberRecent(id: string) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((item) => item !== id)].slice(0, MAX_RECENT)));
  } catch {
    // Recents are a convenience; a blocked storage must never get in the way.
  }
}

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)));
}

/**
 * Quick access: Ctrl/⌘+K or "/" opens one box that jumps to a page, shows what is waiting for you (live counters) and starts
 * the common creations (add a user, record a purchase, sell stationery). Everything is filtered by the caller's capabilities,
 * and it is fully keyboard driven (arrows, Enter, Esc).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const { t, locale } = useI18n();
  const { capabilities } = useSession();
  const params = useParams<{ locale: Locale }>();
  const router = useRouter();
  const counts = useQuickAccessCounts();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((next: boolean) => {
    setOpen(next);
    if (next) setRecent(readRecent());
    else setQuery("");
    setActive(0);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle(!open);
      } else if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !open && !isTyping(event.target)) {
        event.preventDefault();
        toggle(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, toggle]);

  const entries = useMemo<Entry[]>(() => {
    const allowed = <T extends { capability?: string }>(item: T) => hasCapability(capabilities, item.capability);
    const pages: Entry[] = allNavigationItems.filter(allowed).map((item) => ({
      id: `page:${item.key}`,
      section: "pages",
      label: t(item.label),
      icon: item.icon,
      href: item.href,
      search: `${t(item.label)} ${item.key} ${(item.keywords ?? []).join(" ")}`.toLowerCase(),
    }));
    const fromActions = (items: typeof ATTENTION_ACTIONS, section: Entry["section"]): Entry[] =>
      items.filter(allowed).map((item) => ({
        id: `action:${item.key}`,
        section,
        label: t(item.label),
        hint: t(item.hint),
        icon: item.icon,
        href: item.href,
        count: item.count ? counts.data?.[item.count] : undefined,
        search: `${t(item.label)} ${t(item.hint)} ${(item.keywords ?? []).join(" ")}`.toLowerCase(),
      }));
    const attention = fromActions(ATTENTION_ACTIONS, "attention");
    const create = fromActions(CREATE_ACTIONS, "create");
    const byId = new Map([...attention, ...create, ...pages].map((entry) => [entry.id, entry]));
    const recents = recent.flatMap((id) => {
      const entry = byId.get(id);
      return entry ? [{ ...entry, section: "recent" as const }] : [];
    });
    const needle = query.trim().toLowerCase();
    if (!needle) {
      // Empty box: what needs a person first (only queues that are not empty), then creators, recents, pages.
      const waiting = attention.filter((entry) => entry.count === undefined || entry.count > 0);
      return [...waiting, ...create, ...recents, ...pages].slice(0, 30);
    }
    return [...attention, ...create, ...pages].filter((entry) => entry.search.includes(needle)).slice(0, 20);
  }, [capabilities, counts.data, query, recent, t]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = useCallback(
    (entry: Entry) => {
      rememberRecent(entry.id);
      toggle(false);
      router.push(localizePath(params.locale, entry.href));
    },
    [params.locale, router, toggle],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (entries.length ? (value + 1) % entries.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (entries.length ? (value - 1 + entries.length) % entries.length : 0));
    } else if (event.key === "Enter" && entries[active]) {
      event.preventDefault();
      go(entries[active]);
    }
  };

  const sectionLabel = (section: Entry["section"]) =>
    t(({ attention: "quick.sectionAttention", create: "quick.sectionCreate", recent: "quick.sectionRecent", pages: "quick.sectionPages" } as const)[section]);

  return (
    <>
      <Button variant="outline" className="hidden min-w-56 justify-between text-muted-foreground lg:flex" onClick={() => toggle(true)}>
        <span className="flex items-center gap-2"><Search />{t("common.globalSearch")}</span>
        <span className="flex items-center gap-1"><kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">Ctrl K</kbd><kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">/</kbd></span>
      </Button>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => toggle(true)} aria-label={t("common.search")}><Search /></Button>
      <Dialog open={open} onOpenChange={toggle}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only"><DialogTitle>{t("common.globalSearch")}</DialogTitle><DialogDescription>{t("quick.paletteHelp")}</DialogDescription></DialogHeader>
          <div className="border-b p-4">
            <Input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={entries[active] ? `${listId}-${active}` : undefined}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder={t("quick.palettePlaceholder")}
              className="h-11"
            />
          </div>
          <div ref={listRef} id={listId} role="listbox" aria-label={t("common.globalSearch")} className="max-h-[440px] overflow-y-auto p-2">
            {entries.map((entry, index) => {
              const Icon = entry.section === "recent" ? Clock : entry.icon;
              const showHeader = index === 0 || entries[index - 1]?.section !== entry.section;
              return (
                <div key={`${entry.section}:${entry.id}`}>
                  {showHeader ? <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground" role="presentation">{sectionLabel(entry.section)}</div> : null}
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-${index}`}
                    data-index={index}
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(entry)}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition", index === active ? "bg-accent" : "hover:bg-accent/60")}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{entry.label}</span>
                      {entry.hint ? <span className="block truncate text-xs text-muted-foreground">{entry.hint}</span> : null}
                    </span>
                    {entry.count !== undefined && entry.count > 0 ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground" aria-label={t("quick.pendingCount", { count: formatNumber(entry.count, locale) })}>{formatNumber(entry.count, locale)}</span>
                    ) : null}
                  </button>
                </div>
              );
            })}
            {!entries.length ? <p className="p-8 text-center text-sm text-muted-foreground">{t("common.noData")}</p> : null}
          </div>
          <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span>{t("quick.paletteHelp")}</span>
            <span className="flex gap-1"><kbd className="rounded border bg-background px-1.5 py-0.5">↑↓</kbd><kbd className="rounded border bg-background px-1.5 py-0.5">Enter</kbd><kbd className="rounded border bg-background px-1.5 py-0.5">Esc</kbd></span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
