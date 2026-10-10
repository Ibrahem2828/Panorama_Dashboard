"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="lectures" titleKey="lectures.title" subtitleKey="lectures.subtitle" capability={CAPABILITIES.lectures}/>;}
