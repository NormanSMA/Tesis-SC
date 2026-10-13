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
  className?: string;
};

export function Marca({ mostrarNombre = true, grande = false, className }: PropiedadesMarca) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Isotipo className={grande ? "h-14" : undefined} />
      {mostrarNombre ? (
        <span className="flex flex-col leading-tight">
          <span className={cn("font-semibold text-foreground", grande ? "text-base" : "text-sm")}>{NOMBRE_PLATAFORMA}</span>
          <span className="text-xs text-muted-foreground">{NOMBRE_EMPRESA}</span>
        </span>
      ) : null}
    </span>
  );
}
