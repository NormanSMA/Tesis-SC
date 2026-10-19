import { Boxes } from "lucide-react";
import type { Metadata } from "next";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { nombreUnidad } from "@/lib/formato";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { AccionesMaterial } from "@/modules/inventario/componentes/AccionesMaterial";
import { FiltrosMovimientos } from "@/modules/inventario/componentes/FiltrosInventario";
import { ResumenMaterial } from "@/modules/inventario/componentes/ResumenMaterial";
import { TablaMovimientos } from "@/modules/inventario/componentes/TablasInventario";
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
  return <><CabeceraFicha titulo={material.nombre} marca={<MarcaIcono><Boxes /></MarcaIcono>}
    volver={{ href: "/inventario", etiqueta: "Inventario" }}
    className="max-sm:[&>div:last-child]:flex-col max-sm:[&>div:last-child>div]:w-full"
    meta={<><span className="font-mono break-all">{material.codigo}</span><span>{nombreUnidad(material.unidad)}</span>
      <EstadoBadge tipo="stock" estado={material.activo ? "Activo" : "Archivado"} />
      {material.alerta ? <EstadoBadge tipo="stock" estado={material.alerta === "Sin existencia" ? "Sin existencia" : "BAJO_MINIMO"} /> : null}</>}
    acciones={<AccionesMaterial key={material.actualizadoEn} material={material} permisos={{ gestionar: can(actor, "material:gestionar"),
      entrada: can(actor, "inventario:entrada"), ajustar: can(actor, "inventario:ajustar") }} />} />
    <div className="min-w-0 space-y-6">
      <ResumenMaterial material={material} />
      <section aria-label="Libro del material" className="min-w-0">
        <TarjetaSeccion titulo="Movimientos" sinRelleno>
        <details open className="group min-w-0 space-y-4">
          <summary className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-5 focus-visible:outline-2 focus-visible:outline-ring">
            <span className="sr-only">Movimientos</span>
            <span className="text-sm text-muted-foreground">({libro.total} {libro.total === 1 ? "registro" : "registros"})</span></summary>
          {error ? <p role="alert">{error}</p> : null}
          <ProveedorLista>
            <div className="space-y-4">
              <div className="px-5"><FiltrosMovimientos materialId={material.id} opciones={opciones} /></div>
              <TablaMovimientos lista={libro} consulta={consulta} ruta={`/inventario/${material.id}`} sinMaterial />
            </div>
          </ProveedorLista></details></TarjetaSeccion></section>
    </div></>;
}
