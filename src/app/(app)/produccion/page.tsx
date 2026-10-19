import type { Metadata } from "next";

import { Clock, Layers, Play, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { BandejaMetricas, TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { FiltrosProduccion } from "@/modules/produccion/componentes/FiltrosProduccion";
import { TableroProduccion } from "@/modules/produccion/componentes/TableroProduccion";
import { esquemaTablero } from "@/modules/produccion/schema";
import { obtenerTablero, opcionesProduccion } from "@/modules/produccion/service";

export const metadata: Metadata = { title: "Producción" };

type Parametros = Record<string, string | string[] | undefined>;
// "todas" y "abiertas" son los valores de "sin filtro" de las pastillas; no llegan a la consulta.
const SIN_FILTRO: Record<string, string> = { area: "todas", estado: "abiertas" };

export default async function PaginaProduccion({ searchParams }: { searchParams: Promise<Parametros> }) {
  const actor = await exigirPermisoPagina("produccion:ver");
  const parametros = await searchParams;
  const entrada = Object.fromEntries(["area", "responsable", "estado", "q"].map((campo) => [campo,
    typeof parametros[campo] === "string" && parametros[campo] && parametros[campo] !== SIN_FILTRO[campo] ? parametros[campo] : undefined]));
  const resultado = esquemaTablero.safeParse(entrada);
  const consulta = resultado.success ? resultado.data : esquemaTablero.parse({});
  const [tablero, opciones] = await Promise.all([obtenerTablero(consulta, actor), opcionesProduccion(actor)]);
  const permisos = { planificar: can(actor, "produccion:planificar"), ejecutar: can(actor, "produccion:ejecutar"),
    avanzar: can(actor, "orden:avanzar") };
  const etapas = tablero.porArea.flatMap((grupo) => grupo.etapas);
  const enCurso = etapas.filter((etapa) => etapa.estado === "EN_CURSO").length;
  const atrasadas = etapas.filter((etapa) => etapa.atrasada).length;
  // Referencia fija del servidor: el texto relativo de las fechas no cambia al hidratar.
  const referencia = new Date().toISOString();
  return <><PageHeader titulo="Producción" tituloVisible={false} descripcion="Consulte las etapas abiertas, sus responsables y sus fechas." acciones={<>
    {actor.perfiles.includes("PRODUCCION") ? <Button asChild><Link href={`/produccion?responsable=${actor.id}`}>Mis etapas</Link></Button> : null}
    <Button asChild variant="outline"><Link href="/produccion/areas">Áreas</Link></Button>
    <Button asChild variant="outline"><Link href="/produccion/plantillas">Plantillas</Link></Button></>} />
    <div className="min-w-0 space-y-4">
      {!resultado.success ? <p role="alert">Revise los filtros. Se muestran todas las etapas abiertas.</p> : null}
      <BandejaMetricas className="grid-cols-2">
        <TarjetaMetrica etiqueta="Etapas abiertas" numero={tablero.total} texto={String(tablero.total)} formato="entero" icono={Layers} destacada />
        <TarjetaMetrica etiqueta="En curso" numero={enCurso} texto={String(enCurso)} formato="entero" icono={Play} />
        <TarjetaMetrica etiqueta="Pendientes" numero={etapas.length - enCurso} texto={String(etapas.length - enCurso)} formato="entero" icono={Clock} />
        <TarjetaMetrica etiqueta="Atrasadas" numero={atrasadas} texto={String(atrasadas)} formato="entero" icono={TriangleAlert}
          alerta={atrasadas > 0} mejorSiBaja />
      </BandejaMetricas>
      <ProveedorLista>
        <FiltrosProduccion opciones={opciones} />
        <TableroProduccion porArea={tablero.porArea} porResponsable={tablero.porResponsable} permisos={permisos}
          vistaInicial={parametros.vista === "area" ? "area" : "responsable"} miId={actor.id} referencia={referencia} />
      </ProveedorLista>
    </div>
  </>;
}
