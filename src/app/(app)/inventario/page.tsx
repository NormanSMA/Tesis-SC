import type { Metadata } from "next";

import Link from "next/link";
import { PageHeader } from "@/components/comunes/PageHeader";
import { KpiCard } from "@/components/comunes/KpiCard";
import { Button } from "@/components/ui/button";
import { can, type Actor } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FiltrosMateriales, FiltrosMovimientos } from "@/modules/inventario/componentes/FiltrosInventario";
import { PestanasInventario } from "@/modules/inventario/componentes/PestanasInventario";
import { TablaMateriales, TablaMovimientos } from "@/modules/inventario/componentes/TablasInventario";
import { consultaPagina } from "@/modules/inventario/paginas";
import { esquemaConsultaMateriales, esquemaConsultaMovimientos } from "@/modules/inventario/schema";
import { listarMateriales, listarMovimientos, opcionesLibro } from "@/modules/inventario/service";

export const metadata: Metadata = { title: "Inventario" };

type Parametros = Record<string, string | string[] | undefined>;
async function Materiales({ parametros, actor }: { parametros: Parametros; actor: Actor }) {
  const { consulta, error } = consultaPagina(parametros, esquemaConsultaMateriales);
  const lista = await listarMateriales(consulta, actor);
  return <>{error ? <p role="alert">{error}</p> : null}<div className="grid gap-4 sm:grid-cols-3">
    <KpiCard etiqueta="Materiales" valor={lista.resumen.materiales} />
    <KpiCard etiqueta="En alerta" valor={lista.resumen.enAlerta} />
    <KpiCard etiqueta="Sin existencia" valor={lista.resumen.sinExistencia} /></div>
    <FiltrosMateriales consulta={consulta} /><TablaMateriales lista={lista} consulta={consulta} /></>;
}
async function Movimientos({ parametros, actor }: { parametros: Parametros; actor: Actor }) {
  const { consulta, error } = consultaPagina(parametros, esquemaConsultaMovimientos);
  const [lista, opciones] = await Promise.all([listarMovimientos(consulta, actor), opcionesLibro(actor, consulta)]);
  return <>{error ? <p role="alert">{error}</p> : null}<FiltrosMovimientos consulta={consulta} opciones={opciones} />
    <TablaMovimientos lista={lista} consulta={consulta} /></>;
}
export default async function PaginaInventario({ searchParams }: { searchParams: Promise<Parametros> }) {
  const actor = await exigirPermisoPagina("inventario:ver");
  const parametros = await searchParams;
  const seleccion = parametros.pestana === "movimientos" ? "movimientos" : "materiales";
  return <><PageHeader titulo="Inventario" descripcion="Consulte materiales, existencias y movimientos." acciones={<>
    {can(actor, "material:gestionar") ? <Button asChild><Link href="/inventario/nuevo">Nuevo material</Link></Button> : null}
    {can(actor, "inventario:entrada") ? <Button asChild variant="outline"><Link href="/inventario/entrada">Registrar entrada</Link></Button> : null}
    {can(actor, "inventario:ajustar") ? <Button asChild variant="outline"><Link href="/inventario/ajuste">Ajustar</Link></Button> : null}</>} />
    <PestanasInventario seleccion={seleccion}>{seleccion === "materiales"
      ? <Materiales parametros={parametros} actor={actor} /> : <Movimientos parametros={parametros} actor={actor} />}</PestanasInventario></>;
}
