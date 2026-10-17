"use client";

import { Ltr } from "@/components/shared/ltr";
import { useI18n } from "@/i18n/provider";
import { compactJson, formatDate, formatNumber } from "@/lib/utils";

/** Field names whose string values are Latin tokens (e-mails, phones, codes, versions, URLs, paths) and must read left-to-right. */
const LTR_KEY = /(^|_)(email|phone|phone_number|url|link|path|code|version|build|build_number|key|number|student_number|sha256|uuid|installation_id|ip|ip_address|file_type|permission_code|capability|content_url|store_url|whatsapp_url)(_|$)/u;
/** Field names whose string values are enum codes and are shown through the localized enum catalog. */
const ENUM_KEY = /^(platform|update_mode|color_mode|paper_size|sides|binding|visibility|target_user_type|role|effect|send_messages_permission|priority|kind|category|status|type|metric_type|action|currency|method|movement_type)$/u;

/** Currency codes (SYP, USD) are upper-case, unlike the other enum values. */
const CURRENCY_KEY = /(^|_)currency$/u;

export function isLtrKey(key: string) {
  return LTR_KEY.test(key);
}

function looksLtr(text: string) {
  return /^[\w.+-]+@[\w.-]+$/u.test(text) || /^(https?:\/\/|\/)\S+$/u.test(text) || /^\+?[\d\s()-]{6,}$/u.test(text) || /^v?\d+(\.\d+){1,3}([-+][\w.]+)?$/u.test(text);
}

/** Renders one raw API value for a table cell or detail card: localized dates/numbers/enums, LTR islands, isolated JSON. */
export function CellValue({ name, value, locale, truncate = false }: { name: string; value: unknown; locale: string; truncate?: boolean }) {
  const { enumLabel } = useI18n();
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return <>{value ? "✓" : "—"}</>;
  if (name.includes("_at") || name.endsWith("date") || name.endsWith("datetime")) return <>{formatDate(value, locale)}</>;
  if (typeof value === "number") return <>{formatNumber(value, locale)}</>;
  if (typeof value === "object") {
    const brief = value as Record<string, unknown>;
    // A related user ({full_name, email}) reads as the person, not as JSON.
    if (typeof brief.full_name === "string") {
      return <span className="block"><span>{brief.full_name}</span>{typeof brief.email === "string" ? <Ltr as="span" className="block text-xs text-muted-foreground">{brief.email}</Ltr> : null}</span>;
    }
    return <Ltr as="span" className={truncate ? "block max-w-72 truncate font-mono text-xs text-muted-foreground" : "block break-words font-mono text-xs"}>{compactJson(value)}</Ltr>;
  }
  const text = String(value);
  if (ENUM_KEY.test(name) && (/^[a-z0-9_.-]+$/u.test(text) || (CURRENCY_KEY.test(name) && /^[A-Z]{3}$/u.test(text)))) return <>{enumLabel(text)}</>;
  if (isLtrKey(name) || looksLtr(text)) {
    return <Ltr as="span" className={truncate ? "block max-w-72 truncate" : "break-words"} title={text}>{text}</Ltr>;
  }
  return truncate ? <span className="block max-w-72 truncate" title={text}>{text}</span> : <>{text}</>;
}
