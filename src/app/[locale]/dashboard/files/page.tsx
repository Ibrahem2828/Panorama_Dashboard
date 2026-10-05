"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="files" titleKey="files.title" subtitleKey="files.subtitle" capability={CAPABILITIES.files}/>;}
