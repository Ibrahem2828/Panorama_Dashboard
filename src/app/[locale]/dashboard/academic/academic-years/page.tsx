"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="academic-years" titleKey="nav.academicYears" subtitleKey="academic.subtitle" capability={CAPABILITIES.academic}/>;}
