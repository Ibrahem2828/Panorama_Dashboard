"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="announcements" titleKey="announcements.title" subtitleKey="announcements.subtitle" capability={CAPABILITIES.announcements}/>;}
