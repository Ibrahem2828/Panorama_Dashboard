"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="audit-logs" titleKey="audit.title" subtitleKey="audit.subtitle" capability={CAPABILITIES.audit} readOnly/>;}
