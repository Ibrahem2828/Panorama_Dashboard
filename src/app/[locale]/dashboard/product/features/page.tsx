"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="feature-flags" titleKey="product.features.title" subtitleKey="product.features.subtitle" capability={CAPABILITIES.product}/>;}
