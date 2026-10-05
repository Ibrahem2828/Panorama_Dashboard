"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="mobile-release-policies" titleKey="product.releases.title" subtitleKey="product.releases.subtitle" capability={CAPABILITIES.product}/>;}
