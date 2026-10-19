import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { FormularioOrden } from "@/modules/ordenes/componentes/FormularioOrden";
import { cargarOrden } from "@/modules/ordenes/paginas";
import { EDITABLES } from "@/modules/ordenes/reglas";
import { opcionesOrden } from "@/modules/ordenes/service";

export const metadata: Metadata = { title: "Editar orden" };

export default async function PaginaEditarOrden({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("orden:ver");
  const gestionar = can(actor, "orden:gestionar");
  if (!gestionar && !can(actor, "produccion:planificar")) redirect("/sin-acceso");
  const orden = await cargarOrden((await params).id, actor);
  if (!EDITABLES.includes(orden.estado)) redirect(`/ordenes/${orden.id}`);
  const opciones = await opcionesOrden(actor);
  return <><CabeceraFicha titulo={`Editar ${orden.numero}`} meta={<span>{orden.cliente.nombre}</span>}
    volver={{ href: `/ordenes/${orden.id}`, etiqueta: orden.numero }} className="mx-auto max-w-2xl" />
    <FormularioOrden key={orden.actualizadoEn} orden={orden} opciones={opciones} hoy={hoyManagua()} soloResponsable={!gestionar} /></>;
}
