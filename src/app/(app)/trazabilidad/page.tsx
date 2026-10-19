import type { Metadata } from "next";

import { redirect } from "next/navigation";
import { ErrorState } from "@/components/comunes/ErrorState";
import { PageHeader } from "@/components/comunes/PageHeader";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AppError } from "@/lib/errores";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { leerOrden, textoOrden } from "@/lib/listas/orden";
import { BuscarTrabajo, FiltrosBitacora } from "@/modules/trazabilidad/componentes/FiltrosBitacora";
import { TablaBitacora } from "@/modules/trazabilidad/componentes/TablaBitacora";
import { CAMPOS_ORDEN_BITACORA, esquemaConsultaBitacora, leerConsulta } from "@/modules/trazabilidad/schema";
import { buscarOrdenPorNumero, listarBitacora, opcionesBitacora } from "@/modules/trazabilidad/service";

export const metadata: Metadata = { title: "Trazabilidad" };

type Parametros = Record<string, string | string[] | undefined>;
function parametrosFiltros(parametros: Parametros) {
  const copia = { ...parametros };
  for (const campo of ["entidad", "accion", "usuario"]) if (copia[campo] === "__todos__") delete copia[campo];
  const orden = leerOrden(typeof copia.ordenar === "string" ? copia.ordenar.trim() : null, CAMPOS_ORDEN_BITACORA);
  if (orden) copia.ordenar = textoOrden(orden); else delete copia.ordenar;
  return copia;
}
export default async function PaginaTrazabilidad({ searchParams }: { searchParams: Promise<Parametros> }) {
  const actor = await exigirPermisoPagina("bitacora:ver");
  const parametros = parametrosFiltros(await searchParams);
  const trabajo = typeof parametros.trabajo === "string" ? parametros.trabajo.trim() : "";
  let aviso: string | undefined;
  if (trabajo && can(actor, "orden:ver")) {
    const orden = await buscarOrdenPorNumero(trabajo, actor);
    if (orden) redirect(`/trazabilidad/ordenes/${orden.id}`);
    aviso = "No hay una orden vinculada con ese número.";
  }
  let consulta = esquemaConsultaBitacora.parse({});
  try { consulta = leerConsulta(parametros); } catch (error) {
    if (!(error instanceof AppError)) throw error;
    aviso = error.message;
  }
  const [lista, usuarios] = aviso ? [null, []] : await Promise.all([listarBitacora(consulta, actor), opcionesBitacora(actor)]);
  return <><PageHeader titulo="Trazabilidad" tituloVisible={false} descripcion="Historial de cambios y responsables de los trabajos."
      acciones={<p className="text-xs text-muted-foreground">Registro de solo lectura</p>} />
    <div className="min-w-0 space-y-4">
      {can(actor, "orden:ver") ? <BuscarTrabajo /> : null}
      <ProveedorLista>
        <FiltrosBitacora consulta={consulta} usuarios={usuarios} />
        <div aria-live="polite">{aviso ? <ErrorState descripcion={aviso} /> : null}</div>
        {lista ? <TablaBitacora lista={lista} consulta={consulta} /> : null}
      </ProveedorLista>
    </div></>;
}
