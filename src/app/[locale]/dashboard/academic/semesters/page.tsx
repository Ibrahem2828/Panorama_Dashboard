"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="semesters" titleKey="nav.semesters" subtitleKey="academic.subtitle" capability={CAPABILITIES.academic}/>;}
