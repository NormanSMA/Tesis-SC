import type { Metadata } from "next";
import { PageHeader } from "@/components/comunes/PageHeader";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { nombreUnidad } from "@/lib/formato";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { AccionesMaterial } from "@/modules/inventario/componentes/AccionesMaterial";
import { FiltrosMovimientos } from "@/modules/inventario/componentes/FiltrosInventario";
import { ResumenMaterial } from "@/modules/inventario/componentes/ResumenMaterial";
import { EstadoMaterial, TablaMovimientos } from "@/modules/inventario/componentes/TablasInventario";
import { cargarMaterial, consultaPagina } from "@/modules/inventario/paginas";
import { esquemaConsultaMovimientos } from "@/modules/inventario/schema";
import { listarMovimientosMaterial, opcionesLibro } from "@/modules/inventario/service";

export const metadata: Metadata = { title: "Detalle del material" };
export default async function PaginaMaterial({ params, searchParams }: { params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPermisoPagina("inventario:ver");
  const material = await cargarMaterial((await params).id, actor);
  const { consulta, error } = consultaPagina(await searchParams, esquemaConsultaMovimientos);
  const [libro, opciones] = await Promise.all([listarMovimientosMaterial(material.id, consulta, actor), opcionesLibro(actor, { ...consulta, material: material.id })]);
  return <><PageHeader className="[&_h1]:break-words" titulo={material.nombre} descripcion={`${material.codigo} · ${nombreUnidad(material.unidad)}`} acciones={<EstadoMaterial material={material} />} />
    <div className="min-w-0 space-y-6">
      <AccionesMaterial key={material.actualizadoEn} material={material} permisos={{ gestionar: can(actor, "material:gestionar"),
        entrada: can(actor, "inventario:entrada"), ajustar: can(actor, "inventario:ajustar") }} />
      <ResumenMaterial material={material} />
      <section aria-label="Libro del material" className="min-w-0">
        <details open className="group min-w-0 space-y-4">
          <summary className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
            <h2 className="text-lg font-medium text-slate-900">Movimientos</h2>
            <span className="text-sm text-muted-foreground">({libro.total} {libro.total === 1 ? "registro" : "registros"})</span></summary>
          {error ? <p role="alert">{error}</p> : null}
          <ProveedorLista>
            <div className="space-y-4">
              <FiltrosMovimientos materialId={material.id} opciones={opciones} />
              <TablaMovimientos lista={libro} consulta={consulta} ruta={`/inventario/${material.id}`} sinMaterial />
            </div>
          </ProveedorLista></details></section>
    </div></>;
}
