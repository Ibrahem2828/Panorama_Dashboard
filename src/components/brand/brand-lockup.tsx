import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLockup({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src="/brand/symbol-128.png"
        alt="Panorama"
        width={compact ? 48 : 64}
        height={compact ? 24 : 32}
        className="h-auto object-contain"
        priority
      />
      {!compact ? (
        <div className="min-w-0 leading-tight">
          <div className="brand-text-gradient text-lg font-black">بانوراما</div>
          <div className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground">PANORAMA</div>
        </div>
      ) : null}
    </div>
  );
}
