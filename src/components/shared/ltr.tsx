import type { ElementType, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Left-to-right island inside right-to-left text (e-mails, phone numbers, codes, versions, URLs, prices, paths,
 * JSON). Isolates the bidi run so punctuation and digits keep their order, and stays start-aligned.
 */
export function Ltr({ as: Tag = "bdi", className, children, ...props }: { as?: ElementType } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag dir="ltr" className={cn("text-start [unicode-bidi:isolate]", Tag === "bdi" && "inline-block", className)} {...props}>
      {children}
    </Tag>
  );
}
