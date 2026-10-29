"use client";

import { Copy, Download, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { Ltr } from "@/components/shared/ltr";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadWhatsappCsv, useWhatsappList } from "@/features/academic-term/api";
import { whatsappCopyText } from "@/features/academic-term/rules";
import { useI18n } from "@/i18n/provider";
import { apiErrorText } from "@/lib/api/error-message";
import { formatNumber } from "@/lib/utils";

/** The manual work WhatsApp forces on us: per group, who must be removed. One copy button per group, one CSV for all. */
export function WhatsappRemovals({ rolloverId }: { rolloverId: number }) {
  const { t, locale } = useI18n();
  const list = useWhatsappList(rolloverId);
  const [downloading, setDownloading] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("term.copied"));
    } catch {
      toast.error(t("term.copyFailed"));
    }
  };
  const download = async () => {
    setDownloading(true);
    try { await downloadWhatsappCsv(rolloverId); } catch (error) { toast.error(apiErrorText(error, t)); } finally { setDownloading(false); }
  };

  if (list.isPending) return <Skeleton className="h-40 rounded-2xl" />;
  if (list.isError) return <ErrorPanel error={list.error} retry={() => list.refetch()} />;
  const groups = list.data.groups.filter((group) => group.members.length > 0);

  return (
    <section aria-labelledby={`wa-${rolloverId}`} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`wa-${rolloverId}`} className="flex items-center gap-2 text-base font-black"><MessageCircle className="size-5 text-primary" />{t("term.whatsappTitle")}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("term.whatsappHint")}</p>
        </div>
        <Button type="button" variant="outline" onClick={download} isLoading={downloading} disabled={downloading || !groups.length}><Download />{t("term.downloadCsv")}</Button>
      </div>
      {!groups.length ? <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">{t("term.whatsappNone")}</p> : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.group_id} className="rounded-xl border">
              <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2.5">
                <span className="font-bold">{group.name} <span className="text-xs font-normal text-muted-foreground">({t("term.membersCount", { count: formatNumber(group.members.length, locale) })})</span></span>
                <Button type="button" size="sm" variant="outline" onClick={() => void copy(whatsappCopyText(group))} aria-label={t("term.copyGroup", { name: group.name })}><Copy />{t("common.copy")}</Button>
              </div>
              <ul className="divide-y text-sm">
                {group.members.map((member, index) => (
                  <li key={`${member.phone_number}-${index}`} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span>{member.full_name}</span>
                    <Ltr as="span" className="font-mono text-xs text-muted-foreground">{member.phone_number}</Ltr>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
