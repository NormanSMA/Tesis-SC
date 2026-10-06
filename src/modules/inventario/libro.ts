import { exigir, type Actor } from "@/core/autorizacion";
import { CERO, comparar, leerDecimal, sumar } from "@/core/decimal";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { aMovimientoDto, incluirMovimiento } from "./dto";
import { regla, traducirError } from "./errores";
import { ejecutarIdempotente, leerClave } from "./idempotencia";
import { bloquearMaterial } from "./repo";
import { cantidadAjuste } from "./reglas";
import type { Ajuste, Entrada } from "./schema";

type Escritura = { entrada: Entrada | Ajuste; actor: Actor; clave: string; operacion: "entrada" | "ajuste" };
async function insertarMovimiento(tx: Tx, solicitud: Escritura) {
  const { entrada, actor } = solicitud;
  const material = await bloquearMaterial(tx, entrada.materialId);
  if (!material.activo) throw regla("MATERIAL_ARCHIVADO", "El material está archivado. Reactívelo antes de registrar movimientos.");
  const esAjuste = "direccion" in entrada;
  const cantidad = esAjuste ? cantidadAjuste(entrada) : entrada.cantidad;
  if (comparar(sumar(leerDecimal(material.existencia.toString())!, leerDecimal(cantidad)!), CERO) < 0) {
    throw regla("EXISTENCIA_INSUFICIENTE", `La existencia de ${material.nombre} no alcanza: solicitado ${entrada.cantidad}, disponible ${material.existencia.toFixed(3)}.`);
  }
  const movimiento = await tx.movimientoInventario.create({ data: { materialId: material.id, usuarioId: actor.id,
    cantidad, ...(esAjuste ? { tipo: "AJUSTE", motivo: entrada.motivo }
      : { tipo: "ENTRADA", costoUnitario: entrada.costoUnitario, referencia: entrada.referencia }) }, include: incluirMovimiento });
  const datos = aMovimientoDto(movimiento, actor);
  await registrarEvento(tx, { entidad: "MOVIMIENTO_INVENTARIO", entidadId: movimiento.id, actorId: actor.id,
    accion: esAjuste ? "AJUSTAR_INVENTARIO" : "REGISTRAR_ENTRADA", detalle: {
      material: datos.material, cantidad: datos.cantidad, costoUnitario: datos.costoUnitario!,
      costoPromedioResultante: datos.costoPromedioResultante!, existenciaResultante: datos.existenciaResultante,
      referencia: datos.referencia, motivo: datos.motivo,
    } });
  return datos;
}
async function registrar(solicitud: Escritura) {
  const { clave, actor, operacion, entrada } = solicitud;
  try {
    const respuesta = await prisma.$transaction((tx) => ejecutarIdempotente(tx,
      { clave: leerClave(clave), usuarioId: actor.id, operacion, cuerpo: entrada }, () => insertarMovimiento(tx, solicitud)));
    return { ...respuesta.resultado, repetida: respuesta.repetida };
  } catch (error) { traducirError(error); }
}
export function registrarEntrada(entrada: Entrada, actor: Actor, clave: string) {
  exigir(actor, "inventario:entrada");
  return registrar({ entrada, actor, clave, operacion: "entrada" });
}
export function registrarAjuste(entrada: Ajuste, actor: Actor, clave: string) {
  exigir(actor, "inventario:ajustar");
  return registrar({ entrada, actor, clave, operacion: "ajuste" });
}
