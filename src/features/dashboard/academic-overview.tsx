"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/config/constants";
import { academicSubNavigation } from "@/config/navigation";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";

export function AcademicOverview(){
  const {t}=useI18n(); const params=useParams<{locale:Locale}>();
  return <div className="space-y-6"><PageHeader title={t("academic.title")} description={t("academic.subtitle")} eyebrow={t("nav.administration")}/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{academicSubNavigation.map(item=>{const Icon=item.icon;return <Link key={item.key} href={localizePath(params.locale,item.href)}><Card className="group h-full transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"><CardContent className="flex items-center gap-4 p-6"><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary group-hover:brand-gradient group-hover:text-white"><Icon/></span><span className="text-lg font-black">{t(item.label)}</span><ArrowUpRight className="ms-auto text-muted-foreground group-hover:text-primary rtl:rotate-[-90deg]"/></CardContent></Card></Link>})}</div></div>
}
