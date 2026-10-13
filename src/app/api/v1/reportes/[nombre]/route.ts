import { randomUUID } from "node:crypto";

import { can, exigir } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";
import { manejar, ok } from "@/lib/http";
import { registro } from "@/lib/registro";
import { leerConsulta } from "@/modules/inventario/consulta";
import { nombreArchivo, serializarCsv } from "@/modules/reportes/csv";
import { esquemaConsulta, esquemaNombre } from "@/modules/reportes/schema";
import { obtenerReporte } from "@/modules/reportes/service";
import { generarXlsx, textoPeriodo } from "@/modules/reportes/xlsx";

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const GET = manejar({ permiso: "reporte:ver" }, async ({ req, actor, params }) => {
  const nombre = esquemaNombre.safeParse(params.nombre);
  if (!nombre.success) throw new AppError({ codigo: "NO_ENCONTRADO", status: 404, mensaje: "El reporte no existe." });
  const consulta = leerConsulta(req, esquemaConsulta);
  if (consulta.formato !== "json") exigir(actor, "reporte:exportar");
  const reporte = await obtenerReporte({ nombre: nombre.data, consulta, actor });
  if (consulta.formato === "json") return ok(reporte);
  const generadoEn = new Date(reporte.generadoEn);
  const dinero = can(actor, "cotizacion:ver");
  registro.info({
    codigo: "REPORTE_EXPORTADO",
    ruta: new URL(req.url).pathname,
    metodo: req.method,
    peticionId: randomUUID(),
    usuario: actor.id,
    reporte: nombre.data,
    filtros: consulta,
  }, consulta.formato === "csv" ? "Exportación CSV" : "Exportación XLSX");
  const esXlsx = consulta.formato === "xlsx";
  const cuerpo = esXlsx
    ? new Uint8Array(await generarXlsx({ nombre: nombre.data, reporte, dinero, periodo: textoPeriodo(consulta.desde, consulta.hasta), generadoEn }))
    : serializarCsv({ nombre: nombre.data, reporte, dinero });
  return new Response(cuerpo, {
    headers: { "Content-Type": esXlsx ? TIPO_XLSX : "text/csv; charset=utf-8", "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${nombreArchivo(nombre.data, generadoEn, consulta.formato)}"` },
  });
});
