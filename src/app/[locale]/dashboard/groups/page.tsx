"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="groups" titleKey="groups.title" subtitleKey="groups.subtitle" capability={CAPABILITIES.groups}/>;}
