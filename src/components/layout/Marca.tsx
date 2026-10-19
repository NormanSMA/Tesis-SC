import Image from "next/image";

import { NOMBRE_EMPRESA, NOMBRE_PLATAFORMA } from "@/core/marca";
import { cn } from "@/lib/utils";

export function Isotipo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/isotipo.png"
      alt=""
      width={544}
      height={512}
      priority
      className={cn("h-8 w-auto shrink-0", className)}
    />
  );
}

type PropiedadesMarca = {
  mostrarNombre?: boolean;
  grande?: boolean;
  /** Isotipo dentro de una caja blanca redondeada (menú lateral). */
  conCaja?: boolean;
  className?: string;
};

export function Marca({ mostrarNombre = true, grande = false, conCaja = false, className }: PropiedadesMarca) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      {conCaja ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-card shadow-sm">
          <Isotipo className="h-6" />
        </span>
      ) : (
        <Isotipo className={grande ? "h-14" : undefined} />
      )}
      {mostrarNombre ? (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={cn("truncate font-semibold tracking-tight text-foreground", grande ? "text-base" : "text-[15px]")}>{NOMBRE_PLATAFORMA}</span>
          <span className="truncate text-xs text-muted-foreground">{NOMBRE_EMPRESA}</span>
        </span>
      ) : null}
    </span>
  );
}
