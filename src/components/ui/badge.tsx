import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        neutro: "border-border bg-secondary text-neutral-strong",
        neutroFuerte: "border-neutral-strong bg-neutral-strong text-neutral-strong-foreground",
        acento: "border-primary-soft-border bg-primary-soft text-primary",
        info: "border-info-soft-border bg-info-soft text-info",
        exito: "border-success-soft-border bg-success-soft text-success",
        advertencia: "border-warning-soft-border bg-warning-soft text-warning",
        peligro: "border-danger-soft-border bg-danger-soft text-danger",
      },
    },
    defaultVariants: {
      variant: "neutro",
    },
  }
)

function Badge({
  className,
  variant = "neutro",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
