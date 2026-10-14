import type { ForwardRefExoticComponent, RefAttributes } from "react";

/** Control que exponen los íconos animados (lucide-animated): disparar y detener su animación. */
export interface ControlIcono {
  startAnimation: () => void;
  stopAnimation: () => void;
}

type PropiedadesIcono = { size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" };

export type IconoAnimado = ForwardRefExoticComponent<PropiedadesIcono & RefAttributes<ControlIcono>>;
