import Image from "next/image";

import { cn } from "@/lib/utils";
import { rutaServicio, servicioDeCategoria, SERVICIOS } from "@/lib/servicios";

type Propiedades = {
  /** Nombre de la categoría del catálogo. */
  categoria?: string;
  /** Identificador directo de la ilustración (por ejemplo "rotulacion"). Tiene prioridad sobre la categoría. */
  slug?: string;
  /** Lado en píxeles. */
  tamano?: number;
  /** Si el texto de la categoría ya está al lado, la ilustración es decorativa y no se anuncia. */
  decorativo?: boolean;
  className?: string;
};

export function IconoServicio({ categoria, slug, tamano = 32, decorativo = true, className }: Propiedades) {
  const servicio = slug && SERVICIOS[slug] ? { slug, nombre: SERVICIOS[slug] } : categoria ? servicioDeCategoria(categoria) : null;
  if (!servicio) return null;
  return (
    <Image
      src={rutaServicio(servicio.slug)}
      alt={decorativo ? "" : servicio.nombre}
      width={tamano}
      height={tamano}
      className={cn("shrink-0 select-none", className)}
      style={{ width: tamano, height: tamano }}
    />
  );
}
