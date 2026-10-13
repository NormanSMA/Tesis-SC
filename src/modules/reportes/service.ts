import { can, exigir, type Actor } from "@/core/autorizacion";
import { CERO, formatear, leerDecimal, sumar } from "@/core/decimal";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { alertaMaterial } from "@/modules/inventario/reglas";
import { ETIQUETA_UNIDAD } from "@/modules/inventario/etiquetas";
import { estaAtrasada } from "@/modules/ordenes/reglas";
import { textoEstado } from "@/modules/trazabilidad/etiquetas";
import { consultarCarga, consultarCotizaciones, consultarEtapaActual, consultarExistencias } from "./repo";
import { tasaAprobacion } from "./reglas";
import type { ConsultaReporte, NombreReporte } from "./schema";
import type { FilaReporte, ReporteDto } from "./tipos";

async function cotizaciones(consulta: ConsultaReporte, dinero: boolean) {
  const grupos = await consultarCotizaciones(consulta);
  const estados = ["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "VENCIDA", "AJUSTE_SOLICITADO"];
  const filas = estados.map((estado) => {
    const grupo = grupos.find((fila) => fila.estado === estado);
    return { estado: estado === "AJUSTE_SOLICITADO" ? "Ajustes solicitados" : textoEstado(estado)!, cantidad: grupo?.cantidad ?? 0,
      ...(dinero && { importe: grupo?.importe ?? "0.00" }) };
  });
  const aprobadas = grupos.find((fila) => fila.estado === "APROBADA")?.cantidad ?? 0;
  const rechazadas = grupos.find((fila) => fila.estado === "RECHAZADA")?.cantidad ?? 0;
  return { filas, totales: { cantidad: filas.reduce((suma, fila) => suma + fila.cantidad, 0),
    tasaAprobacion: tasaAprobacion(aprobadas, rechazadas),
    ...(dinero && { importe: formatear(filas.reduce((suma, fila) => sumar(suma, leerDecimal(fila.importe!)!), CERO), 2) }) } };
}
async function existencias(consulta: ConsultaReporte, dinero: boolean) {
  const materiales = await consultarExistencias(consulta, dinero);
  const filas = materiales.map((material) => ({ codigo: material.codigo, material: material.material,
    unidad: ETIQUETA_UNIDAD[material.unidad] ?? "Unidad", existencia: material.existencia, stockMinimo: material.stockMinimo,
    alerta: alertaMaterial({ ...material, activo: true }) ?? "Sin alerta",
    ...(dinero && { costoPromedio: material.costoPromedio!, valorInventario: formatear(leerDecimal(material.valorExacto!)!, 2) }) }));
  return { filas, totales: { materiales: filas.length, enAlerta: filas.filter((fila) => fila.alerta !== "Sin alerta").length,
    sinExistencia: filas.filter((fila) => /^0(?:\.0+)?$/.test(fila.existencia)).length,
    ...(dinero && { valorInventario: formatear(materiales.reduce((suma, fila) => sumar(suma, leerDecimal(fila.valorExacto!)!), CERO), 2) }) } };
}
async function carga(consulta: ConsultaReporte, hoy: string) {
  const filas = await consultarCarga({ consulta, hoy });
  const totales: FilaReporte = { pendientes: 0, enCurso: 0, completadas: 0, atrasadas: 0, ordenes: 0 };
  for (const fila of filas) for (const campo of Object.keys(totales)) totales[campo] = Number(totales[campo]) + Number(fila[campo as keyof typeof fila]);
  return { filas, totales };
}
async function etapas(consulta: ConsultaReporte, hoy: string) {
  const ordenes = await consultarEtapaActual(consulta);
  const grupos = new Map<string, FilaReporte>();
  for (const orden of ordenes) {
    const actual = orden.etapas[0];
    const clave = JSON.stringify([actual?.areaId, actual?.nombre]);
    const fila = grupos.get(clave) ?? { etapa: actual?.nombre ?? "Sin etapa abierta", area: actual?.area.nombre ?? "Sin área",
      cantidad: 0, atrasadas: 0 };
    fila.cantidad = Number(fila.cantidad) + 1;
    if (estaAtrasada({ estado: orden.estado, fechaEntrega: orden.fechaEntrega.toISOString().slice(0, 10) }, hoy)) fila.atrasadas = Number(fila.atrasadas) + 1;
    grupos.set(clave, fila);
  }
  const filas = [...grupos.values()].sort((a, b) => String(a.area).localeCompare(String(b.area), "es") || String(a.etapa).localeCompare(String(b.etapa), "es"));
  return { filas, totales: { cantidad: ordenes.length, atrasadas: filas.reduce((suma, fila) => suma + Number(fila.atrasadas), 0) } };
}
export async function obtenerReporte(entrada: { nombre: NombreReporte; consulta: ConsultaReporte; actor: Actor; instante?: Date }): Promise<ReporteDto> {
  exigir(entrada.actor, "reporte:ver");
  if (entrada.consulta.formato !== "json") exigir(entrada.actor, "reporte:exportar");
  const instante = entrada.instante ?? new Date();
  const dinero = can(entrada.actor, "cotizacion:ver");
  const operaciones = {
    "cotizaciones-por-estado": () => cotizaciones(entrada.consulta, dinero), existencias: () => existencias(entrada.consulta, dinero),
    "carga-por-operario": () => carga(entrada.consulta, hoyManagua(instante)),
    "ordenes-por-etapa": () => etapas(entrada.consulta, hoyManagua(instante)),
  };
  return { ...await operaciones[entrada.nombre](), generadoEn: instante.toISOString() };
}
