import type { Metadata } from "next";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { formatearCantidad } from "@/lib/formato";
import { AccionesMaterial } from "@/modules/inventario/componentes/AccionesMaterial";
import { FiltrosMovimientos } from "@/modules/inventario/componentes/FiltrosInventario";
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
  const [libro, opciones] = await Promise.all([listarMovimientosMaterial(material.id, consulta, actor), opcionesLibro(actor)]);
  return <><PageHeader className="[&_h1]:break-words" titulo={material.nombre} descripcion={`${material.codigo} · ${material.unidad}`} acciones={<EstadoMaterial material={material} />} />
    <div className="min-w-0 space-y-6">
      <AccionesMaterial key={material.actualizadoEn} material={material} permisos={{ gestionar: can(actor, "material:gestionar"),
        entrada: can(actor, "inventario:entrada"), ajustar: can(actor, "inventario:ajustar") }} />
      <Card className="min-w-0"><CardHeader><CardTitle>Existencias y conciliación</CardTitle></CardHeader>
        <CardContent className="space-y-4"><dl className="grid gap-4 sm:grid-cols-3">
          <div><dt>Existencia</dt><dd>{formatearCantidad(material.existencia, 3)} {material.unidad}</dd></div>
          <div><dt>Stock mínimo</dt><dd>{formatearCantidad(material.stockMinimo, 3)}</dd></div>
          <div><dt>Costo promedio (C$)</dt><dd>{formatearCantidad(material.costoPromedio, 4)}</dd></div></dl>
          {material.descripcion ? <p className="whitespace-pre-wrap break-words">{material.descripcion}</p> : null}
          {material.alerta ? <p role="status" className="font-medium">{material.alerta}</p> : null}
          <p role={material.conciliacion.conciliado ? "status" : "alert"}>{material.conciliacion.conciliado ? "Conciliado" : "Diferencia de integridad"}
            : existencia {material.conciliacion.existencia}; suma del libro {material.conciliacion.sumaLibro}.</p>
        </CardContent></Card>
      <section aria-label="Libro del material" className="min-w-0 space-y-5"><h2 className="text-xl font-semibold">Movimientos</h2>
        {error ? <p role="alert">{error}</p> : null}<FiltrosMovimientos consulta={consulta} materialId={material.id} opciones={opciones} />
        <TablaMovimientos lista={libro} consulta={consulta} ruta={`/inventario/${material.id}`} /></section>
    </div></>;
}
