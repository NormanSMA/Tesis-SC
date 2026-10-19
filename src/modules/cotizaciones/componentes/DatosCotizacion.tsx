import Link from "next/link";
import { ListaDatos, type DatoFicha } from "@/components/comunes/TarjetaSeccion";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { Card } from "@/components/ui/card";
import type { CotizacionDto } from "../tipos";

/** Datos secundarios de la ficha: fechas, origen y condiciones. Sección plegable. */
export function DatosCotizacion({ cotizacion }: { cotizacion: CotizacionDto }) {
  const datos: DatoFicha[] = [
    { etiqueta: "Emisión", valor: <Fecha valor={cotizacion.fechaEmision} /> },
    { etiqueta: "Vencimiento", valor: <Fecha valor={cotizacion.fechaVencimiento} /> },
    { etiqueta: "Vigencia", valor: `${cotizacion.vigenciaDias} días` },
    ...(cotizacion.fechaRespuesta ? [{ etiqueta: "Respuesta", valor: <Fecha valor={cotizacion.fechaRespuesta} /> }] : []),
    ...(cotizacion.cotizacionOrigenId ? [{ etiqueta: "Origen", valor:
      <Link href={`/cotizaciones/${cotizacion.cotizacionOrigenId}`} className="inline-flex min-h-10 items-center text-primary underline">Ver cotización original</Link> }] : []),
    { etiqueta: "Condiciones comerciales", ancho: true,
      valor: <span className="block whitespace-pre-wrap font-normal">{cotizacion.condiciones || "Sin condiciones adicionales."}</span> },
  ];
  return <Card className="px-5"><details>
    <summary className="flex min-h-10 cursor-pointer items-center rounded-md text-base font-semibold focus-visible:outline-2 focus-visible:outline-ring">
      Condiciones y fechas
    </summary>
    <ListaDatos datos={datos} className="mt-4" />
  </details></Card>;
}
