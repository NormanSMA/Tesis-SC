import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// El sistema de diseño aún no tiene un select nativo. Mantiene la altura, el borde y el foco de Input.
export function SelectNativo({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive disabled:opacity-70",
        className,
      )}
    />
  );
}
