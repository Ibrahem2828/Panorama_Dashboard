import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface RemoteImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function RemoteImage({ src, alt, className }: RemoteImageProps) {
  if (!src) {
    return (
      <div className={cn("flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground", className)}>
        <ImageIcon className="size-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={96}
      height={96}
      className={cn("size-12 rounded-md border object-cover", className)}
      unoptimized
    />
  );
}
