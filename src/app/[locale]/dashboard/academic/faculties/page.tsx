"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="faculties" titleKey="nav.faculties" subtitleKey="academic.subtitle" capability={CAPABILITIES.academic}/>;}
