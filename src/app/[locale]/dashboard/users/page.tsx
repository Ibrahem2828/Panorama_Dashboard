"use client";
import { PresetResourcePage } from "@/features/resources/preset-page";
import { CAPABILITIES } from "@/lib/auth/capabilities";
export default function Page(){return <PresetResourcePage resourceKey="users" titleKey="users.title" subtitleKey="users.subtitle" capability={CAPABILITIES.users} allowCreate={false} allowEdit allowDelete={false} fieldAllowlist={["full_name", "role"]}/>;}
