"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing, Check, Link2, Search, Send, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { Pagination } from "@/components/data-grid/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";

interface UserTarget { id: number; full_name: string; role: string; email?: string; is_active: boolean }
const notificationTypes = ["system", "announcement", "lecture", "group", "printing", "support"];
const deepLinkPattern = /^(?:\/|panorama:\/\/)[a-z0-9/_?=&.%-]*$/iu;

export function NotificationsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 50)));
  const [searchDraft, setSearchDraft] = useState(search);
  const debouncedSearch = useDebouncedValue(searchDraft);
  const [selected, setSelected] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("system");
  const [deepLink, setDeepLink] = useState("");
  const [deduplicationKey, setDeduplicationKey] = useState("");

  const updateUrl = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (debouncedSearch !== search) updateUrl({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch, search, updateUrl]);

  const users = useQuery({
    queryKey: ["notification-target-users", page, pageSize, search, role],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), is_active: "true", ordering: "full_name" });
      if (search) params.set("search", search);
      if (role !== "all") params.set("role", role);
      return normalizeCollection<UserTarget>(await apiFetch(`/api/v1/dashboard/users/?${params}`));
    },
  });
  const visibleUsers = users.data?.results ?? [];

  const send = useMutation({
    mutationFn: () => {
      if (!selected.length) throw new Error(t("notifications.selectRecipients"));
      if (!title.trim() || !body.trim()) throw new Error(t("common.required"));
      if (deepLink && !deepLinkPattern.test(deepLink)) throw new Error(t("notifications.invalidDeepLink"));
      return apiFetch("/api/v1/dashboard/notifications/campaign/", {
        method: "POST",
        body: { user_ids: selected, title: title.trim(), body: body.trim(), type, deep_link: deepLink.trim(), deduplication_key: deduplicationKey.trim() },
      });
    },
    onSuccess() { toast.success(t("notifications.sent")); setSelected([]); setTitle(""); setBody(""); setDeepLink(""); setDeduplicationKey(""); },
    onError(error: Error) { toast.error(error.message); },
  });

  const toggle = (id: number) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= 1000 ? current : [...current, id]);
  const allVisibleSelected = visibleUsers.length > 0 && visibleUsers.every((user) => selected.includes(user.id));
  const toggleVisible = () => setSelected((current) => allVisibleSelected ? current.filter((id) => !visibleUsers.some((user) => user.id === id)) : Array.from(new Set([...current, ...visibleUsers.map((user) => user.id)])).slice(0, 1000));

  return (
    <CapabilityGate capability={CAPABILITIES.announcements}>
      <div className="space-y-6">
        <PageHeader title={t("notifications.title")} description={t("notifications.subtitle")} eyebrow="Engagement" />
        <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
          <Card className="min-h-[38rem]">
            <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>{t("notifications.recipients")}</CardTitle><CardDescription>{selected.length} / 1000</CardDescription></div><Badge variant="secondary"><Users className="me-1 size-3" />{users.data?.count ?? 0}</Badge></div></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-10" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t("common.searchPlaceholder")} /></div><Select value={role} onValueChange={(value) => updateUrl({ role: value === "all" ? null : value, page: 1 })}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("common.all")}</SelectItem>{["admin", "content_manager", "it_support", "support_staff", "print_staff", "student", "normal_user"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <Button variant="outline" className="w-full" onClick={toggleVisible}>{allVisibleSelected ? t("notifications.clearVisible") : t("notifications.selectVisible")}</Button>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto pe-1">{visibleUsers.map((user) => <button key={user.id} type="button" onClick={() => toggle(user.id)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-start transition hover:bg-muted/40"><span className={`grid size-5 place-items-center rounded border ${selected.includes(user.id) ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{selected.includes(user.id) ? <Check className="size-3" /> : null}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{user.full_name}</strong><span className="text-xs text-muted-foreground">{user.role}</span></span></button>)}{!visibleUsers.length ? <p className="py-10 text-center text-muted-foreground">{search || role !== "all" ? t("common.noSearchResults") : t("common.noRecords")}</p> : null}</div>
              {users.data ? <Pagination page={page} pageSize={pageSize} count={users.data.count} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} /> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><BellRing className="size-5" /></div><div><CardTitle>{t("notifications.createCampaign")}</CardTitle><CardDescription>{t("notifications.contractNote")}</CardDescription></div></div></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2"><Label htmlFor="campaign-title">{t("notifications.messageTitle")}</Label><Input id="campaign-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} /><p className="text-end text-xs text-muted-foreground">{title.length}/255</p></div>
              <div className="space-y-2"><Label htmlFor="campaign-body">{t("notifications.messageBody")}</Label><Textarea id="campaign-body" className="min-h-36" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} /><p className="text-end text-xs text-muted-foreground">{body.length}/2000</p></div>
              <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>{t("feedback.type")}</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{notificationTypes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{t("notifications.deduplicationKey")}</Label><Input value={deduplicationKey} onChange={(event) => setDeduplicationKey(event.target.value)} maxLength={128} placeholder="release-2026-07-31" /></div></div>
              <div className="space-y-2"><Label className="flex items-center gap-2"><Link2 className="size-4" />{t("notifications.deepLink")}</Label><Input value={deepLink} onChange={(event) => setDeepLink(event.target.value)} maxLength={255} placeholder="/lectures/42" /><p className="text-xs text-muted-foreground">{t("notifications.deepLinkHint")}</p></div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-muted-foreground"><p className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="size-4 text-emerald-500" />{t("notifications.safeDelivery")}</p><p className="mt-1">{t("notifications.idempotencyNote")}</p></div>
              <Button className="h-12 w-full" onClick={() => send.mutate()} disabled={send.isPending || !selected.length || !title.trim() || !body.trim()}><Send />{send.isPending ? t("notifications.sending") : t("notifications.sendTo", { count: selected.length })}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </CapabilityGate>
  );
}
