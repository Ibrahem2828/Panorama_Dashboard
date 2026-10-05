"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="maintenance-modes" titleKey="product.maintenance.title" subtitleKey="product.maintenance.subtitle" capability={CAPABILITIES.product}/>;}
