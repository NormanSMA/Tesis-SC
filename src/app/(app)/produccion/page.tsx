import type { Metadata } from "next";

import Link from "next/link";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FiltrosProduccion } from "@/modules/produccion/componentes/FiltrosProduccion";
import { TableroProduccion } from "@/modules/produccion/componentes/TableroProduccion";
import { esquemaTablero } from "@/modules/produccion/schema";
import { obtenerTablero, opcionesProduccion } from "@/modules/produccion/service";

export const metadata: Metadata = { title: "Producción" };

type Parametros = Record<string, string | string[] | undefined>;

export default async function PaginaProduccion({ searchParams }: { searchParams: Promise<Parametros> }) {
  const actor = await exigirPermisoPagina("produccion:ver");
  const parametros = await searchParams;
  const entrada = Object.fromEntries(["area", "responsable", "estado", "q"].map((campo) => [campo,
    typeof parametros[campo] === "string" && parametros[campo] ? parametros[campo] : undefined]));
  const resultado = esquemaTablero.safeParse(entrada);
  const consulta = resultado.success ? resultado.data : esquemaTablero.parse({});
  const [tablero, opciones] = await Promise.all([obtenerTablero(consulta, actor), opcionesProduccion(actor)]);
  const permisos = { planificar: can(actor, "produccion:planificar"), ejecutar: can(actor, "produccion:ejecutar"),
    avanzar: can(actor, "orden:avanzar") };
  return <><PageHeader titulo="Producción" descripcion="Consulte las etapas abiertas, sus responsables y sus fechas." acciones={<>
    {actor.perfiles.includes("PRODUCCION") ? <Button asChild><Link href={`/produccion?responsable=${actor.id}`}>Mis etapas</Link></Button> : null}
    <Button asChild variant="outline"><Link href="/produccion/areas">Áreas</Link></Button>
    <Button asChild variant="outline"><Link href="/produccion/plantillas">Plantillas</Link></Button></>} />
    <div className="min-w-0 space-y-6">
      {!resultado.success ? <p role="alert">Revise los filtros. Se muestran todas las etapas abiertas.</p> : null}
      <FiltrosProduccion key={JSON.stringify(consulta)} consulta={consulta} opciones={opciones} />
      <p className="text-sm text-muted-foreground">Etapas abiertas: {tablero.total}</p>
      <TableroProduccion porArea={tablero.porArea} porResponsable={tablero.porResponsable} permisos={permisos}
        vistaInicial={parametros.vista === "area" ? "area" : "responsable"} />
    </div>
  </>;
}
