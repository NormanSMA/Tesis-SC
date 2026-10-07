import { can, exigir } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";
import { manejar, ok } from "@/lib/http";
import { leerConsulta } from "@/modules/inventario/consulta";
import { nombreArchivo, serializarCsv } from "@/modules/reportes/csv";
import { esquemaConsulta, esquemaNombre } from "@/modules/reportes/schema";
import { obtenerReporte } from "@/modules/reportes/service";

export const GET = manejar({ permiso: "reporte:ver" }, async ({ req, actor, params }) => {
  const nombre = esquemaNombre.safeParse(params.nombre);
  if (!nombre.success) throw new AppError({ codigo: "NO_ENCONTRADO", status: 404, mensaje: "El reporte no existe." });
  const consulta = leerConsulta(req, esquemaConsulta);
  if (consulta.formato === "csv") exigir(actor, "reporte:exportar");
  const reporte = await obtenerReporte({ nombre: nombre.data, consulta, actor });
  if (consulta.formato !== "csv") return ok(reporte);
  // eslint-disable-next-line no-console -- La exportación requiere un registro informativo sin persistencia de negocio.
  console.info("Exportación CSV", { usuario: actor.id, reporte: nombre.data, filtros: consulta });
  return new Response(serializarCsv({ nombre: nombre.data, reporte, dinero: can(actor, "cotizacion:ver") }), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${nombreArchivo(nombre.data, new Date(reporte.generadoEn))}"` },
  });
});
